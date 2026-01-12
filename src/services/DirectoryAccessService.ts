import { DirectoryAccessPersistenceService } from "./DirectoryAccessPersistenceService";

/**
 * Service responsible for interacting with the Browser File System Access API.
 * Responsibility: Securely request, verify, and manage folder handles.
 */
export class DirectoryAccessService {
  private static readonly _kovaaksStatsPathParts: string[] = [
    "steamapps",
    "common",
    "FPSAimTrainer",
    "FPSAimTrainer",
    "stats",
  ];

  private readonly _persistenceService: DirectoryAccessPersistenceService;
  private _directoryHandle: FileSystemDirectoryHandle | null = null;
  private _logicalPath: string = "";
  private _originalSelectionName: string = "";

  /**
   * Initializes the service and its persistence layer.
   */
  public constructor() {
    this._persistenceService = new DirectoryAccessPersistenceService();
  }

  /**
   * Reconfirm the folder selection and return the directory handle.
   * @returns A promise that resolves to the directory handle or null if cancelled.
   */
  public async requestDirectorySelection(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle: FileSystemDirectoryHandle =
        await window.showDirectoryPicker();

      await this._handleSuccessfulSelection(handle);

      return this._directoryHandle;
    } catch (error) {
      this._handlePickerError(error);

      return null;
    }
  }

  /**
   * Attempt to restore a previously saved directory handle from storage.
   * @returns A promise that resolves to the restored handle or null if unavailable.
   */
  public async attemptReconnection(): Promise<FileSystemDirectoryHandle | null> {
    const persistedData =
      await this._persistenceService.retrieveHandleFromStorage();

    if (persistedData && (await this._verifyPermission(persistedData.handle))) {
      this._directoryHandle = persistedData.handle;
      this._logicalPath = persistedData.handle.name;
      this._originalSelectionName = persistedData.originalName;

      return persistedData.handle;
    }

    return null;
  }

  /**
   * Enumerates all files within the currently active directory handle.
   *
   * @returns A promise resolving to an array of file handles.
   */
  public async getDirectoryFiles(): Promise<FileSystemFileHandle[]> {
    if (!this._directoryHandle) {
      return [];
    }

    const files: FileSystemFileHandle[] = [];

    for await (const entry of this._directoryHandle.values()) {
      if (entry.kind === "file") {
        files.push(entry as FileSystemFileHandle);
      }
    }

    return files;
  }

  /**
   * Gets the name of the currently selected directory.
   *
   * @returns The folder name, or null if no selection exists.
   */
  public get currentFolderName(): string | null {
    return this._directoryHandle?.name ?? null;
  }

  /**
   * Gets the descriptive logical path representing the selection.
   *
   * @returns The full logical path string.
   */
  public get fullLogicalPath(): string {
    return this._logicalPath;
  }

  /**
   * Gets the name of the root directory selected by the user.
   *
   * @returns The original selection name.
   */
  public get originalSelectionName(): string {
    return this._originalSelectionName;
  }

  /**
   * Clears the current directory handle and removes it from persistent storage.
   */
  public clearStoredHandle(): void {
    this._directoryHandle = null;
    this._logicalPath = "";
    this._originalSelectionName = "";
    this._persistenceService.clearHandleFromStorage();
  }

  private async _handleSuccessfulSelection(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    this._originalSelectionName = handle.name;
    const { statsHandle, path } = await this._discoverStatsFolder(handle);
    this._directoryHandle = statsHandle;
    this._logicalPath = path;
    await this._persistenceService.saveHandleToStorage(
      statsHandle,
      this._originalSelectionName,
    );
  }

  /**
   * Attempts to find a 'stats' directory within the provided handle by following the known suffix.
   * Targets: steamapps \ common \ FPSAimTrainer \ FPSAimTrainer \ stats
   *
   * @param handle - The root handle to start discovery from.
   * @returns A promise resolving to the discovered stats handle and logical path.
   */
  private async _discoverStatsFolder(
    handle: FileSystemDirectoryHandle,
  ): Promise<{ statsHandle: FileSystemDirectoryHandle; path: string }> {
    const indices: number[] = this._findPotentialStartIndices(handle.name);

    for (const startIndex of indices) {
      const result = await this._tryTraverseFromIndex(handle, startIndex);

      if (result) {
        return result;
      }
    }

    try {
      // Fallback: Check if the current handle *contains* 'steamapps' as a child
      // This supports cases where the user selects their root 'SteamLibrary' folder.
      const steamAppsHandle = await handle.getDirectoryHandle("steamapps", {
        create: false,
      });
      // 'steamapps' corresponds to index 0 in our path parts array.
      const result = await this._tryTraverseFromIndex(steamAppsHandle, 0);

      if (result) {
        // We do not prepend the root handle name to the path here, typically users
        // care about the path starting from 'steamapps' anyway.
        return result;
      }
    } catch {
      // 'steamapps' not found or other error; ignore and fallback to root.
    }

    return { statsHandle: handle, path: handle.name };
  }

  private _findPotentialStartIndices(currentName: string): number[] {
    const lowerName: string = currentName.toLowerCase();
    const parts: string[] = DirectoryAccessService._kovaaksStatsPathParts;

    return parts
      .map((part: string, index: number): number =>
        part.toLowerCase() === lowerName ? index : -1,
      )
      .filter((index: number): boolean => index !== -1);
  }

  private async _tryTraverseFromIndex(
    handle: FileSystemDirectoryHandle,
    startIndex: number,
  ): Promise<{ statsHandle: FileSystemDirectoryHandle; path: string } | null> {
    const parts: string[] = DirectoryAccessService._kovaaksStatsPathParts;
    let current: FileSystemDirectoryHandle = handle;
    const pathSegments: string[] = [handle.name];

    for (let i: number = startIndex + 1; i < parts.length; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i]);
        pathSegments.push(parts[i]);
      } catch {
        return null;
      }
    }

    return { statsHandle: current, path: pathSegments.join(" \\ ") };
  }

  private async _verifyPermission(
    handle: FileSystemDirectoryHandle,
  ): Promise<boolean> {
    const permissionStatus = await handle.queryPermission({ mode: "read" });

    return permissionStatus === "granted";
  }

  private _handlePickerError(error: unknown): void {
    const isAbortError: boolean =
      error instanceof Error && error.name === "AbortError";

    if (!isAbortError) {
      console.error("Critical Failure in Directory Access Service:", error);
    }
  }
}
