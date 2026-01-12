import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from "vitest";
import { DirectoryAccessService } from "../DirectoryAccessService";
import { DirectoryAccessPersistenceService } from "../DirectoryAccessPersistenceService";
import { createMockDirectoryStructure, MockFileSystemDirectoryHandle, MockDirectoryStructure } from "../../test/mocks/fileSystemMocks";

describe("DirectoryAccessService Selection", (): void => {
    let service: DirectoryAccessService;

    beforeEach(async (): Promise<void> => {
        service = new DirectoryAccessService();
        await service.clearStoredHandle();
        const root: MockFileSystemDirectoryHandle = _getMockRootHandle();
        vi.stubGlobal("showDirectoryPicker", async (): Promise<MockFileSystemDirectoryHandle> => root);
    });

    afterEach((): void => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("should discover the deep stats folder", async (): Promise<void> => {
        const handle: FileSystemDirectoryHandle | null = await service.requestDirectorySelection();
        expect(handle?.name).toBe("stats");
        expect(service.fullLogicalPath).toContain("steamapps \\ common \\ FPSAimTrainer");
    });

    it("should fallback to root if stats folder is not found", async (): Promise<void> => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const simple: MockFileSystemDirectoryHandle = createMockDirectoryStructure("just-a-folder", { "file.txt": "file" });
        /* eslint-enable @typescript-eslint/naming-convention */
        vi.stubGlobal("showDirectoryPicker", async (): Promise<MockFileSystemDirectoryHandle> => simple);
        const handle: FileSystemDirectoryHandle | null = await service.requestDirectorySelection();
        expect(handle?.name).toBe("just-a-folder");
    });
});

describe("DirectoryAccessService Persistence", (): void => {
    let service: DirectoryAccessService;

    beforeEach(async (): Promise<void> => {
        service = new DirectoryAccessService();
        await service.clearStoredHandle();
    });

    it("should auto-reconnect using persistence", async (): Promise<void> => {
        const mock: MockFileSystemDirectoryHandle = new MockFileSystemDirectoryHandle("stats");
        const spy: MockInstance = vi.spyOn(DirectoryAccessPersistenceService.prototype, "retrieveHandleFromStorage").mockResolvedValue({
            handle: mock as unknown as FileSystemDirectoryHandle,
            originalName: "stats"
        });
        const reconnected: FileSystemDirectoryHandle | null = await service.attemptReconnection();
        expect(reconnected?.name).toBe("stats");
        expect(spy).toHaveBeenCalled();
    });

    it("should clear stored handle", async (): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const access: { _persistenceService: DirectoryAccessPersistenceService } = service as unknown as { _persistenceService: DirectoryAccessPersistenceService };
        const spy: MockInstance = vi.spyOn(access._persistenceService, "clearHandleFromStorage");
        await service.clearStoredHandle();
        expect(spy).toHaveBeenCalled();
    });
});

function _getMockRootHandle(): MockFileSystemDirectoryHandle {
    /* eslint-disable @typescript-eslint/naming-convention */
    const mockStructure: MockDirectoryStructure = {
        "steamapps": {
            "common": {
                "FPSAimTrainer": {
                    "FPSAimTrainer": {
                        "stats": { "score_1.csv": "file", "score_2.csv": "file" }
                    }
                }
            }
        },
        "otherGame": {}
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    return createMockDirectoryStructure("steam-library", mockStructure);
}
