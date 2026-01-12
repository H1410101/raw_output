export class MockFileSystemHandle {
    public kind: 'file' | 'directory';
    public name: string;

    constructor(kind: 'file' | 'directory', name: string) {
        this.kind = kind;
        this.name = name;
    }

    public async queryPermission(_descriptor: any): Promise<PermissionState> {
        return 'granted';
    }
}

export class MockFileSystemFileHandle extends MockFileSystemHandle {
    constructor(name: string) {
        super('file', name);
    }

    public async getFile(): Promise<File> {
        return new File([], this.name);
    }
}

export class MockFileSystemDirectoryHandle extends MockFileSystemHandle {
    private _children: Map<string, MockFileSystemHandle> = new Map();

    constructor(name: string, children: MockFileSystemHandle[] = []) {
        super('directory', name);
        children.forEach(child => this._children.set(child.name, child));
    }

    public async getDirectoryHandle(name: string, options?: any): Promise<MockFileSystemDirectoryHandle> {
        const child = this._children.get(name);
        if (!child || child.kind !== 'directory') {
            if (options?.create) {
                const newDir = new MockFileSystemDirectoryHandle(name);
                this._children.set(name, newDir);
                return newDir;
            }
            throw new Error(`Directory not found: ${name}`);
        }
        return child as MockFileSystemDirectoryHandle;
    }

    public async getFileHandle(name: string, options?: any): Promise<MockFileSystemFileHandle> {
        const child = this._children.get(name);
        if (!child || child.kind !== 'file') {
            if (options?.create) {
                const newFile = new MockFileSystemFileHandle(name);
                this._children.set(name, newFile);
                return newFile;
            }
            throw new Error(`File not found: ${name}`);
        }
        return child as MockFileSystemFileHandle;
    }

    public async *values(): AsyncGenerator<MockFileSystemHandle> {
        for (const child of this._children.values()) {
            yield child;
        }
    }
}

/**
 * Helper to build a deep directory structure from a simplified object definition.
 * Example:
 * {
 *   "steamapps": {
 *     "common": {
 *       "FPSAimTrainer": { ... }
 *     }
 *   }
 * }
 */
export function createMockDirectoryStructure(name: string, structure: any): MockFileSystemDirectoryHandle {
    const children: MockFileSystemHandle[] = [];

    for (const key in structure) {
        const value = structure[key];
        if (value === null || typeof value !== 'object' || Object.keys(value).length === 0 && value.constructor === Object) {
            if (value === 'file') {
                children.push(new MockFileSystemFileHandle(key));
            } else {
                // Empty directory
                children.push(new MockFileSystemDirectoryHandle(key));
            }
        } else {
            children.push(createMockDirectoryStructure(key, value));
        }
    }

    return new MockFileSystemDirectoryHandle(name, children);
}
