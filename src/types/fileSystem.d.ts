/**
 * Type definitions for the File System Access API.
 * These are required because the standard DOM library does not yet include these experimental APIs.
 */

export { };

declare global {
    interface Window {
        showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
    }

    interface DirectoryPickerOptions {
        id?: string;
        mode?: "read" | "readwrite";
        startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | FileSystemHandle;
    }
}
