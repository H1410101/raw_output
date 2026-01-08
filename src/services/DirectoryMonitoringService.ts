/**
 * Service responsible for monitoring a FileSystemDirectoryHandle for changes.
 * Responsibility: Periodically poll the directory for new files to fulfill the "Real-time File Ingestion" goal.
 */
export class DirectoryMonitoringService {
  private _intervalId: number | null = null;

  private readonly _knownFileNames: Set<string> = new Set<string>();

  private _isPolling: boolean = false;

  /**
   * Starts monitoring the provided directory handle.
   *
   * @param handle - The directory handle to monitor.
   * @param onFileAdded - Callback invoked when a new file is detected.
   * @param pollInterval - Interval in milliseconds (default 2000ms).
   * @returns A promise that resolves once initial scanning is complete.
   */
  public async startMonitoring(
    handle: FileSystemDirectoryHandle,
    onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>,
    pollInterval: number = 2000,
  ): Promise<void> {
    this.stopMonitoring();

    await this._syncKnownFiles(handle);

    this._intervalId = window.setInterval((): void => {
      this._executePollCycle(handle, onFileAdded);
    }, pollInterval);
  }

  /**
   * Stops the monitoring loop.
   */
  public stopMonitoring(): void {
    if (this._intervalId !== null) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
    }

    this._knownFileNames.clear();

    this._isPolling = false;
  }

  private async _executePollCycle(
    handle: FileSystemDirectoryHandle,
    onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>,
  ): Promise<void> {
    if (this._isPolling) {
      return;
    }

    this._isPolling = true;

    try {
      await this._poll(handle, onFileAdded);
    } catch (error: unknown) {
      console.error("Directory monitoring poll failed:", error);
    } finally {
      this._isPolling = false;
    }
  }

  private async _syncKnownFiles(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    this._knownFileNames.clear();

    for await (const entry of handle.values()) {
      if (entry.kind === "file") {
        this._knownFileNames.add(entry.name);
      }
    }
  }

  private async _poll(
    handle: FileSystemDirectoryHandle,
    onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>,
  ): Promise<void> {
    for await (const entry of handle.values()) {
      const isNewFile: boolean =
        entry.kind === "file" && !this._knownFileNames.has(entry.name);

      if (isNewFile) {
        await this._processNewEntry(entry as FileSystemFileHandle, onFileAdded);
      }
    }
  }

  private async _processNewEntry(
    fileHandle: FileSystemFileHandle,
    onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>,
  ): Promise<void> {
    this._knownFileNames.add(fileHandle.name);

    if (fileHandle.name.toLowerCase().endsWith(".csv")) {
      await onFileAdded(fileHandle);
    }
  }
}
