/**
 * Type definitions for the File System Access API.
 * These are required because the standard DOM library does not yet include these experimental APIs.
 */

export { };

declare global {
    interface FileSystemHandle {
        readonly kind: "file" | "directory";
        readonly name: string;
        queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionStatus>;
        requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionStatus>;
    }

    interface FileSystemDirectoryHandle extends FileSystemHandle {
        readonly kind: "directory";
    }

    interface FileSystemFileHandle extends FileSystemHandle {
        readonly kind: "file";
    }

    interface FileSystemHandlePermissionDescriptor {
        mode?: "read" | "readwrite";
    }

    type PermissionStatus = "granted" | "denied" | "prompt";

    interface DirectoryPickerOptions {
        id?: string;
        mode?: "read" | "readwrite";
        startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | FileSystemHandle;
    }

    interface Window {
        showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
    }
}
