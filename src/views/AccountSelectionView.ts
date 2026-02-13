import { IdentityService } from "../services/IdentityService";
import { AudioService } from "../services/AudioService";
import { KovaaksApiService } from "../services/KovaaksApiService";
import { PlayerProfile } from "../types/PlayerTypes";

import { DeleteInteractionController } from "./DeleteInteractionController";

interface SearchResultProfile extends PlayerProfile {
    isRemote?: boolean;
}

/**
 * Responsibility: Manage the Account Selection screen, including user carousel and search.
 */
export interface AccountSelectionViewDependencies {
    identityService: IdentityService;
    kovaaksApiService: KovaaksApiService;
    audioService: AudioService;
    onProfileSelected: (profile: PlayerProfile) => void;
}

/**
 *
 */
export class AccountSelectionView {
    private readonly _container: HTMLElement;
    private readonly _deps: AccountSelectionViewDependencies;

    private _searchTimeout: number | null = null;
    private _lastActiveUsername: string | null = null;
    private _searchQuery: string = "";
    private _remoteResults: SearchResultProfile[] = [];
    private _previewUsername: string | null = null;

    private _pendingIndexDelta: number | null = null;
    private _animationCounter: number = 0;
    private _currentAnimationId: number = 0;
    private _lastProfileCount: number = 0;
    private _lastSearchQuery: string = "";
    private _renderCycleId: number = 0;

    /**
     * Initializes the account selection view.
     * 
     * @param container - The element to mount the view in.
     * @param deps - Service dependencies.
     */
    public constructor(
        container: HTMLElement,
        deps: AccountSelectionViewDependencies
    ) {
        this._container = container;
        this._deps = deps;

        this._renderBaseStructure();
        this._setupListeners();
        this.refresh();
    }

    /**
     * Refreshes the view with the latest profile data.
     */
    public refresh(): void {
        const searchInput = this._container.querySelector("#account-search-input") as HTMLInputElement;
        if (searchInput) {
            const currentQuery = searchInput.value.trim();
            if (currentQuery !== this._searchQuery) {
                // Force recalculation
                this._lastActiveUsername = null;
                this._searchQuery = currentQuery;
            }

            // Always clear remote results if query is short or empty
            if (this._searchQuery.length < 3) {
                this._remoteResults = [];
            }
        }

        this._renderCarousel();
    }

    private _renderBaseStructure(): void {
        this._container.innerHTML = `
            <div class="account-selection-view">
                <div class="account-selection-header">
                    <h2>Welcome to Raw Output</h2>
                </div>

                <div class="carousel-group">
                    <div class="motion-stage" id="motion-stage">
                        <div class="carousel-track" id="carousel-track">
                            <!-- PFP items injected here -->
                        </div>
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
                </div>
            </div>
        `;
    }

