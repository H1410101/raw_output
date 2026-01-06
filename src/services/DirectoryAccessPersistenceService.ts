export class DirectoryAccessPersistenceService {
    private readonly _databaseName: string = "RawOutputStorage";
    private readonly _storeName: string = "DirectoryHandles";
    private readonly _key: string = "activeDirectoryHandle";

    public async saveHandleToStorage(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
        const database = await this._openDatabaseConnection();
        const transaction = database.transaction(this._storeName, "readwrite");
        const objectStore = transaction.objectStore(this._storeName);

        objectStore.put(directoryHandle, this._key);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    public async retrieveHandleFromStorage(): Promise<FileSystemDirectoryHandle | null> {
        const database = await this._openDatabaseConnection();
        const transaction = database.transaction(this._storeName, "readonly");
        const objectStore = transaction.objectStore(this._storeName);

        const request = objectStore.get(this._key);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
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
