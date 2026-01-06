import { DirectoryAccessPersistenceService } from "./DirectoryAccessPersistenceService";

/**
 * Service responsible for interacting with the Browser File System Access API.
 * Responsibility: Securely request, verify, and manage folder handles.
 */
export class DirectoryAccessService {
    private static readonly _KOVAAKS_STATS_PATH_PARTS = ["steamapps", "common", "FPSAimTrainer", "FPSAimTrainer", "stats"];

    private readonly _persistenceService: DirectoryAccessPersistenceService;
    private _directoryHandle: FileSystemDirectoryHandle | null = null;
    private _logicalPath: string = "";
    private _originalSelectionName: string = "";

    constructor() {
        this._persistenceService = new DirectoryAccessPersistenceService();
    }

    /**
     * Reconfirm the folder selection and return the directory handle.
     * @returns A promise that resolves to the directory handle or null if cancelled.
     */
    public async requestDirectorySelection(): Promise<FileSystemDirectoryHandle | null> {
        try {
            const handle = await window.showDirectoryPicker();
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
        const persistedData = await this._persistenceService.retrieveHandleFromStorage();

        if (persistedData && await this._verifyPermission(persistedData.handle)) {
            this._directoryHandle = persistedData.handle;
            this._logicalPath = persistedData.handle.name;
            this._originalSelectionName = persistedData.originalName;
            return persistedData.handle;
        }

        return null;
    }

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

    public get currentFolderName(): string | null {
        return this._directoryHandle?.name ?? null;
    }

    public get fullLogicalPath(): string {
        return this._logicalPath;
    }

    public get originalSelectionName(): string {
        return this._originalSelectionName;
    }

    private async _handleSuccessfulSelection(handle: FileSystemDirectoryHandle): Promise<void> {
        this._originalSelectionName = handle.name;
        const { statsHandle, path } = await this._discoverStatsFolder(handle);
        this._directoryHandle = statsHandle;
        this._logicalPath = path;
        await this._persistenceService.saveHandleToStorage(statsHandle, this._originalSelectionName);
    }

    /**
     * Attempts to find a 'stats' directory within the provided handle by following the known suffix.
     * Targets: steamapps \ common \ FPSAimTrainer \ FPSAimTrainer \ stats
     */
    private async _discoverStatsFolder(handle: FileSystemDirectoryHandle): Promise<{ statsHandle: FileSystemDirectoryHandle, path: string }> {
        const currentName = handle.name.toLowerCase();
        const parts = DirectoryAccessService._KOVAAKS_STATS_PATH_PARTS;

        const potentialIndices = parts
            .map((part, index) => part.toLowerCase() === currentName ? index : -1)
            .filter(index => index !== -1);

        if (potentialIndices.length === 0) {
            return { statsHandle: handle, path: handle.name };
        }

        for (const startIndex of potentialIndices) {
            let current = handle;
            let pathSegments = [handle.name];
            let isValidPath = true;

            for (let i = startIndex + 1; i < parts.length; i++) {
                try {
                    current = await current.getDirectoryHandle(parts[i]);
                    pathSegments.push(parts[i]);
                } catch {
                    isValidPath = false;
                    break;
                }
            }

            if (isValidPath) {
                return { statsHandle: current, path: pathSegments.join(" \\ ") };
            }
        }

        return { statsHandle: handle, path: handle.name };
    }

    private async _verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
        const permissionStatus = await handle.queryPermission({ mode: "read" });
        return permissionStatus === "granted";
    }

    private _handlePickerError(error: unknown): void {
        const isAbortError = error instanceof Error && error.name === "AbortError";

        if (!isAbortError) {
            console.error("Critical Failure in Directory Access Service:", error);
        }
    }
}
