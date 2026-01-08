/**
 * Service for persisting and retrieving directory handles using IndexedDB.
 */
export class DirectoryAccessPersistenceService {
  private readonly _databaseName: string = "RawOutputStorage";
  private readonly _storeName: string = "DirectoryHandles";
  private readonly _key: string = "activeDirectoryHandle";
  private readonly _originalNameKey: string = "originalSelectionName";

  /**
   * Saves a directory handle and its original selection name to storage.
   *
   * @param directoryHandle - The handle to the directory.
   * @param originalName - The original name of the directory selection.
   */
  public async saveHandleToStorage(
    directoryHandle: FileSystemDirectoryHandle,
    originalName: string,
  ): Promise<void> {
    const database = await this._openDatabaseConnection();
    const transaction = database.transaction(this._storeName, "readwrite");
    const objectStore = transaction.objectStore(this._storeName);

    objectStore.put(directoryHandle, this._key);
    objectStore.put(originalName, this._originalNameKey);

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
      },
    );
  }

  /**
   * Retrieves the previously saved directory handle and original name.
   *
   * @returns The handle and name if found, or null otherwise.
   */
  public async retrieveHandleFromStorage(): Promise<{
    handle: FileSystemDirectoryHandle;
    originalName: string;
  } | null> {
    const database = await this._openDatabaseConnection();
    const transaction = database.transaction(this._storeName, "readonly");
    const objectStore = transaction.objectStore(this._storeName);

    const handleRequest = objectStore.get(this._key);
    const nameRequest = objectStore.get(this._originalNameKey);

    return new Promise(
      (
        resolve: (
          value: {
            handle: FileSystemDirectoryHandle;
            originalName: string;
          } | null,
        ) => void,
        reject: (reason: unknown) => void,
      ): void => {
        transaction.oncomplete = (): void =>
          this._resolveStoredHandle(handleRequest, nameRequest, resolve);

        transaction.onerror = (): void => reject(transaction.error);
      },
    );
  }

  private _resolveStoredHandle(
    handleRequest: IDBRequest,
    nameRequest: IDBRequest,
    resolve: (
      value: { handle: FileSystemDirectoryHandle; originalName: string } | null,
    ) => void,
  ): void {
    const handle: FileSystemDirectoryHandle | undefined =
      handleRequest.result as FileSystemDirectoryHandle | undefined;

    const originalName: string | undefined = nameRequest.result as
      | string
      | undefined;

    if (handle && originalName) {
      resolve({ handle, originalName });
    } else {
      resolve(null);
    }
  }

  /**
   * Clears any saved directory handle information from storage.
   */
  public async clearHandleFromStorage(): Promise<void> {
    const database = await this._openDatabaseConnection();
    const transaction = database.transaction(this._storeName, "readwrite");
    const objectStore = transaction.objectStore(this._storeName);

    objectStore.delete(this._key);
    objectStore.delete(this._originalNameKey);

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
      },
    );
  }

  private async _openDatabaseConnection(): Promise<IDBDatabase> {
    const request = indexedDB.open(this._databaseName, 1);

    request.onupgradeneeded = (): void => {
      const database = request.result;
      database.createObjectStore(this._storeName);
    };

    return new Promise(
      (
        resolve: (value: IDBDatabase) => void,
        reject: (reason: unknown) => void,
      ): void => {
        request.onsuccess = (): void => resolve(request.result);
        request.onerror = (): void => reject(request.error);
      },
    );
  }
}
