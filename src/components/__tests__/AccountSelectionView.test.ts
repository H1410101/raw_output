/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AccountSelectionView } from "../../views/AccountSelectionView";
import { AudioService } from "../../services/AudioService";
import { IdentityService } from "../../services/IdentityService";
import { KovaaksApiService } from "../../services/KovaaksApiService";
import { KovaaksUserSearchResult } from "../../types/KovaaksApiTypes";
import { PlayerProfile } from "../../types/PlayerTypes";

type SearchImplementation = (query: string) => Promise<KovaaksUserSearchResult[]>;

interface AccountViewHarness {
    container: HTMLElement;
    searchUsers: Mock<SearchImplementation>;
    addProfile: Mock<(profile: PlayerProfile) => void>;
    onProfileSelected: Mock<(profile: PlayerProfile) => void>;
}

describe("AccountSelectionView", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.replaceChildren();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.replaceChildren();
    });

    it("renders profile fields as text and assigns only HTTP avatar URLs", () => {
        const hostileUsername = `bad" onerror="alert(1)"><script id="profile-injection"></script>`;
        const hostileProfile: PlayerProfile = {
            username: hostileUsername,
            pfpUrl: "data:image/svg+xml,<svg onload=alert(1)></svg>",
            steamId: "hostile-steam-id"
        };
        const safeProfile: PlayerProfile = {
            username: "Safe profile",
            pfpUrl: "https://cdn.example.test/safe-avatar.png",
            steamId: "safe-steam-id"
        };
        const harness = _renderView({
            profiles: [hostileProfile, safeProfile],
            activeUsername: hostileUsername
        });

        const images = Array.from(harness.container.querySelectorAll<HTMLImageElement>(".carousel-pfp"));
        const hostileImage = images.find(image => image.alt === hostileUsername);
        const safeImages = images.filter(image => image.alt === safeProfile.username);
        const hostileNode = hostileImage?.closest(".pfp-item");

        expect(hostileImage).toBeDefined();
        expect(hostileImage?.hasAttribute("src")).toBe(false);
        expect(hostileImage?.hasAttribute("onerror")).toBe(false);
        expect(safeImages.length).toBeGreaterThan(0);
        safeImages.forEach(image => {
            expect(image.src).toBe("https://cdn.example.test/safe-avatar.png");
        });
        expect(harness.container.querySelector("#profile-injection")).toBeNull();
        expect(harness.container.querySelector("[onerror]")).toBeNull();
        expect(harness.container.querySelector(".active-profile-name.current")?.textContent)
            .toBe(hostileUsername);
        expect(hostileNode?.children).toHaveLength(2);
        expect(hostileNode?.querySelector(":scope > .pfp-delete-btn > .button-fill")).not.toBeNull();
        expect(hostileNode?.querySelector(":scope > .pfp-delete-btn > svg > path")).not.toBeNull();
    });

    it("invalidates immediately and keeps the newest out-of-order response", async () => {
        const first = _createDeferred<KovaaksUserSearchResult[]>();
        const second = _createDeferred<KovaaksUserSearchResult[]>();
        const third = _createDeferred<KovaaksUserSearchResult[]>();
        const harness = _renderView({
            searchImplementation: (query) => {
                if (query === "first") return first.promise;
                if (query === "second") return second.promise;

                return third.promise;
            }
        });

        _enterQuery(harness.container, "first");
        await vi.advanceTimersByTimeAsync(300);
        _enterQuery(harness.container, "second");

        first.resolve([_createResult("Stale before debounce")]);
        await _flushPromises();
        expect(harness.container.querySelector(".carousel-pfp")).toBeNull();

        await vi.advanceTimersByTimeAsync(300);
        _enterQuery(harness.container, "third");
        await vi.advanceTimersByTimeAsync(300);

        third.resolve([_createResult("Newest result")]);
        await _flushPromises();
        expect(_renderedUsernames(harness.container)).toEqual(["Newest result"]);

        second.resolve([_createResult("Stale out of order")]);
        await _flushPromises();
        expect(_renderedUsernames(harness.container)).toEqual(["Newest result"]);
    });

    it("replaces equal-cardinality result sets without retaining old cards", async () => {
        const harness = _renderView({ searchImplementation: async () => [] });
        harness.searchUsers
            .mockResolvedValueOnce([_createResult("First result")])
            .mockResolvedValueOnce([_createResult("Replacement result")]);

        _enterQuery(harness.container, "first");
        await vi.advanceTimersByTimeAsync(300);
        expect(_renderedUsernames(harness.container)).toEqual(["First result"]);

        _enterQuery(harness.container, "replacement");
        await vi.advanceTimersByTimeAsync(300);
        expect(_renderedUsernames(harness.container)).toEqual(["Replacement result"]);
    });

    it("clears a pending debounce when a searched account is selected", async () => {
        const harness = _renderView({
            searchImplementation: async () => [_createResult("Selected result")]
        });

        _enterQuery(harness.container, "selected");
        await vi.advanceTimersByTimeAsync(300);
        _enterQuery(harness.container, "pending");
        (harness.container.querySelector(".pfp-item") as HTMLElement).click();
        await vi.advanceTimersByTimeAsync(300);

        expect(harness.searchUsers).toHaveBeenCalledTimes(1);
        expect(harness.addProfile).toHaveBeenCalledWith({
            username: "Selected result",
            pfpUrl: "https://cdn.example.test/avatar.png",
            steamId: "steam-Selected result"
        });
        expect(harness.onProfileSelected).toHaveBeenCalledOnce();
        expect(harness.container.querySelector<HTMLInputElement>("#account-search-input")?.value).toBe("");
    });
});

function _renderView(options: {
    profiles?: PlayerProfile[];
    activeUsername?: string | null;
    searchImplementation?: SearchImplementation;
} = {}): AccountViewHarness {
    const profiles = options.profiles ?? [];
    const activeUsername = options.activeUsername ?? null;
    const defaultSearch = async (): Promise<KovaaksUserSearchResult[]> => [];
    const searchUsers = vi.fn<SearchImplementation>(options.searchImplementation ?? defaultSearch);
    const addProfile = vi.fn<(profile: PlayerProfile) => void>();
    const onProfileSelected = vi.fn<(profile: PlayerProfile) => void>();
    const identityService = {
        getProfiles: vi.fn(() => profiles),
        getActiveProfile: vi.fn(() => profiles.find(profile => profile.username === activeUsername) ?? null),
        onProfilesChanged: vi.fn(),
        addProfile,
        setActiveProfile: vi.fn(),
        removeProfile: vi.fn()
    } as unknown as IdentityService;
    const audioService = {
        playHeavy: vi.fn(),
        playLight: vi.fn()
    } as unknown as AudioService;
    const container = document.createElement("div");
    document.body.appendChild(container);

    new AccountSelectionView(container, {
        identityService,
        kovaaksApiService: { searchUsers } as unknown as KovaaksApiService,
        audioService,
        onProfileSelected
    });

    return { container, searchUsers, addProfile, onProfileSelected };
}

function _enterQuery(container: HTMLElement, query: string): void {
    const input = container.querySelector("#account-search-input") as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function _renderedUsernames(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll<HTMLImageElement>(".carousel-pfp"))
        .map(image => image.alt);
}

function _createResult(username: string): KovaaksUserSearchResult {
    return {
        username,
        steamAccountName: "",
        steamId: `steam-${username}`,
        steamAccountAvatar: "https://cdn.example.test/avatar.png",
        country: null,
        rank: null
    };
}

function _createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolvePromise: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
}

async function _flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}
