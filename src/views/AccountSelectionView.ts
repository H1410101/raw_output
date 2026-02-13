import { IdentityService } from "../services/IdentityService";
import { KovaaksApiService } from "../services/KovaaksApiService";
import { PlayerProfile } from "../types/PlayerTypes";
import { KovaaksUserSearchResult } from "../types/KovaaksApiTypes";

/**
 * Responsibility: Manage the Account Selection screen, including user carousel and search.
 */
export class AccountSelectionView {
    private readonly _container: HTMLElement;
    private readonly _identityService: IdentityService;
    private readonly _kovaaksApiService: KovaaksApiService;
    private readonly _onProfileSelected: (profile: PlayerProfile) => void;

    private _searchTimeout: number | null = null;
    private _lastActiveUsername: string | null = null;

    private _pendingIndexDelta: number | null = null;
    private _animationCounter: number = 0;
    private _currentAnimationId: number = 0;
    private _lastProfileCount: number = 0;

    /**
     * Initializes the account selection view.
     * 
     * @param container - The element to mount the view in.
     * @param identityService - Service for managing player profiles.
     * @param kovaaksApiService - Service for searching Kovaaks accounts.
     * @param onProfileSelected - Callback for when a profile is selected.
     */
    public constructor(
        container: HTMLElement,
        identityService: IdentityService,
        kovaaksApiService: KovaaksApiService,
        onProfileSelected: (profile: PlayerProfile) => void
    ) {
        this._container = container;
        this._identityService = identityService;
        this._kovaaksApiService = kovaaksApiService;
        this._onProfileSelected = onProfileSelected;

        this._renderBaseStructure();
        this._setupListeners();
        this.refresh();
    }

    /**
     * Refreshes the view with the latest profile data.
     */
    public refresh(): void {
        this._renderCarousel();
    }

    private _renderBaseStructure(): void {
        this._container.innerHTML = `
            <div class="account-selection-view">
                <div class="account-selection-header">
                    <h2>Welcome to Raw Output</h2>
                </div>

                <div class="motion-stage" id="motion-stage">
                    <div class="carousel-track" id="carousel-track">
                        <!-- PFP items injected here -->
                    </div>
                    <div class="name-stage" id="name-stage">
                        <!-- Profile name span(s) injected here -->
                    </div>
                </div>

                <div class="account-search-container">
                    <div class="search-input-wrapper">
                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" class="search-input" id="account-search-input" placeholder="Search Kovaaks username..." autocomplete="off">
                    </div>
                    <div class="search-results" id="search-results">
                        <!-- Search results injected here -->
                    </div>
                </div>
            </div>
        `;
    }

