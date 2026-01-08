/**
 * Service responsible for monitoring a FileSystemDirectoryHandle for changes.
 * Responsibility: Periodically poll the directory for new files to fulfill the "Real-time File Ingestion" goal.
 */
export class DirectoryMonitoringService {
    private _intervalId: number | null = null;
    private readonly _knownFileNames: Set<string> = new Set();
    private _isPolling: boolean = false;

    /**
     * Starts monitoring the provided directory handle.
     * @param handle The directory handle to monitor.
     * @param onFileAdded Callback invoked when a new file is detected.
     * @param pollInterval Interval in milliseconds (default 2000ms).
     */
    public async startMonitoring(
        handle: FileSystemDirectoryHandle,
        onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>,
        pollInterval: number = 2000
    ): Promise<void> {
        this.stopMonitoring();

        // Initial scan to establish baseline
        await this._syncKnownFiles(handle);

        this._intervalId = window.setInterval(async () => {
            if (this._isPolling) return;

            this._isPolling = true;
            try {
                await this._poll(handle, onFileAdded);
            } catch (error) {
                console.error("Directory monitoring poll failed:", error);
            } finally {
                this._isPolling = false;
            }
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

    /**
     * Synchronizes the internal set of known filenames without triggering callbacks.
     * @param handle
     */
    private async _syncKnownFiles(handle: FileSystemDirectoryHandle): Promise<void> {
        this._knownFileNames.clear();
        for await (const entry of handle.values()) {
            if (entry.kind === "file") {
                this._knownFileNames.add(entry.name);
            }
        }
    }

    /**
     * Polls the directory for changes and identifies new files.
     * @param handle
     * @param onFileAdded
     */
    private async _poll(
        handle: FileSystemDirectoryHandle,
        onFileAdded: (fileHandle: FileSystemFileHandle) => void | Promise<void>
    ): Promise<void> {
        for await (const entry of handle.values()) {
            if (entry.kind === "file" && !this._knownFileNames.has(entry.name)) {
                const fileHandle = entry as FileSystemFileHandle;
                this._knownFileNames.add(fileHandle.name);

                // Only trigger for CSV files as per project requirements
                if (fileHandle.name.toLowerCase().endsWith(".csv")) {
                    await onFileAdded(fileHandle);
                }
            }
        }
    }
}