    private _setupListeners(): void {
        const searchInput = this._container.querySelector("#account-search-input") as HTMLInputElement;
        const stage = this._container.querySelector("#motion-stage") as HTMLElement;

        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim();
            this._searchQuery = query;

            if (this._searchTimeout) window.clearTimeout(this._searchTimeout);

            if (query.length < 3) {
                this._remoteResults = [];
                this._previewUsername = null;
                this.refresh();

                return;
            }

            // Immediate local filtering
            this._previewUsername = null;
            this.refresh();
            this._searchTimeout = window.setTimeout(() => this._performSearch(query), 300);
        });

        this._setupCarouselWheel(stage);
        this._deps.identityService.onProfilesChanged(() => this.refresh());
    }

    private _setupCarouselWheel(stage: HTMLElement): void {
        stage.addEventListener("wheel", (event: WheelEvent): void => {
            event.preventDefault();
            const profiles = this._getFilteredProfiles();
            if (profiles.length < 2) return;

            const active = this._deps.identityService.getActiveProfile();
            const isSearching = this._searchQuery.length > 0;
            const currentUsername = (isSearching && this._previewUsername)
                ? this._previewUsername
                : (active?.username || null);

            const currentIndex = currentUsername
                ? profiles.findIndex(prof => prof.username === currentUsername)
                : 0;

            const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
            const delta = event.deltaY > 0 ? 1 : -1;
            this._pendingIndexDelta = delta;
            this._deps.audioService.playHeavy(0.4);

            let nextIndex = safeCurrentIndex + delta;
            if (nextIndex < 0) nextIndex = profiles.length - 1;
            if (nextIndex >= profiles.length) nextIndex = 0;

            const nextProfile = profiles[nextIndex];

            if (isSearching) {
                this._previewUsername = nextProfile.username;
                this.refresh();
            } else if (!nextProfile.isRemote) {
                this._deps.identityService.setActiveProfile(nextProfile.username);
            }
        }, { passive: false });
    }

    private _getFilteredProfiles(): SearchResultProfile[] {
        let profiles: SearchResultProfile[] = this._deps.identityService.getProfiles();

        if (this._searchQuery.length > 0) {
            const lowerQuery = this._searchQuery.toLowerCase();
            profiles = profiles.filter(prof => prof.username.toLowerCase().includes(lowerQuery));
        }

        if (this._remoteResults.length > 0) {
            const localUsernames = new Set(profiles.map(prof => prof.username.toLowerCase()));
            const newRemote = this._remoteResults.filter(result => !localUsernames.has(result.username.toLowerCase()));
            profiles = [...profiles, ...newRemote];
        }

        return profiles;
    }

    private _renderCarousel(): void {
        const track = this._container.querySelector("#carousel-track") as HTMLElement;
        const nameStage = this._container.querySelector("#name-stage") as HTMLElement;
        const profiles = this._getFilteredProfiles();
        const activeProfile = this._deps.identityService.getActiveProfile();

        if (profiles.length === 0) {
            this._handleEmptySelection(track, nameStage);

            return;
        }

        this._reconcileCarouselState(track, profiles);

        const delta = this._calculateCarouselDelta(profiles, activeProfile);
        this._renderCycleId++;
        this._pendingIndexDelta = null;

        if (this._handleAutomaticPreview({ track, nameStage, profiles, activeProfile })) {
            return;
        }

        this._renderCarouselContent({ track, nameStage, profiles, activeProfile, delta });
    }

    private _handleEmptySelection(track: HTMLElement, nameStage: HTMLElement): void {
        track.innerHTML = `<p class="text-dim">No profiles found</p>`;
        nameStage.innerHTML = "";
        this._lastProfileCount = 0;
    }

    private _reconcileCarouselState(track: HTMLElement, profiles: SearchResultProfile[]): void {
        const isSearching = this._searchQuery.length > 0;
        const wasSearching = this._lastSearchQuery.length > 0;
        const searchTransition = isSearching !== wasSearching;

        if (profiles.length !== this._lastProfileCount || searchTransition) {
            track.innerHTML = "";
            this._lastActiveUsername = null;
            this._lastProfileCount = profiles.length;
            this._lastSearchQuery = this._searchQuery;
        }
    }

    private _handleAutomaticPreview(options: {
        track: HTMLElement;
        nameStage: HTMLElement;
        profiles: SearchResultProfile[];
        activeProfile: PlayerProfile | null;
    }): boolean {
        const { track, nameStage, profiles, activeProfile } = options;
        const isSearching = this._searchQuery.length > 0;
        if (!isSearching || this._previewUsername) return false;

        const hasActiveInResults = profiles.some(prof => prof.username === activeProfile?.username);
        if (hasActiveInResults || profiles.length === 0) return false;

        this._previewUsername = profiles[0].username;
        const newDelta = this._calculateCarouselDelta(profiles, activeProfile);

        this._updatePfpItems(track, profiles, activeProfile, newDelta.explicitDiff);
        this._updateNameTransition(nameStage, profiles[0], newDelta.direction, newDelta.intermediateProfiles);
        this._lastActiveUsername = this._previewUsername;

        return true;
    }

    private _renderCarouselContent(options: {
        track: HTMLElement;
        nameStage: HTMLElement;
        profiles: SearchResultProfile[];
        activeProfile: PlayerProfile | null;
        delta: { direction: "up" | "down"; intermediateProfiles: PlayerProfile[]; explicitDiff: number | null };
    }): void {
        const { track, nameStage, profiles, activeProfile, delta } = options;
        const isSearching = this._searchQuery.length > 0;
        this._updatePfpItems(track, profiles, activeProfile, delta.explicitDiff);

        const displayName = (isSearching && this._previewUsername)
            ? profiles.find(prof => prof.username === this._previewUsername)
            : activeProfile;

        this._updateNameTransition(nameStage, displayName || null, delta.direction, delta.intermediateProfiles);

        this._lastActiveUsername = (isSearching && this._previewUsername)
            ? this._previewUsername
            : (activeProfile?.username || null);
    }

    private _calculateCarouselDelta(profiles: SearchResultProfile[], activeProfile: PlayerProfile | null): {
        direction: "up" | "down";
        intermediateProfiles: PlayerProfile[];
        explicitDiff: number | null;
    } {
        const isSearching = this._searchQuery.length > 0;
        const currentTargetUsername = (isSearching && this._previewUsername)
            ? this._previewUsername
            : (activeProfile?.username || null);

        if (!this._lastActiveUsername || !currentTargetUsername || this._lastActiveUsername === currentTargetUsername) {
            return { direction: "up", intermediateProfiles: [], explicitDiff: null };
        }

        const prevIndex = profiles.findIndex(prof => prof.username === this._lastActiveUsername);
        const currIndex = profiles.findIndex(prof => prof.username === currentTargetUsername);

        if (prevIndex === -1 || currIndex === -1) {
            return { direction: "up", intermediateProfiles: [], explicitDiff: null };
        }

        return this._calculatePath(profiles, prevIndex, currIndex);
    }

    private _calculatePath(profiles: SearchResultProfile[], prevIndex: number, currIndex: number): {
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
        profiles: SearchResultProfile[],
        active: PlayerProfile | null,
        explicitDiff: number | null = null
    ): void {
        const isSearching = this._searchQuery.length > 0;
        const centerUsername = (isSearching && this._previewUsername)
            ? this._previewUsername
            : (active?.username || null);

        const activeIndex = profiles.findIndex(prof => prof.username === centerUsername);
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
        this._pruneOffScreenNodes(track, totalProfiles, this._renderCycleId);
    }
    private _updateStageWidth(totalProfiles: number): void {
        const stage = this._container.querySelector(".motion-stage") as HTMLElement;
        if (!stage) return;

        // Use different logic for odd vs even profile scenarios as requested
        const maxVisibleOffset = (totalProfiles % 2 === 0)
            ? (totalProfiles / 2) * 5 + 1
            : ((totalProfiles - 1) / 2) * 5 + 1;

        const calculatedWidthRem = (maxVisibleOffset * 2) + 3;

        // Adaptive width capped by parent
        const parentWidthPx = stage.parentElement?.clientWidth || 0;

        // If parent width is 0 (likely hidden-view), just use the calculated width
        // and let the next real render adjust it to the parent.
        if (parentWidthPx === 0) {
            stage.style.width = `${calculatedWidthRem}rem`;

            return;
        }

        const fontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const parentWidthRem = parentWidthPx / fontSizePx;

        stage.style.width = `${Math.min(calculatedWidthRem, parentWidthRem)}rem`;
    }

    private _spawnMissingPfpNodes(options: {
        track: HTMLElement;
        profiles: SearchResultProfile[];
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

    private _getMissingNodeTargets(profiles: SearchResultProfile[], activeIndex: number): { index: number; unit: number }[] {
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
        profile: SearchResultProfile;
        unit: number;
        activeIndex: number;
        indexShift: number;
        profiles: SearchResultProfile[];
    }): HTMLElement {
        const { profile, unit, activeIndex, indexShift, profiles } = options;
        const node = document.createElement("div");
        node.className = "pfp-item";
        if (profile.isRemote) {
            node.classList.add("remote");
        }

        node.innerHTML = `
            <img src="${profile.pfpUrl}" alt="${profile.username}" class="carousel-pfp">
            ${!profile.isRemote ? `
            <div class="pfp-delete-btn">
                <div class="button-fill"></div>
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>` : ''}
        `;

        const startUnits = unit - indexShift;
        node.setAttribute("data-units", startUnits.toString());
        this._applyPfpNodeStyles(node, startUnits, activeIndex, profiles);

        const deleteBtn = node.querySelector(".pfp-delete-btn") as HTMLElement;
        if (deleteBtn) {
            this._setupDeleteInteraction(deleteBtn, profile.username);
        }

        return node;
    }

    private _setupDeleteInteraction(btn: HTMLElement, username: string): void {
        new DeleteInteractionController(
            this._deps.audioService,
            this._deps.identityService,
            btn,
            username
        );
    }

    private _pruneOffScreenNodes(track: HTMLElement, totalProfiles: number, renderId: number): void {
        setTimeout(() => {
            if (renderId !== this._renderCycleId) return;

            const allNodes = Array.from(track.children) as HTMLElement[];
            allNodes.forEach(node => {
                const units = parseFloat(node.getAttribute("data-units") || "0");
                if (Math.abs(units) > totalProfiles / 2 + 0.5) {
                    node.remove();
                }
            });
        }, 200);
    }

    private _applyPfpNodeStyles(node: HTMLElement, unit: number, activeIndex: number, profiles: SearchResultProfile[]): void {
        const BASE_SPACING = 5;
        const ACTIVE_EXTRA = 1;
        const profileUsername = (node.querySelector("img") as HTMLImageElement).alt;
        const profileIndex = profiles.findIndex(prof => prof.username === profileUsername);
        const profile = profiles[profileIndex];

        const isSearching = this._searchQuery.length > 0;
        const isActive = !isSearching && profileIndex === activeIndex && Math.abs(unit) < 0.1;
        const isPreviewed = isSearching && profileIndex === activeIndex && Math.abs(unit) < 0.1;

        node.classList.toggle("active", isActive);
        node.classList.toggle("previewed", isPreviewed);

        let offset = 0;
        const effectiveActiveExtra = isSearching ? 0 : ACTIVE_EXTRA;

        if (unit > 0) offset = unit * BASE_SPACING + effectiveActiveExtra;
        else if (unit < 0) offset = unit * BASE_SPACING - effectiveActiveExtra;

        node.style.left = `calc(50% + ${offset}rem)`;
        node.style.transform = "translateX(-50%)";
        node.style.opacity = (isActive || isPreviewed) ? "1" : "0.4";

        node.onclick = (): void => this._handlePfpClick(profile, unit, profileUsername);
    }

    private _handlePfpClick(profile: SearchResultProfile, unit: number, profileUsername: string): void {
        if (this._container.querySelector(".pfp-delete-btn.holding")) {
            return;
        }

        const isSearching = this._searchQuery.length > 0;
        const isCentered = Math.abs(unit) < 0.1;

        if (isSearching) {
            this._handleSearchingPfpClick(profile, isCentered, unit, profileUsername);

            return;
        }

        this._handleStandardPfpClick(profile, isCentered, unit, profileUsername);
    }

    private _handleSearchingPfpClick(
        profile: SearchResultProfile,
        isCentered: boolean,
        unit: number,
        profileUsername: string
    ): void {
        if (isCentered) {
            this._deps.audioService.playHeavy(1.0);

            if (profile.isRemote) {
                this._deps.identityService.addProfile({
                    username: profile.username,
                    pfpUrl: profile.pfpUrl,
                    steamId: profile.steamId
                });
            }

            this._deps.identityService.setActiveProfile(profileUsername);
            this._clearSearchState();
            this._deps.onProfileSelected(profile);
            this.refresh();
        } else {
            this._deps.audioService.playHeavy(0.4);
            this._previewUsername = profileUsername;
            this._pendingIndexDelta = Math.round(unit);
            this.refresh();
        }
    }

    private _clearSearchState(): void {
        const searchInput = this._container.querySelector("#account-search-input") as HTMLInputElement;
        if (searchInput) searchInput.value = "";
        this._searchQuery = "";
        this._remoteResults = [];
        this._previewUsername = null;
    }

    private _handleStandardPfpClick(
        profile: SearchResultProfile,
        isCentered: boolean,
        unit: number,
        profileUsername: string
    ): void {
        const isActive = isCentered;
        const volume = isActive && !profile.isRemote ? 1.0 : 0.4;
        this._deps.audioService.playHeavy(volume);

        if (profile?.isRemote) {
            this._deps.identityService.addProfile({
                username: profile.username,
                pfpUrl: profile.pfpUrl,
                steamId: profile.steamId
            });

            this._deps.identityService.setActiveProfile(profileUsername);

            return;
        }

        if (isActive) {
            this._deps.onProfileSelected(profile);
        } else {
            this._pendingIndexDelta = Math.round(unit);
            this._deps.identityService.setActiveProfile(profileUsername);
        }
    }

    private _updateNameTransition(
        nameStage: HTMLElement,
        active: PlayerProfile | null,
        direction: "up" | "down",
        intermediate: PlayerProfile[] = []
    ): void {
        const animId = ++this._animationCounter;
        this._currentAnimationId = animId;

        const names = [...intermediate.map(prof => prof.username), active?.username || ""];
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
        if (query.trim().length < 3) return;

        try {
            const results = await this._deps.kovaaksApiService.searchUsers(query);

            // Map to SearchResultProfile format
            this._remoteResults = results.map(result => ({
                username: result.username,
                pfpUrl: result.steamAccountAvatar,
                steamId: result.steamId,
                isRemote: true
            }));

            this.refresh();
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error("Unknown search error");
            console.error("Search failed:", error.message);
            this._remoteResults = [];
            this.refresh();
        }
    }
}
