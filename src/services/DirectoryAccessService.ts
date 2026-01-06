import { DirectoryAccessPersistenceService } from "./DirectoryAccessPersistenceService";

/**
 * Service responsible for interacting with the Browser File System Access API.
 * Responsibility: Securely request, verify, and manage folder handles.
 */
export class DirectoryAccessService {
    private readonly _persistenceService: DirectoryAccessPersistenceService;
    private _directoryHandle: FileSystemDirectoryHandle | null = null;

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
            return handle;
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
        const persistedHandle = await this._persistenceService.retrieveHandleFromStorage();

        if (persistedHandle && await this._verifyPermission(persistedHandle)) {
            this._directoryHandle = persistedHandle;
            return persistedHandle;
        }

        return null;
    }

    public get currentFolderName(): string | null {
        return this._directoryHandle?.name ?? null;
    }

    private async _handleSuccessfulSelection(handle: FileSystemDirectoryHandle): Promise<void> {
        this._directoryHandle = handle;
        await this._persistenceService.saveHandleToStorage(handle);
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
