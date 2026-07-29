import { PlayerProfile } from "../types/PlayerTypes";
import {
    KovaaksUserSearchResult,
} from "../types/KovaaksApiTypes";
import { KovaaksApiService } from "./KovaaksApiService";
import { HistoryService } from "./HistoryService";

/**
 * Service responsible for managing user identity and privacy preferences.
 * Generates and persists a unique, anonymous device ID and tracks analytics consent.
 * Also manages multiple Kovaaks player profiles.
 */
export class IdentityService {
    private static readonly _deviceIdKey: string = "raw_output_device_id";
    private static readonly _analyticsEnabledKey: string = "raw_output_analytics_consent";
    private static readonly _lastAnalyticsPromptKey: string = "raw_output_analytics_last_prompt";
    private static readonly _playerProfilesKey: string = "raw_output_player_profiles";
    private static readonly _activeUsernameKey: string = "raw_output_active_username";

    private _deviceId: string | null = null;
    private _isAnalyticsEnabled: boolean = false;
    private _lastAnalyticsPromptDate: Date | null = null;

    private _profiles: PlayerProfile[] = [];
    private _activeUsername: string | null = null;

    private readonly _onProfilesChanged: (() => void)[] = [];
    private readonly _onAnalyticsConsentChanged: ((enabled: boolean) => void)[] = [];
    private readonly _handleStorage = (event: StorageEvent): void => {
        if (event.key === IdentityService._playerProfilesKey ||
            event.key === IdentityService._activeUsernameKey) {
            this._loadPlayerProfiles();
            this._notifyProfilesChanged();

            return;
        }
        if (event.key !== IdentityService._analyticsEnabledKey) return;

        const enabled: boolean = event.newValue !== null && this._parseConsent(event.newValue);
        if (enabled === this._isAnalyticsEnabled) return;

        this._isAnalyticsEnabled = enabled;
        this._notifyAnalyticsConsentChanged();
    };

    /**
     * Initializes the identity and privacy settings from local storage.
     */
    public constructor() {
        this._loadAnalyticsConsentStatus();
        this._loadExistingIdentityState();
        this._loadPlayerProfiles();
        this._repairProfiles();
        window.addEventListener("storage", this._handleStorage);
    }

    /**
     * Anchors the identity and onboarding state (Device ID and Analytics Prompt Date)
     * if they have not already been initialized.
     */
    public initializeOnboarding(): void {
        this._ensureDeviceIdExists();
        this._ensureAnalyticsPromptDateIsAnchored();
    }

    /**
     * Returns the anonymous device ID, initializing it if necessary.
     *
     * @returns The unique ID string for this device.
     */
    public getDeviceId(): string {
        if (this._deviceId === null) {
            this._loadOrCreateDeviceId();
        }

        return this._deviceId as string;
    }

    /**
     * Returns whether the user has opted into score feedback.
     *
     * @returns True if score feedback is enabled, false otherwise.
     */
    public isAnalyticsEnabled(): boolean {
        return this._isAnalyticsEnabled;
    }

    /**
     * Updates the user's analytics consent.
     *
     * @param enabled - Whether analytics should be enabled.
     */
    public setAnalyticsConsent(enabled: boolean): void {
        if (enabled === this._isAnalyticsEnabled) return;

        this._isAnalyticsEnabled = enabled;
        localStorage.setItem(IdentityService._analyticsEnabledKey, JSON.stringify(enabled));
        this._notifyAnalyticsConsentChanged();
    }

    /**
     * Subscribes to analytics consent changes.
     *
     * @param callback - Listener receiving the current consent value.
     */
    public onAnalyticsConsentChanged(callback: (enabled: boolean) => void): void {
        this._onAnalyticsConsentChanged.push(callback);
    }

    /**
     * Checks if it is appropriate to show the analytics prompt.
     *
     * @returns True if analytics are disabled and enough time has passed since the last prompt.
     */
    public canShowAnalyticsPrompt(): boolean {
        if (this._isAnalyticsEnabled) {
            return false;
        }

        if (this._lastAnalyticsPromptDate === null) {
            return true;
        }

        const currentTimestamp: Date = new Date();
        const startOfToday: Date = this._getStartOfDate(currentTimestamp);
        const startOfLastPrompt: Date = this._getStartOfDate(this._lastAnalyticsPromptDate);

        const timeDifferenceMilliseconds: number = startOfToday.getTime() - startOfLastPrompt.getTime();
        const elapsedDaysSincePrompt: number = Math.floor(timeDifferenceMilliseconds / (1000 * 60 * 60 * 24));

        return elapsedDaysSincePrompt >= 7;
    }

