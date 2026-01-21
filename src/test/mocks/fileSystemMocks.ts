/**
 * Base mock class for FileSystemHandle.
 */
export class MockFileSystemHandle {
    public readonly kind: "file" | "directory";
    public readonly name: string;

    /**
     * Initializes the handle.
     *
     * @param kind - The type of handle.
     * @param name - The name of the file or directory.
     */
    public constructor(kind: "file" | "directory", name: string) {
        this.kind = kind;
        this.name = name;
    }

    /**
     * Mocks the permission query.
     *
     * @param _descriptor - Unused permission descriptor.
     * @returns A promise resolving to 'granted'.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async queryPermission(_descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState> {
        return "granted";
    }
}

/**
 * Mock implementation of FileSystemFileHandle.
 */
export class MockFileSystemFileHandle extends MockFileSystemHandle {
    /**
     * Initializes the file handle.
     *
     * @param name - The name of the file.
     */
    public constructor(name: string) {
        super("file", name);
    }

    /**
     * Mocks getting the file.
     *
     * @returns A promise resolving to a File object.
     */
    public async getFile(): Promise<File> {
        return new File([], this.name);
    }
}

/**
 * Mock implementation of FileSystemDirectoryHandle.
 */
export class MockFileSystemDirectoryHandle extends MockFileSystemHandle {
    private readonly _children: Map<string, MockFileSystemHandle> = new Map();

    /**
     * Initializes the directory handle.
     *
     * @param name - The name of the directory.
     * @param children - Initial children of the directory.
     */
    public constructor(name: string, children: MockFileSystemHandle[] = []) {
        super("directory", name);
        children.forEach((child: MockFileSystemHandle): void => {
            this._children.set(child.name, child);
        });
    }

    /**
     * Mocks getting a directory handle.
     *
     * @param name - Name of the directory.
     * @param options - Options for retrieval.
     * @returns A promise resolving to the directory handle.
     */
    public async getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<MockFileSystemDirectoryHandle> {
        const child: MockFileSystemHandle | undefined = this._children.get(name);
        if (!child || child.kind !== "directory") {
            if (options?.create) {
                const newDir: MockFileSystemDirectoryHandle = new MockFileSystemDirectoryHandle(name);
                this._children.set(name, newDir);

                return newDir;
            }
            throw new Error(`Directory not found: ${name}`);
        }

        return child as MockFileSystemDirectoryHandle;
    }

    /**
     * Mocks getting a file handle.
     *
     * @param name - Name of the file.
     * @param options - Options for retrieval.
     * @returns A promise resolving to the file handle.
     */
    public async getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<MockFileSystemFileHandle> {
        const child: MockFileSystemHandle | undefined = this._children.get(name);
        if (!child || child.kind !== "file") {
            if (options?.create) {
                const newFile: MockFileSystemFileHandle = new MockFileSystemFileHandle(name);
                this._children.set(name, newFile);

                return newFile;
            }
            throw new Error(`File not found: ${name}`);
        }

        return child as MockFileSystemFileHandle;
    }

    /**
     * Mocks the values iterator.
     *
     * @returns An async generator of handles.
     */
    public async *values(): AsyncGenerator<MockFileSystemHandle> {
        for (const child of this._children.values()) {
            yield child;
        }
    }
}

/**
 * Simplified structure for defining mock directories.
 */
export interface MockDirectoryStructure {
    [name: string]: MockDirectoryStructure | "file" | null;
}

/**
 * Helper to build a deep directory structure from a simplified object definition.
 *
 * @param name - The name of the root directory.
 * @param structure - The nested structure definition.
 * @returns A fully populated MockFileSystemDirectoryHandle.
 */
export function createMockDirectoryStructure(
    name: string,
    structure: MockDirectoryStructure
): MockFileSystemDirectoryHandle {
    const children: MockFileSystemHandle[] = [];

    for (const key in structure) {
        if (!Object.prototype.hasOwnProperty.call(structure, key)) {
            continue;
        }

        const value: MockDirectoryStructure | "file" | null = structure[key];
        if (value === "file") {
            children.push(new MockFileSystemFileHandle(key));
        } else if (value === null || typeof value !== "object" || Object.keys(value).length === 0) {
            children.push(new MockFileSystemDirectoryHandle(key));
        } else {
            // Need a cast here because the type system doesn't know 'value' is MockDirectoryStructure
            children.push(createMockDirectoryStructure(key, value as MockDirectoryStructure));
        }
    }

    return new MockFileSystemDirectoryHandle(name, children);
}
