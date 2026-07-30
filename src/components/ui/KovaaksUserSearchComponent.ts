import { KovaaksApiService } from "../../services/KovaaksApiService";
import { IdentityService } from "../../services/IdentityService";
import { AudioService } from "../../services/AudioService";
import { KovaaksUserSearchResult } from "../../types/KovaaksApiTypes";

/**
 * A popup component that allows users to search for and select their Kovaaks account.
 * Follows the visual style of the application's settings and about menus.
 */
export class KovaaksUserSearchComponent {
    private readonly _kovaaksApi: KovaaksApiService;
    private readonly _identity: IdentityService;
    private readonly _audio: AudioService | null;
    private readonly _onClose: (() => void)[] = [];

    private _searchTimeoutId: number | null = null;
    private _resultsContainer: HTMLElement | null = null;
    private _inputElement: HTMLInputElement | null = null;
    private _lastSearchRequestId: number = 0;

    /**
     * Initializes the component with required services.
     * 
     * @param kovaaksApi - Service for Kovaaks API calls.
     * @param identity - Service for user identity management.
     * @param audio - Optional service for sound effects.
     */
    public constructor(
        kovaaksApi: KovaaksApiService,
        identity: IdentityService,
        audio: AudioService | null = null
    ) {
        this._kovaaksApi = kovaaksApi;
        this._identity = identity;
        this._audio = audio;
    }

    /**
     * Subscribes a callback to the close event.
     * 
     * @param callback - The function to call when the component closes.
     */
    public subscribeToClose(callback: () => void): void {
        this._onClose.push(callback);
    }