    /**
     * Records that the analytics prompt was shown.
     *
     * @param date - The date to record, defaults to now.
     */
    public recordAnalyticsPrompt(date: Date = new Date()): void {
        this._lastAnalyticsPromptDate = date;
        localStorage.setItem(IdentityService._lastAnalyticsPromptKey, date.toISOString());
    }

    private _ensureDeviceIdExists(): void {
        if (this._deviceId === null) {
            this._loadOrCreateDeviceId();
        }
    }

    private _ensureAnalyticsPromptDateIsAnchored(): void {
        if (this._lastAnalyticsPromptDate === null) {
            const anchorDateForOnboarding: Date = new Date();
            anchorDateForOnboarding.setDate(anchorDateForOnboarding.getDate() - 6);

            this.recordAnalyticsPrompt(anchorDateForOnboarding);
        }
    }

    private _getStartOfDate(date: Date): Date {
        const midnightCopy: Date = new Date(date);
        const midnightValue: number = 0;

        midnightCopy.setHours(midnightValue, midnightValue, midnightValue, midnightValue);

        return midnightCopy;
    }

    private _loadOrCreateDeviceId(): void {
        const storedIdentifier: string | null = localStorage.getItem(IdentityService._deviceIdKey);

        if (storedIdentifier) {
            this._deviceId = storedIdentifier;
        } else {
            this._deviceId = crypto.randomUUID();
            localStorage.setItem(IdentityService._deviceIdKey, this._deviceId);
        }
    }

    private _loadAnalyticsConsentStatus(): void {
        const storedConsentJson: string | null = localStorage.getItem(IdentityService._analyticsEnabledKey);

        if (storedConsentJson !== null) {
            this._parseAndSetConsent(storedConsentJson);
        } else {
            this._isAnalyticsEnabled = false;
        }
    }

    private _parseAndSetConsent(jsonString: string): void {
        this._isAnalyticsEnabled = this._parseConsent(jsonString);
    }

    private _parseConsent(jsonString: string): boolean {
        try {
            return JSON.parse(jsonString) === true;
        } catch {
            return false;
        }
    }

    private _notifyAnalyticsConsentChanged(): void {
        this._onAnalyticsConsentChanged.forEach(
            (callback: (consent: boolean) => void): void => callback(this._isAnalyticsEnabled),
        );
    }

    private _loadExistingIdentityState(): void {
        this._deviceId = localStorage.getItem(IdentityService._deviceIdKey);

        const storedPromptDateString: string | null = localStorage.getItem(IdentityService._lastAnalyticsPromptKey);

        if (storedPromptDateString) {
            this._parseAndSetPromptDate(storedPromptDateString);
        }
    }

    private _parseAndSetPromptDate(dateString: string): void {
        const parsedDate: Date = new Date(dateString);

        if (!isNaN(parsedDate.getTime())) {
            this._lastAnalyticsPromptDate = parsedDate;
        }
    }

    /**
     * Returns true if at least one Kovaaks profile is currently linked.
     * 
     * @returns True if profiles list is not empty.
     */
    public hasLinkedAccount(): boolean {
        return this.getProfiles().length > 0;
    }

    /**
     * Gets the currently active player profile.
     * 
     * @returns The active profile or null if none.
     */
    public getActiveProfile(): PlayerProfile | null {
        if (!this._activeUsername) return null;

        return this._profiles.find((profile: PlayerProfile): boolean =>
            !profile.deletedAt && profile.username === this._activeUsername
        ) || null;
    }

    /**
     * Gets the username of the currently active player.
     * 
     * @returns The active username or null if none.
     */
    public getKovaaksUsername(): string | null {
        return this.getActiveProfile()?.username ?? null;
    }

    /**
     * Returns the list of all registered player profiles, excluding soft-deleted ones.
     * 
     * @returns The list of profiles.
     */
    public getProfiles(): PlayerProfile[] {
        return this._profiles.filter(profile => !profile.deletedAt);
    }

