import { describe, it, expect, beforeEach } from 'vitest';
import { DirectoryAccessPersistenceService } from '../DirectoryAccessPersistenceService';
import { MockFileSystemDirectoryHandle } from '../../test/mocks/fileSystemMocks';

describe('DirectoryAccessPersistenceService', () => {
    let service: DirectoryAccessPersistenceService;

    beforeEach(async () => {
        service = new DirectoryAccessPersistenceService();
        // Clean up IDB before each test
        await service.clearHandleFromStorage();
    });

    it('should save and retrieve a directory handle', async () => {
        const mockHandle = new MockFileSystemDirectoryHandle('test-dir') as unknown as FileSystemDirectoryHandle;
        const originalName = 'My Test Folder';

        await service.saveHandleToStorage(mockHandle, originalName);

        const retrieved = await service.retrieveHandleFromStorage();

        expect(retrieved).not.toBeNull();
        if (retrieved) {
            expect(retrieved.handle.name).toBe('test-dir');
            expect(retrieved.originalName).toBe(originalName);
        }
    });

    it('should return null if no handle is stored', async () => {
        await service.clearHandleFromStorage();
        const retrieved = await service.retrieveHandleFromStorage();
        expect(retrieved).toBeNull();
    });

    it('should effectively clear the storage', async () => {
        const mockHandle = new MockFileSystemDirectoryHandle('temp-dir') as unknown as FileSystemDirectoryHandle;
        await service.saveHandleToStorage(mockHandle, 'Temp');

        await service.clearHandleFromStorage();

        const retrieved = await service.retrieveHandleFromStorage();
        expect(retrieved).toBeNull();
    });
});