    /**
     * Renders the search overlay into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard();

        container.appendChild(card);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this._inputElement?.focus();
    }

    private _createOverlay(): HTMLElement {
        const overlay: HTMLDivElement = document.createElement("div");
        overlay.className = "settings-overlay kovaaks-search-overlay";

        overlay.addEventListener("click", (event: MouseEvent): void => {
            if (event.target === overlay) {
                this._close(overlay);
            }
        });

        return overlay;
    }

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container";

        return container;
    }

    private _createCard(): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card kovaaks-search-card";

        card.appendChild(this._createHeader());
        card.appendChild(this._createSearchInput());
        card.appendChild(this._createResultsArea());

        return card;
    }

    private _createHeader(): HTMLElement {
        const header: HTMLHeadingElement = document.createElement("h2");
        header.textContent = "Link Kovaaks Account";
        header.style.marginBottom = "1.5rem";

        return header;
    }

    private _createSearchInput(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "search-input-wrapper";

        const input: HTMLInputElement = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter Kovaaks username...";
        input.className = "kovaaks-search-input";

        input.addEventListener("input", () => this._handleInput(input.value));

        this._inputElement = input;
        container.appendChild(input);

        return container;
    }

    private _createResultsArea(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "search-results-container";
        this._resultsContainer = container;

        const placeholder: HTMLDivElement = document.createElement("div");
        placeholder.className = "search-placeholder";
        placeholder.textContent = "Search results will appear here...";
        container.appendChild(placeholder);

        return container;
    }

    private _handleInput(query: string): void {
        const requestId = this._invalidatePendingSearch();

        this._searchTimeoutId = window.setTimeout(() => {
            this._searchTimeoutId = null;
            void this._performSearch(query, requestId);
        }, 300);
    }

    private async _performSearch(query: string, requestId: number): Promise<void> {
        if (!this._resultsContainer || this._isRequestStale(requestId)) {
            return;
        }

        if (query.trim().length === 0) {
            this._renderPlaceholder("Enter a username to search.");

            return;
        }

        this._renderPlaceholder("Searching...");
        await this._executeSearchRequest(query, requestId);
    }

    private async _executeSearchRequest(query: string, requestId: number): Promise<void> {
        try {

            const results = await this._kovaaksApi.searchUsers(query);

            if (this._isRequestStale(requestId)) {
                return;
            }

            this._handleSearchResults(results, requestId);
        } catch (error) {
            this._handleSearchError(error, requestId);
        }
    }

    private _isRequestStale(requestId: number): boolean {
        return requestId !== this._lastSearchRequestId;
    }

    private _handleSearchResults(results: KovaaksUserSearchResult[], requestId: number): void {
        if (!Array.isArray(results)) {
            console.warn(`[KovaaksSearch] [#${requestId}] Invalid results:`, results);
            this._renderResults([]);

            return;
        }


        this._renderResults(results);
    }

    private _handleSearchError(error: unknown, requestId: number): void {
        if (requestId === this._lastSearchRequestId) {
            console.error(`[KovaaksSearch] [#${requestId}] Search failed:`, error);
            this._renderPlaceholder("Failed to fetch results. Check your connection.");
        }
    }

    private _renderPlaceholder(text: string): void {
        if (!this._resultsContainer) {
            return;
        }

        const placeholder: HTMLDivElement = document.createElement("div");
        placeholder.className = "search-placeholder";
        placeholder.textContent = text;
        this._resultsContainer.replaceChildren(placeholder);
    }

    private _renderResults(results: KovaaksUserSearchResult[]): void {
        if (!this._resultsContainer) {
            return;
        }
        this._resultsContainer.replaceChildren();

        if (results.length === 0) {
            this._renderPlaceholder("No users found.");

            return;
        }

        results.forEach((user: KovaaksUserSearchResult) => {
            try {
                this._resultsContainer?.appendChild(this._createResultItem(user));
            } catch (error) {
                console.error(`[KovaaksSearch] Failed to render result item for ${user.username}:`, error);
            }
        });
    }

    private _createResultItem(user: KovaaksUserSearchResult): HTMLElement {
        const item: HTMLDivElement = document.createElement("div");
        item.className = "search-result-item";

        const avatar: HTMLImageElement = document.createElement("img");
        avatar.className = "result-avatar";
        this._setSafeImageSource(avatar, user.steamAccountAvatar);

        item.append(avatar, this._createResultInfo(user));
        item.addEventListener("click", () => this._selectUser(user));

        return item;
    }

    private _createResultInfo(user: KovaaksUserSearchResult): HTMLElement {
        const info: HTMLDivElement = document.createElement("div");
        info.className = "result-info";

        const username: HTMLDivElement = document.createElement("div");
        username.className = "result-username";
        username.appendChild(document.createTextNode(`${user.username} `));
        if (user.steamAccountName) {
            const secondaryName: HTMLSpanElement = document.createElement("span");
            secondaryName.className = "result-meta";
            secondaryName.textContent = `(${user.steamAccountName})`;
            username.appendChild(secondaryName);
        }

        info.append(username, this._createResultMetadata(user));

        return info;
    }

    private _createResultMetadata(user: KovaaksUserSearchResult): HTMLElement {
        const metadata: HTMLDivElement = document.createElement("div");
        metadata.className = "result-meta";
        if (user.rank) {
            const rank: HTMLSpanElement = document.createElement("span");
            rank.className = "result-rank";
            rank.textContent = `Rank #${user.rank}`;
            metadata.appendChild(rank);
        }
        if (user.country) {
            const country: HTMLSpanElement = document.createElement("span");
            country.className = "result-country";
            country.textContent = user.country;
            metadata.appendChild(country);
        }

        return metadata;
    }

    private _setSafeImageSource(image: HTMLImageElement, source: string): void {
        try {
            const url: URL = new URL(source);
            if (url.protocol === "http:" || url.protocol === "https:") {
                image.src = url.toString();
            }
        } catch {
            // Leave malformed avatar URLs unset.
        }
    }

    private _selectUser(user: KovaaksUserSearchResult): void {
        this._audio?.playHeavy(0.5);
        this._identity.addProfile({
            username: user.username,
            steamId: user.steamId,
            pfpUrl: user.steamAccountAvatar
        });

        const overlay: HTMLElement | null = document.querySelector(".kovaaks-search-overlay");
        if (overlay) {
            this._close(overlay);
        }
    }

    private _close(overlay: HTMLElement): void {
        this._invalidatePendingSearch();
        overlay.remove();
        this._onClose.forEach((callback) => callback());
    }

    private _invalidatePendingSearch(): number {
        if (this._searchTimeoutId !== null) {
            window.clearTimeout(this._searchTimeoutId);
            this._searchTimeoutId = null;
        }

        return ++this._lastSearchRequestId;
    }
}
