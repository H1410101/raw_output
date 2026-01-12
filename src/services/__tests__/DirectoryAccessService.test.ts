import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectoryAccessService } from '../DirectoryAccessService';
import { DirectoryAccessPersistenceService } from '../DirectoryAccessPersistenceService';
import { createMockDirectoryStructure, MockFileSystemDirectoryHandle } from '../../test/mocks/fileSystemMocks';

describe('DirectoryAccessService', () => {
    let service: DirectoryAccessService;

    // A mock folder structure simulating a typical User scenario
    const mockStructure = {
        "steamapps": {
            "common": {
                "FPSAimTrainer": {
                    "FPSAimTrainer": {
                        "stats": {
                            "score_1.csv": "file",
                            "score_2.csv": "file"
                        }
                    }
                }
            }
        },
        "OtherGame": {}
    };

    const rootHandle = createMockDirectoryStructure("steam-library", mockStructure);

    beforeEach(async () => {
        service = new DirectoryAccessService();
        await service.clearStoredHandle();

        // MOCK window.showDirectoryPicker
        vi.stubGlobal('showDirectoryPicker', async () => {
            return rootHandle;
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should discover the deep stats folder when a parent is selected (data.conn.int.suffix)', async () => {
        const handle = await service.requestDirectorySelection();

        expect(handle).not.toBeNull();
        expect(handle?.name).toBe('stats'); // Should return the *stats* folder, not root
        expect(service.currentFolderName).toBe('stats');
        // Check full logical path has the traversal
        expect(service.fullLogicalPath).toContain('steamapps \\ common \\ FPSAimTrainer');
    });

    it('should fallback to root if stats folder is not found', async () => {
        const simpleRoot = createMockDirectoryStructure("just-a-folder", { "file.txt": "file" });
        vi.stubGlobal('showDirectoryPicker', async () => {
            return simpleRoot;
        });

        const handle = await service.requestDirectorySelection();
        expect(handle?.name).toBe('just-a-folder');
        expect(service.fullLogicalPath).toBe('just-a-folder');
    });

    it('should auto-reconnect using persistence (data.conn.ext.reconnect)', async () => {
        // Mock the persistence retrieval on the PROTOTYPE to return a Functional Mock Object
        // We use 'stats' as the name to simulate a previously found stats folder
        const mockSavedHandle = new MockFileSystemDirectoryHandle('stats');

        const spy = vi.spyOn(
            DirectoryAccessPersistenceService.prototype,
            'retrieveHandleFromStorage'
        ).mockResolvedValue({
            handle: mockSavedHandle as unknown as FileSystemDirectoryHandle,
            originalName: 'stats'
        });

        // 2. Simulate App Restart (New Service Instance)
        const newService = new DirectoryAccessService();
        const reconnectedHandle = await newService.attemptReconnection();

        expect(reconnectedHandle).not.toBeNull();
        expect(reconnectedHandle?.name).toBe('stats');

        // Ensure our spy was actually called
        expect(spy).toHaveBeenCalled();
    });

    it('should clear stored handle', async () => {
        // We spy on the instance for this one, as we just want to verify the call
        const spy = vi.spyOn((service as any)._persistenceService, 'clearHandleFromStorage');

        service.clearStoredHandle();

        expect(service.currentFolderName).toBeNull();
        expect(spy).toHaveBeenCalled();
    });
});
