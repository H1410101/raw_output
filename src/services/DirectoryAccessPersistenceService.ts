export class DirectoryAccessPersistenceService {
    private readonly _databaseName: string = "RawOutputStorage";
    private readonly _storeName: string = "DirectoryHandles";
    private readonly _key: string = "activeDirectoryHandle";
    private readonly _originalNameKey: string = "originalSelectionName";

    public async saveHandleToStorage(directoryHandle: FileSystemDirectoryHandle, originalName: string): Promise<void> {
        const database = await this._openDatabaseConnection();
        const transaction = database.transaction(this._storeName, "readwrite");
        const objectStore = transaction.objectStore(this._storeName);

        objectStore.put(directoryHandle, this._key);
        objectStore.put(originalName, this._originalNameKey);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    public async retrieveHandleFromStorage(): Promise<{ handle: FileSystemDirectoryHandle; originalName: string } | null> {
        const database = await this._openDatabaseConnection();
        const transaction = database.transaction(this._storeName, "readonly");
        const objectStore = transaction.objectStore(this._storeName);

        const handleRequest = objectStore.get(this._key);
        const nameRequest = objectStore.get(this._originalNameKey);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                const handle = handleRequest.result;
                const originalName = nameRequest.result;

                if (handle && originalName) {
                    resolve({ handle, originalName });
                } else {
                    resolve(null);
                }
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    private async _openDatabaseConnection(): Promise<IDBDatabase> {
        const request = indexedDB.open(this._databaseName, 1);

        request.onupgradeneeded = () => {
            const database = request.result;
            database.createObjectStore(this._storeName);
        };

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
