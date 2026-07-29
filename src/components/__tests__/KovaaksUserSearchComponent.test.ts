/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { KovaaksUserSearchComponent } from "../ui/KovaaksUserSearchComponent";
import { AudioService } from "../../services/AudioService";
import { IdentityService } from "../../services/IdentityService";
import { KovaaksApiService } from "../../services/KovaaksApiService";
import { KovaaksUserSearchResult } from "../../types/KovaaksApiTypes";
import { PlayerProfile } from "../../types/PlayerTypes";

type SearchImplementation = (query: string) => Promise<KovaaksUserSearchResult[]>;

interface SearchComponentHarness {
    component: KovaaksUserSearchComponent;
    searchUsers: Mock<SearchImplementation>;
    addProfile: Mock<(profile: PlayerProfile) => void>;
    playHeavy: Mock<(volume?: number) => void>;
}

describe("KovaaksUserSearchComponent", () => {
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

    it("renders API fields as text and assigns only HTTP avatar URLs", async () => {
        const hostileUsername = `bad" onerror="alert(1)"><script id="search-username-injection"></script>`;
        const hostileSteamName = `</span><button id="search-name-injection">owned</button>`;
        const hostileCountry = `<img id="search-country-injection" onerror="alert(1)">`;
        const hostileResult = _createResult(hostileUsername, {
            steamAccountName: hostileSteamName,
            steamAccountAvatar: "javascript:alert(1)",
            country: hostileCountry,
            rank: 17
        });
        const httpResult = _createResult("HTTP user", {
            steamAccountAvatar: "http://cdn.example.test/http-avatar.png"
        });
        const httpsResult = _createResult("HTTPS user", {
            steamAccountAvatar: "https://cdn.example.test/https-avatar.png"
        });
        const harness = _renderComponent(async () => [hostileResult, httpResult, httpsResult]);

        _enterQuery("payload");
        await vi.advanceTimersByTimeAsync(300);

        const items = Array.from(document.querySelectorAll<HTMLElement>(".search-result-item"));
        expect(items).toHaveLength(3);
        expect(items[0].children).toHaveLength(2);
        expect(items[0].children[0].classList.contains("result-avatar")).toBe(true);
        expect(items[0].children[1].classList.contains("result-info")).toBe(true);
        expect(items[0].querySelector(".result-username")?.textContent)
            .toBe(`${hostileUsername} (${hostileSteamName})`);
        expect(items[0].querySelector(".result-info > .result-meta")?.textContent)
            .toBe(`Rank #17${hostileCountry}`);
        expect(items[0].querySelector("[onerror]")).toBeNull();
        expect(items[0].querySelector("img")?.hasAttribute("src")).toBe(false);
        expect(document.querySelector("#search-username-injection")).toBeNull();
        expect(document.querySelector("#search-name-injection")).toBeNull();
        expect(document.querySelector("#search-country-injection")).toBeNull();

        const avatars = items.map(item => item.querySelector("img") as HTMLImageElement);
        expect(avatars[1].src).toBe("http://cdn.example.test/http-avatar.png");
        expect(avatars[2].src).toBe("https://cdn.example.test/https-avatar.png");

        items[0].click();
        expect(harness.addProfile).toHaveBeenCalledWith({
            username: hostileUsername,
            steamId: hostileResult.steamId,
            pfpUrl: hostileResult.steamAccountAvatar
        });
        expect(harness.playHeavy).toHaveBeenCalledWith(0.5);
        expect(document.querySelector(".kovaaks-search-overlay")).toBeNull();
    });

    it("keeps the newest result when requests complete out of order", async () => {
        const older = _createDeferred<KovaaksUserSearchResult[]>();
        const newer = _createDeferred<KovaaksUserSearchResult[]>();
        _renderComponent((query) => query === "older" ? older.promise : newer.promise);

        _enterQuery("older");
        await vi.advanceTimersByTimeAsync(300);
        _enterQuery("newer");
        await vi.advanceTimersByTimeAsync(300);

        newer.resolve([_createResult("Newest result")]);
        await _flushPromises();
        expect(document.querySelector(".result-username")?.textContent).toBe("Newest result ");

        older.resolve([_createResult("Stale result")]);
        await _flushPromises();
        expect(document.querySelector(".result-username")?.textContent).toBe("Newest result ");
        expect(document.body.textContent).not.toContain("Stale result");
    });

    it("invalidates on input immediately and clears the debounce on close", async () => {
        const inFlight = _createDeferred<KovaaksUserSearchResult[]>();
        const harness = _renderComponent(() => inFlight.promise);

        _enterQuery("first");
        await vi.advanceTimersByTimeAsync(300);
        _enterQuery("replacement");

        inFlight.resolve([_createResult("Too late")]);
        await _flushPromises();
        expect(document.body.textContent).not.toContain("Too late");

        const onClose = vi.fn();
        harness.component.subscribeToClose(onClose);
        const overlay = document.querySelector(".kovaaks-search-overlay") as HTMLElement;
        overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);

        expect(harness.searchUsers).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledOnce();
    });
});

function _renderComponent(
    searchImplementation: SearchImplementation
): SearchComponentHarness {
    const searchUsers = vi.fn<SearchImplementation>(searchImplementation);
    const addProfile = vi.fn<(profile: PlayerProfile) => void>();
    const playHeavy = vi.fn<(volume?: number) => void>();
    const component = new KovaaksUserSearchComponent(
        { searchUsers } as unknown as KovaaksApiService,
        { addProfile } as unknown as IdentityService,
        { playHeavy } as unknown as AudioService
    );
    component.render();

    return { component, searchUsers, addProfile, playHeavy };
}

function _enterQuery(query: string): void {
    const input = document.querySelector(".kovaaks-search-input") as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function _createResult(
    username: string,
    overrides: Partial<KovaaksUserSearchResult> = {}
): KovaaksUserSearchResult {
    return {
        username,
        steamAccountName: "",
        steamId: `steam-${username}`,
        steamAccountAvatar: "https://cdn.example.test/avatar.png",
        country: null,
        rank: null,
        ...overrides
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