    /**
     * Adds a new player profile and makes it active.
     * @param profile
     */
    public addProfile(profile: PlayerProfile): void {
        const safeProfile: PlayerProfile = this._sanitizeProfile(profile);
        const existingIndex = this._profiles.findIndex(
            (existing: PlayerProfile): boolean => existing.username.toLowerCase() === safeProfile.username.toLowerCase(),
        );

        if (existingIndex !== -1) {
            // Re-activate and undelete if necessary
            const existing = this._profiles[existingIndex];
            let changed = false;

            if (existing.deletedAt) {
                const rest = { ...existing };
                delete rest.deletedAt;
                this._profiles[existingIndex] = rest;
                changed = true;
            }

            this.setActiveProfile(existing.username);

            if (changed) {
                this._persistState();
                this._notifyProfilesChanged();
            }

            return;
        }

        this._profiles.push(safeProfile);
        this._activeUsername = safeProfile.username;
        this._persistState();
        this._notifyProfilesChanged();
    }

    /**
     * Sets the active player by username.
     * @param username
     */
    public setActiveProfile(username: string): void {
        const normalizedUsername: string = username.toLowerCase();
        const profile = this._profiles.find((candidate: PlayerProfile): boolean =>
            !candidate.deletedAt && candidate.username.toLowerCase() === normalizedUsername
        );
        if (!profile || this._activeUsername === profile.username) return;

        this._activeUsername = profile.username;
        this._persistState();
        this._notifyProfilesChanged();
    }

    /**
     * Soft-deletes a player profile.
     * @param username
     */
    public removeProfile(username: string): void {
        const normalizedUsername: string = username.toLowerCase();
        const profileIndex = this._profiles.findIndex((profile: PlayerProfile): boolean =>
            profile.username.toLowerCase() === normalizedUsername
        );
        if (profileIndex === -1) return;

        // Perform soft delete
        const updatedProfile = { ...this._profiles[profileIndex], deletedAt: new Date().toISOString() };
        this._profiles[profileIndex] = updatedProfile;

        if (this._activeUsername === updatedProfile.username) {
            const remainingProfiles = this.getProfiles();
            this._activeUsername = remainingProfiles.length > 0 ? remainingProfiles[0].username : null;
        }

        this._persistState();
        this._notifyProfilesChanged();
    }

    /**
     * Permanently removes profiles that have been soft-deleted for more than 30 days.
     * @param historyService
     */
    public async performRetentionCleanup(historyService: HistoryService): Promise<void> {
        const retentionCutoff: number = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const profilesToDelete: PlayerProfile[] = this._profiles.filter((profile: PlayerProfile): boolean =>
            profile.deletedAt !== undefined && new Date(profile.deletedAt).getTime() < retentionCutoff
        );

        const deletedProfiles: PlayerProfile[] = [];
        for (const profile of profilesToDelete) {
            if (!this._isSameDeletedProfile(profile)) continue;

            await historyService.deletePlayerData(
                profile.username,
                profile.steamId,
                (): boolean => this._isSameDeletedProfile(profile),
            );
            if (this._isSameDeletedProfile(profile)) deletedProfiles.push(profile);
        }

        const confirmedDeletedProfiles: PlayerProfile[] = deletedProfiles.filter(
            (profile: PlayerProfile): boolean => this._isSameDeletedProfile(profile),
        );
        if (confirmedDeletedProfiles.length === 0) return;

        const deletedUsernames = new Set(confirmedDeletedProfiles.map(
            (profile: PlayerProfile): string => profile.username.toLowerCase(),
        ));
        confirmedDeletedProfiles.forEach(
            (profile: PlayerProfile): void => this._deleteProfileStorage(profile.username),
        );
        this._profiles = this._profiles.filter((profile: PlayerProfile): boolean =>
            !deletedUsernames.has(profile.username.toLowerCase())
        );
        this._persistState();
    }

    /**
     * Subscribes to changes in player profiles or active user.
     * @param callback
     */
    public onProfilesChanged(callback: () => void): void {
        this._onProfilesChanged.push(callback);
    }

    private _loadPlayerProfiles(): void {
        const storedProfiles = localStorage.getItem(IdentityService._playerProfilesKey);
        if (storedProfiles) {
            try {
                this._profiles = this._parseProfiles(JSON.parse(storedProfiles) as unknown);
            } catch {
                this._profiles = [];
            }
        }

        this._activeUsername = localStorage.getItem(IdentityService._activeUsernameKey);

        const activeProfile = this._activeUsername
            ? this._profiles.find((profile: PlayerProfile): boolean =>
                !profile.deletedAt && profile.username.toLowerCase() === this._activeUsername?.toLowerCase()
            )
            : null;
        if (!activeProfile) {
            this._activeUsername = this.getProfiles()[0]?.username ?? null;
        } else {
            this._activeUsername = activeProfile.username;
        }
    }