    private _setupListeners(): void {
        const searchInput = this._container.querySelector("#account-search-input") as HTMLInputElement;
        const resultsContainer = this._container.querySelector("#search-results") as HTMLElement;
        const stage = this._container.querySelector("#motion-stage") as HTMLElement;

        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim();
            if (this._searchTimeout) window.clearTimeout(this._searchTimeout);
            if (query.length < 3) {
                resultsContainer.classList.remove("active");

                return;
            }
            this._searchTimeout = window.setTimeout(() => this._performSearch(query), 300);
        });

        this._setupCarouselWheel(stage);

        document.addEventListener("click", (event: MouseEvent): void => {
            if (!this._container.querySelector(".account-search-container")?.contains(event.target as Node)) {
                resultsContainer.classList.remove("active");
            }
        });

        this._identityService.onProfilesChanged(() => this.refresh());
    }

    private _setupCarouselWheel(stage: HTMLElement): void {
        stage.addEventListener("wheel", (event: WheelEvent): void => {
            event.preventDefault();
            const profiles = this._identityService.getProfiles();
            if (profiles.length < 2) return;

            const active = this._identityService.getActiveProfile();
            const currentIndex = active ? profiles.findIndex(profile => profile.username === active.username) : 0;

            const delta = event.deltaY > 0 ? 1 : -1;
            this._pendingIndexDelta = delta;

            let nextIndex = currentIndex + delta;
            if (nextIndex < 0) nextIndex = profiles.length - 1;
            if (nextIndex >= profiles.length) nextIndex = 0;

            this._identityService.setActiveProfile(profiles[nextIndex].username);
        }, { passive: false });
    }

    private _renderCarousel(): void {
        const track = this._container.querySelector("#carousel-track") as HTMLElement;
        const nameStage = this._container.querySelector("#name-stage") as HTMLElement;
        const profiles = this._identityService.getProfiles();
        const activeProfile = this._identityService.getActiveProfile();

        if (profiles.length === 0) {
            track.innerHTML = `<p class="text-dim">Search to add your Kovaaks profile</p>`;
            nameStage.innerHTML = "";
            this._lastProfileCount = 0;

            return;
        }

        // Force full refresh if profile count changed (addition or deletion)
        if (profiles.length !== this._lastProfileCount) {
            track.innerHTML = "";
            this._lastActiveUsername = null;
            this._lastProfileCount = profiles.length;
        }

        const delta = this._calculateCarouselDelta(profiles, activeProfile);

        this._pendingIndexDelta = null;
        this._updatePfpItems(track, profiles, activeProfile, delta.explicitDiff);
        this._updateNameTransition(nameStage, activeProfile, delta.direction, delta.intermediateProfiles);

        this._lastActiveUsername = activeProfile?.username || null;
    }

    private _calculateCarouselDelta(profiles: PlayerProfile[], activeProfile: PlayerProfile | null): {
        direction: "up" | "down";
        intermediateProfiles: PlayerProfile[];
        explicitDiff: number | null;
    } {
        if (!this._lastActiveUsername || !activeProfile || this._lastActiveUsername === activeProfile.username) {
            return { direction: "up", intermediateProfiles: [], explicitDiff: null };
        }

        const prevIndex = profiles.findIndex(profile => profile.username === this._lastActiveUsername);
        const currIndex = profiles.findIndex(profile => profile.username === activeProfile.username);

        if (prevIndex === -1 || currIndex === -1) {
            return { direction: "up", intermediateProfiles: [], explicitDiff: null };
        }

        return this._calculatePath(profiles, prevIndex, currIndex);
    }

    private _calculatePath(profiles: PlayerProfile[], prevIndex: number, currIndex: number): {
        direction: "up" | "down";
        intermediateProfiles: PlayerProfile[];
        explicitDiff: number;
    } {
        let diff = this._pendingIndexDelta;
        if (diff === null) {
            const fwdDist = (currIndex - prevIndex + profiles.length) % profiles.length;
            const bwdDist = (prevIndex - currIndex + profiles.length) % profiles.length;
            diff = fwdDist <= bwdDist ? fwdDist : -bwdDist;
        }

        const isForward = diff > 0;
        const intermediateProfiles: PlayerProfile[] = [];
        const steps = Math.abs(diff);

        if (steps > 1) {
            const stepDir = isForward ? 1 : -1;
            for (let i = 1; i < steps; i++) {
                const idx = (prevIndex + (i * stepDir) + profiles.length) % profiles.length;
                intermediateProfiles.push(profiles[idx]);
            }
        }

        return {
            direction: isForward ? "up" : "down",
            intermediateProfiles,
            explicitDiff: diff
        };
    }

    private _updatePfpItems(
        track: HTMLElement,
        profiles: PlayerProfile[],
        active: PlayerProfile | null,
        explicitDiff: number | null = null
    ): void {
        const activeIndex = profiles.findIndex(profile => profile.username === active?.username);
        const totalProfiles = profiles.length;
        if (totalProfiles === 0) return;

        this._updateStageWidth(totalProfiles);

        const indexShift = explicitDiff !== null ? -explicitDiff : 0;
        const existingNodes = Array.from(track.children) as HTMLElement[];
        existingNodes.forEach(node => {
            const currentUnits = parseFloat(node.getAttribute("data-units") || "0");
            const newUnits = currentUnits + indexShift;

            node.setAttribute("data-units", newUnits.toString());
            this._applyPfpNodeStyles(node, newUnits, activeIndex, profiles);
        });

        this._spawnMissingPfpNodes({ track, profiles, activeIndex, indexShift, existingNodes });
        this._pruneOffScreenNodes(track, totalProfiles);
    }

    private _updateStageWidth(totalProfiles: number): void {
        const stage = this._container.querySelector(".motion-stage") as HTMLElement;
        if (!stage) return;

        const maxVisibleOffset = (totalProfiles / 2) * 5 + 1;
        const calculatedWidthRem = (maxVisibleOffset * 2) + 3;

        // Adaptive width capped by parent
        const parentWidthPx = stage.parentElement?.clientWidth || 0;
        const fontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const parentWidthRem = parentWidthPx / fontSizePx;

        stage.style.width = `${Math.min(calculatedWidthRem, parentWidthRem)}rem`;
    }

    private _spawnMissingPfpNodes(options: {
        track: HTMLElement;
        profiles: PlayerProfile[];
        activeIndex: number;
        indexShift: number;
        existingNodes: HTMLElement[];
    }): void {
        const { track, profiles, activeIndex, indexShift, existingNodes } = options;
        const targets = this._getMissingNodeTargets(profiles, activeIndex);

        targets.forEach(target => {
            const hasNode = existingNodes.some(node => {
                const units = parseFloat(node.getAttribute("data-units") || "0");
                const alt = (node.querySelector("img") as HTMLImageElement).alt;

                return Math.abs(units - target.unit) < 0.1 && alt === profiles[target.index].username;
            });

            if (!hasNode) {
                const node = this._createNewPfpNode({
                    profile: profiles[target.index],
                    unit: target.unit,
                    activeIndex,
                    indexShift,
                    profiles
                });
                track.appendChild(node);
                void node.offsetWidth;
                node.setAttribute("data-units", target.unit.toString());
                this._applyPfpNodeStyles(node, target.unit, activeIndex, profiles);
            }
        });
    }

    private _getMissingNodeTargets(profiles: PlayerProfile[], activeIndex: number): { index: number; unit: number }[] {
        const totalProfiles = profiles.length;
        const targets = [];
        for (let i = 0; i < totalProfiles; i++) {
            let shortestDist = i - activeIndex;
            if (shortestDist > totalProfiles / 2) shortestDist -= totalProfiles;
            if (shortestDist < -totalProfiles / 2) shortestDist += totalProfiles;
            targets.push({ index: i, unit: shortestDist });
            if (totalProfiles % 2 === 0 && Math.abs(shortestDist) === totalProfiles / 2) {
                targets.push({ index: i, unit: -shortestDist });
            }
        }

        return targets;
    }

    private _createNewPfpNode(options: {
        profile: PlayerProfile;
        unit: number;
        activeIndex: number;
        indexShift: number;
        profiles: PlayerProfile[];
    }): HTMLElement {
        const { profile, unit, activeIndex, indexShift, profiles } = options;
        const node = document.createElement("div");
        node.className = "pfp-item";
        node.innerHTML = `<img src="${profile.pfpUrl}" alt="${profile.username}" class="carousel-pfp">`;
        const startUnits = unit - indexShift;
        node.setAttribute("data-units", startUnits.toString());
        this._applyPfpNodeStyles(node, startUnits, activeIndex, profiles);

        return node;
    }

    private _pruneOffScreenNodes(track: HTMLElement, totalProfiles: number): void {
        setTimeout(() => {
            const allNodes = Array.from(track.children) as HTMLElement[];
            allNodes.forEach(node => {
                const units = parseFloat(node.getAttribute("data-units") || "0");
                if (Math.abs(units) > totalProfiles / 2 + 0.5) {
                    node.remove();
                }
            });
        }, 200);
    }

    private _applyPfpNodeStyles(node: HTMLElement, unit: number, activeIndex: number, profiles: PlayerProfile[]): void {
        const BASE_SPACING = 5;
        const ACTIVE_EXTRA = 1;
        const profileUsername = (node.querySelector("img") as HTMLImageElement).alt;
        const profileIndex = profiles.findIndex(profile => profile.username === profileUsername);
        const isActive = profileIndex === activeIndex && Math.abs(unit) < 0.1;

        node.classList.toggle("active", isActive);

        let offset = 0;
        if (unit > 0) offset = unit * BASE_SPACING + ACTIVE_EXTRA;
        else if (unit < 0) offset = unit * BASE_SPACING - ACTIVE_EXTRA;

        node.style.left = `calc(50% + ${offset}rem)`;
        node.style.transform = "translateX(-50%)";
        node.style.opacity = isActive ? "1" : "0.4";

        node.onclick = (): void => {
            this._pendingIndexDelta = Math.round(unit);
            this._identityService.setActiveProfile(profileUsername);
        };
    }

    private _updateNameTransition(
        nameStage: HTMLElement,
        active: PlayerProfile | null,
        direction: "up" | "down",
        intermediate: PlayerProfile[] = []
    ): void {
        const animId = ++this._animationCounter;
        this._currentAnimationId = animId;

        const names = [...intermediate.map(profile => profile.username), active?.username || ""];
        const stepDuration = 200 / names.length;
        const startTime = performance.now();

        this._runNameSequence({
            nameStage,
            names,
            direction,
            animId,
            stepDuration,
            startTime,
            stepIndex: 0
        });
    }

    private _runNameSequence(options: {
        nameStage: HTMLElement;
        names: string[];
        direction: "up" | "down";
        animId: number;
        stepDuration: number;
        startTime: number;
        stepIndex: number;
    }): void {
        const { nameStage, names, direction, animId, stepDuration } = options;
        if (animId !== this._currentAnimationId || names.length === 0) return;

        const nextName = names.shift()!;
        this._exitCurrentName(nameStage, direction, animId, stepDuration);
        const nameSpan = this._enterNextName(nameStage, nextName, direction, stepDuration);

        if (animId !== this._currentAnimationId) {
            nameSpan.remove();

            return;
        }

        if (names.length > 0) {
            this._scheduleNextNameStep(options);
        }
    }

    private _exitCurrentName(nameStage: HTMLElement, direction: string, animId: number, duration: number): void {
        const currentNameSpan = nameStage.querySelector(".active-profile-name.current") as HTMLElement;
        if (currentNameSpan) {
            currentNameSpan.classList.remove("current", "slide-up", "slide-down");
            currentNameSpan.style.transitionDuration = `${duration}ms`;
            currentNameSpan.style.transitionTimingFunction = "linear";
            currentNameSpan.classList.add("exit", `slide-${direction}`);
            setTimeout(() => {
                if (animId === this._currentAnimationId) currentNameSpan.remove();
            }, duration);
        }
    }

    private _enterNextName(nameStage: HTMLElement, name: string, direction: string, duration: number): HTMLElement {
        const nameSpan = document.createElement("span");
        nameSpan.className = `active-profile-name enter slide-${direction}`;
        nameSpan.style.transitionDuration = `${duration}ms`;
        nameSpan.style.transitionTimingFunction = "linear";
        nameSpan.textContent = name;
        nameStage.appendChild(nameSpan);

        void nameSpan.offsetWidth;
        nameSpan.classList.remove("enter");
        nameSpan.classList.add("current");

        return nameSpan;
    }

    private _scheduleNextNameStep(options: {
        nameStage: HTMLElement;
        names: string[];
        direction: "up" | "down";
        animId: number;
        stepDuration: number;
        startTime: number;
        stepIndex: number;
    }): void {
        const { stepDuration, startTime, stepIndex } = options;
        const nextStepIndex = stepIndex + 1;
        const nextTargetTime = startTime + (nextStepIndex * stepDuration);
        const delay = Math.max(0, nextTargetTime - performance.now());

        setTimeout(() => {
            this._runNameSequence({ ...options, stepIndex: nextStepIndex });
        }, delay);
    }

    private async _performSearch(query: string): Promise<void> {
        const resultsContainer = this._container.querySelector("#search-results") as HTMLElement;
        try {
            const results = await this._kovaaksApiService.searchUsers(query);
            this._renderSearchResults(results);
            resultsContainer.classList.add("active");
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error("Unknown search error");
            console.error("Search failed:", error.message);
        }
    }

    private _renderSearchResults(results: KovaaksUserSearchResult[]): void {
        const resultsContainer = this._container.querySelector("#search-results") as HTMLElement;
        resultsContainer.innerHTML = "";
        if (results.length === 0) {
            resultsContainer.innerHTML = `<div class="search-result-item">No users found.</div>`;

            return;
        }
        results.forEach(user => {
            resultsContainer.appendChild(this._createSearchResultItem(user));
        });
    }

    private _createSearchResultItem(user: KovaaksUserSearchResult): HTMLElement {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.innerHTML = `
            <img src="${user.steamAccountAvatar}" alt="${user.username}" class="search-result-pfp">
            <div class="search-result-info">
                <span class="search-result-name">${user.username}</span>
                <span class="search-result-id">Steam ID: ${user.steamId}</span>
            </div>
        `;
        item.addEventListener("click", () => {
            const profile: PlayerProfile = {
                username: user.username,
                pfpUrl: user.steamAccountAvatar,
                steamId: user.steamId
            };
            this._identityService.addProfile(profile);
            this._onProfileSelected(profile);
            const searchInput = this._container.querySelector("#account-search-input") as HTMLInputElement;
            if (searchInput) searchInput.value = "";
            const resultsContainer = this._container.querySelector("#search-results") as HTMLElement;
            if (resultsContainer) resultsContainer.classList.remove("active");
        });

        return item;
    }
}
