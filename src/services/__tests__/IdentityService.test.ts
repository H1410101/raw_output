import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityService } from "../IdentityService";
import { HistoryService } from "../HistoryService";
import { PlayerProfile } from "../../types/PlayerTypes";

const PROFILES_KEY = "raw_output_player_profiles";
const ACTIVE_KEY = "raw_output_active_username";

beforeEach((): void => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("IdentityService visible profiles", (): void => {
    it("does not treat soft-deleted profiles as linked or active", (): void => {
        _storeProfiles([{ ..._profile("Deleted"), deletedAt: new Date().toISOString() }], "Deleted");

        const service = new IdentityService();

        expect(service.hasLinkedAccount()).toBe(false);
        expect(service.getActiveProfile()).toBeNull();
        expect(service.getKovaaksUsername()).toBeNull();
    });

    it("canonicalizes case and refuses corrupt profile storage", (): void => {
        _storeProfiles([_profile("Alpha"), _profile("Beta")], "Alpha");
        const service = new IdentityService();
        service.setActiveProfile("bEtA");

        expect(service.getActiveProfile()?.username).toBe("Beta");

        localStorage.setItem(PROFILES_KEY, JSON.stringify({ username: "invalid" }));
        expect(new IdentityService().getProfiles()).toEqual([]);
    });

    it("sanitizes avatar URLs at both storage boundaries", (): void => {
        _storeProfiles([{ ..._profile("Stored"), pfpUrl: "javascript:alert(1)" }], "Stored");
        const service = new IdentityService();

        expect(service.getActiveProfile()?.pfpUrl).toBe("");

        service.addProfile({ ..._profile("Added"), pfpUrl: "data:text/html,unsafe" });
        expect(service.getActiveProfile()?.pfpUrl).toBe("");
        expect(_storedProfiles().find((profile: PlayerProfile): boolean => profile.username === "Added")?.pfpUrl)
            .toBe("");
    });
});

describe("IdentityService analytics consent", (): void => {
    it("notifies this tab when another tab opts out", (): void => {
        localStorage.setItem("raw_output_analytics_consent", "true");
        const service = new IdentityService();
        const listener = vi.fn();
        service.onAnalyticsConsentChanged(listener);

        localStorage.setItem("raw_output_analytics_consent", "false");
        window.dispatchEvent(new StorageEvent("storage", {
            key: "raw_output_analytics_consent",
            newValue: "false",
        }));

        expect(service.isAnalyticsEnabled()).toBe(false);
        expect(listener).toHaveBeenCalledWith(false);
    });
});

describe("IdentityService retention", (): void => {
    it("keeps retry metadata after deletion failure and purges all profile state on success", async (): Promise<void> => {
        const deletedProfile: PlayerProfile = {
            ..._profile("Expired"),
            deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        };
        _storeProfiles([deletedProfile], null);
        _storeProfileState(deletedProfile.username);
        const service = new IdentityService();
        const deletePlayerData = vi.fn().mockRejectedValueOnce(new Error("temporary failure"));
        const history = { deletePlayerData } as unknown as HistoryService;

        await expect(service.performRetentionCleanup(history)).rejects.toThrow("temporary failure");
        expect(_storedProfiles()).toHaveLength(1);

        deletePlayerData.mockResolvedValueOnce(undefined);
        await service.performRetentionCleanup(history);

        expect(deletePlayerData).toHaveBeenLastCalledWith(
            "Expired",
            "steam-Expired",
            expect.any(Function),
        );
        expect(_storedProfiles()).toEqual([]);
        expect(localStorage.getItem("session_service_state_expired")).toBeNull();
        expect(localStorage.getItem("rank_identity_state_v2_expired")).toBeNull();
    });

    it("does not remove a profile reactivated while cleanup is pending", _keepsReactivatedProfile);
    it("preserves actual history when reactivated before deletion starts", _preservesReactivatedHistory);
    it("cancels cleanup when another tab reactivates the profile", _handlesCrossTabReactivation);
    it("revalidates earlier deletions before finalizing a cleanup batch", _revalidatesCleanupBatch);
});

async function _keepsReactivatedProfile(): Promise<void> {
    const deletedProfile: PlayerProfile = {
        ..._profile("Expired"),
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    _storeProfiles([deletedProfile], null);
    const service = new IdentityService();
    let resolveDeletion: () => void = (): void => undefined;
    const deletePlayerData = vi.fn((): Promise<void> => new Promise((resolve): void => {
        resolveDeletion = resolve;
    }));

    const cleanup: Promise<void> = service.performRetentionCleanup(
        { deletePlayerData } as unknown as HistoryService,
    );
    await vi.waitFor((): void => expect(deletePlayerData).toHaveBeenCalledOnce());
    service.addProfile(_profile("Expired"));
    resolveDeletion();
    await cleanup;

    expect(service.getActiveProfile()?.username).toBe("Expired");
    expect(_storedProfiles()).toHaveLength(1);
    expect(_storedProfiles()[0].deletedAt).toBeUndefined();
}

async function _preservesReactivatedHistory(): Promise<void> {
    const username = "Concurrent";
    const deletedProfile: PlayerProfile = {
        ..._profile(username),
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    _storeProfiles([deletedProfile], null);
    const service = new IdentityService();
    const history = new HistoryService();
    await history.updateHighscore(username, "Scenario A", 1234);
    await history.recordScore(username, "Scenario A", 1200, 1000);

    const cleanup: Promise<void> = service.performRetentionCleanup(history);
    service.addProfile(_profile(username));
    await cleanup;

    expect(await history.getHighscore(username, "Scenario A")).toBe(1234);
    expect(await history.getLastScores(username, "Scenario A")).toEqual([
        { score: 1200, timestamp: 1000 },
    ]);
    await history.deletePlayerData(username, deletedProfile.steamId);
}

async function _handlesCrossTabReactivation(): Promise<void> {
    const deletedProfile: PlayerProfile = {
        ..._profile("CrossTab"),
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    _storeProfiles([deletedProfile], null);
    const service = new IdentityService();
    let deletionGuard: () => boolean = (): boolean => true;
    let resolveDeletion: () => void = (): void => undefined;
    const deletePlayerData = vi.fn((
        _username: string,
        _steamId: string,
        shouldDelete: () => boolean,
    ): Promise<void> => {
        deletionGuard = shouldDelete;

        return new Promise((resolve): void => {
            resolveDeletion = resolve;
        });
    });

    const cleanup = service.performRetentionCleanup({ deletePlayerData } as unknown as HistoryService);
    await vi.waitFor((): void => expect(deletePlayerData).toHaveBeenCalledOnce());
    const activeProfile = _profile("CrossTab");
    _dispatchProfilesStorage([activeProfile]);

    expect(deletionGuard()).toBe(false);
    resolveDeletion();
    await cleanup;
    expect(service.getProfiles()).toEqual([activeProfile]);
}

async function _revalidatesCleanupBatch(): Promise<void> {
    const firstDeleted = _expiredProfile("First");
    const secondDeleted = _expiredProfile("Second");
    _storeProfiles([firstDeleted, secondDeleted], null);
    const service = new IdentityService();
    let resolveSecondDeletion: () => void = (): void => undefined;
    const deletePlayerData = vi.fn((username: string): Promise<void> => username === "Second"
        ? new Promise((resolve): void => { resolveSecondDeletion = resolve; })
        : Promise.resolve());

    const cleanup = service.performRetentionCleanup({ deletePlayerData } as unknown as HistoryService);
    await vi.waitFor((): void => expect(deletePlayerData).toHaveBeenCalledTimes(2));
    const reactivatedProfile: PlayerProfile = _profile("First");
    _dispatchProfilesStorage([reactivatedProfile, secondDeleted]);
    resolveSecondDeletion();
    await cleanup;

    expect(service.getProfiles()).toEqual([reactivatedProfile]);
    expect(_storedProfiles()).toEqual([reactivatedProfile]);
}

function _expiredProfile(username: string): PlayerProfile {
    return {
        ..._profile(username),
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
}

function _dispatchProfilesStorage(profiles: PlayerProfile[]): void {
    const serializedProfiles: string = JSON.stringify(profiles);
    localStorage.setItem(PROFILES_KEY, serializedProfiles);
    window.dispatchEvent(new StorageEvent("storage", {
        key: PROFILES_KEY,
        newValue: serializedProfiles,
    }));
}

function _profile(username: string): PlayerProfile {
    return { username, pfpUrl: `https://example.test/${username}.png`, steamId: `steam-${username}` };
}

function _storeProfiles(profiles: PlayerProfile[], activeUsername: string | null): void {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    if (activeUsername) localStorage.setItem(ACTIVE_KEY, activeUsername);
}

function _storedProfiles(): PlayerProfile[] {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "[]") as PlayerProfile[];
}

function _storeProfileState(username: string): void {
    const suffix: string = username.toLowerCase();
    ["raw_output_app_state", "session_service_state", "ranked_session_state_v2",
        "rank_identity_state_v2", "rank_penalty_lift_date"].forEach(
        (prefix: string): void => localStorage.setItem(`${prefix}_${suffix}`, "persisted"),
    );
}