    private _parseProfiles(value: unknown): PlayerProfile[] {
        if (!Array.isArray(value)) return [];

        return value.flatMap((profile: unknown): PlayerProfile[] => {
            if (typeof profile !== "object" || profile === null || !("username" in profile) ||
                typeof profile.username !== "string" || profile.username.trim() === "") {
                return [];
            }

            const deletedAt: string | undefined = this._getValidDeletedAt(profile);

            return [{
                username: profile.username,
                pfpUrl: this._getSafeAvatarUrl(
                    "pfpUrl" in profile && typeof profile.pfpUrl === "string" ? profile.pfpUrl : "",
                ),
                steamId: "steamId" in profile && typeof profile.steamId === "string" ? profile.steamId : "",
                ...(deletedAt ? { deletedAt } : {}),
            }];
        });
    }

    private _getValidDeletedAt(profile: object): string | undefined {
        if (!("deletedAt" in profile) || typeof profile.deletedAt !== "string") return undefined;

        return Number.isFinite(new Date(profile.deletedAt).getTime()) ? profile.deletedAt : undefined;
    }

    private _deleteProfileStorage(username: string): void {
        const suffix: string = username.toLowerCase();
        [
            "raw_output_app_state",
            "session_service_state",
            "ranked_session_state_v2",
            "rank_identity_state_v2",
            "rank_penalty_lift_date",
        ].forEach((prefix: string): void => localStorage.removeItem(`${prefix}_${suffix}`));
    }

    private _sanitizeProfile(profile: PlayerProfile): PlayerProfile {
        return { ...profile, pfpUrl: this._getSafeAvatarUrl(profile.pfpUrl) };
    }

    private _getSafeAvatarUrl(source: string): string {
        try {
            const url = new URL(source);

            return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
        } catch {
            return "";
        }
    }

    private _isSameDeletedProfile(profile: PlayerProfile): boolean {
        return this._profiles.some((current: PlayerProfile): boolean =>
            current.username.toLowerCase() === profile.username.toLowerCase() &&
            current.deletedAt === profile.deletedAt
        );
    }

    private _persistState(): void {
        localStorage.setItem(IdentityService._playerProfilesKey, JSON.stringify(this._profiles));
        if (this._activeUsername) {
            localStorage.setItem(IdentityService._activeUsernameKey, this._activeUsername);
        } else {
            localStorage.removeItem(IdentityService._activeUsernameKey);
        }
    }

    private _notifyProfilesChanged(): void {
        this._onProfilesChanged.forEach(callback => callback());
    }

    private async _repairProfiles(): Promise<void> {
        let changed = false;
        const apiService = new KovaaksApiService();

        const profilesToRepair: PlayerProfile[] = this.getProfiles().filter(
            (profile: PlayerProfile): boolean => !profile.steamId,
        );
        for (const profile of profilesToRepair) {
            if (await this._repairProfile(apiService, profile)) changed = true;
        }

        if (changed) {
            this._persistState();
            this._notifyProfilesChanged();
        }
    }

    private async _repairProfile(apiService: KovaaksApiService, profile: PlayerProfile): Promise<boolean> {
        try {
            console.log(`[IdentityService] Repairing missing steamId for ${profile.username}...`);
            const searchResults = await apiService.searchUsers(profile.username);
            const match = searchResults.find(
                (user: KovaaksUserSearchResult): boolean => user.username === profile.username,
            );
            const currentIndex: number = this._profiles.findIndex((current: PlayerProfile): boolean =>
                !current.deletedAt && current.username.toLowerCase() === profile.username.toLowerCase()
            );
            if (!match?.steamId || currentIndex === -1 || this._profiles[currentIndex].steamId) return false;

            this._profiles[currentIndex] = { ...this._profiles[currentIndex], steamId: match.steamId };
            console.log(`[IdentityService] Repaired ${profile.username} with steamId: ${match.steamId}`);

            return true;
        } catch (error) {
            console.warn(`[IdentityService] Failed to repair profile ${profile.username}:`, error);

            return false;
        }
    }
}
