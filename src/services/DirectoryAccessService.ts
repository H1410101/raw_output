/**
 * Service responsible for interacting with the Browser File System Access API.
 * Responsibility: Securely request and manage folder handles.
 */

export class DirectoryAccessService {
    private _directoryHandle: FileSystemDirectoryHandle | null = null;

    /**
     * Reconfirm the folder selection and return the directory handle.
     * @returns A promise that resolves to the directory handle or null if cancelled.
     */
    public async requestDirectoryLink(): Promise<FileSystemDirectoryHandle | null> {
        try {
            this._directoryHandle = await window.showDirectoryPicker();
            return this._directoryHandle;
        } catch (error) {
            this._handlePickerError(error);
            return null;
        }
    }

    public get currentFolderName(): string | null {
        return this._directoryHandle?.name ?? null;
    }

    private _handlePickerError(error: unknown): void {
        const isAbortError = error instanceof Error && error.name === "AbortError";

        if (!isAbortError) {
            console.error("Critical Failure in Directory Access Service:", error);
        }
    }
}
