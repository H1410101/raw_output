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

    /**
     * Initializes the identity and privacy settings from local storage.
     */
    public constructor() {
        this._loadAnalyticsConsentStatus();
        this._loadExistingIdentityState();
        this._loadPlayerProfiles();
        this._repairProfiles();
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
        this._isAnalyticsEnabled = enabled;
        localStorage.setItem(IdentityService._analyticsEnabledKey, JSON.stringify(enabled));
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
        try {
            this._isAnalyticsEnabled = JSON.parse(jsonString) === true;
        } catch {
            this._isAnalyticsEnabled = false;
        }
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
        return this._profiles.length > 0;
    }

    /**
     * Gets the currently active player profile.
     * 
     * @returns The active profile or null if none.
     */
    public getActiveProfile(): PlayerProfile | null {
        if (!this._activeUsername) return null;

        return this._profiles.find(profile => profile.username === this._activeUsername) || null;
    }

    /**
     * Gets the username of the currently active player.
     * 
     * @returns The active username or null if none.
     */
    public getKovaaksUsername(): string | null {
        return this._activeUsername;
    }

    /**
     * Returns the list of all registered player profiles.
     * 
     * @returns The list of profiles.
     */
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
        const existingIndex = this._profiles.findIndex(prof => prof.username.toLowerCase() === profile.username.toLowerCase());

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

            this.setActiveProfile(profile.username);

            if (changed) {
                this._persistState();
                this._notifyProfilesChanged();
            }

            return;
        }

        this._profiles.push(profile);
        this._activeUsername = profile.username;
        this._persistState();
        this._notifyProfilesChanged();
    }

    /**
     * Sets the active player by username.
     * @param username
     */
    public setActiveProfile(username: string): void {
        if (this._activeUsername === username) return;

        const profile = this._profiles.find(prof => prof.username === username);
        if (profile) {
            this._activeUsername = username;
            this._persistState();
            this._notifyProfilesChanged();
        }
    }

    /**
     * Removes a player profile.
     * @param username
     */
    /**
     * Soft-deletes a player profile.
     * @param username
     */
    public removeProfile(username: string): void {
        const profileIndex = this._profiles.findIndex(profile => profile.username === username);
        if (profileIndex === -1) return;

        // Perform soft delete
        const updatedProfile = { ...this._profiles[profileIndex], deletedAt: new Date().toISOString() };
        this._profiles[profileIndex] = updatedProfile;

        if (this._activeUsername === username) {
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
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        const profilesToDelete: PlayerProfile[] = [];

        this._profiles = this._profiles.filter(profile => {
            if (profile.deletedAt) {
                const deletedDate = new Date(profile.deletedAt);
                if (deletedDate < thirtyDaysAgo) {
                    profilesToDelete.push(profile);

                    // Remove from local state
                    return false;
                }
            }

            // Keep in local state
            return true;
        });

        if (profilesToDelete.length > 0) {
            this._persistState();
            // We don't necessarily need to notify profiles changed if these were already hidden, 
            // but it's safer to do so in case UI was holding onto stale data? 
            // Actually, hidden profiles wouldn't be shown anyway. 
            // But let's verify if `activeUsername` needs update? 
            // Soft deleted profiles shouldn't be active.

            for (const profile of profilesToDelete) {
                await historyService.deletePlayerData(profile.username);
            }
        }
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
                this._profiles = JSON.parse(storedProfiles) as PlayerProfile[];
            } catch {
                this._profiles = [];
            }
        }

        this._activeUsername = localStorage.getItem(IdentityService._activeUsernameKey);

        // Ensure active user exists in profiles
        if (this._activeUsername && !this._profiles.some(profile => profile.username === this._activeUsername)) {
            this._activeUsername = this._profiles.length > 0 ? this._profiles[0].username : null;
        }
    }

    private _persistState(): void {
        localStorage.setItem(IdentityService._playerProfilesKey, JSON.stringify(this._profiles));
        if (this._activeUsername) {
            localStorage.setItem(IdentityService._activeUsernameKey, this._activeUsername);
        } else {
            localStorage.removeItem(IdentityService._activeUsernameKey);
        }
    }

    private async _notifyProfilesChanged(): Promise<void> {
        this._onProfilesChanged.forEach(callback => callback());
    }

    private async _repairProfiles(): Promise<void> {
        let changed = false;
        const apiService = new KovaaksApiService();

        for (let i = 0; i < this._profiles.length; i++) {
            const profile = this._profiles[i];
            if (!profile.steamId) {
                try {
                    console.log(`[IdentityService] Repairing missing steamId for ${profile.username}...`);
                    const searchResults = await apiService.searchUsers(profile.username);
                    const match = searchResults.find((user: KovaaksUserSearchResult): boolean => user.username === profile.username);

                    if (match && match.steamId) {
                        this._profiles[i] = {
                            ...profile,
                            steamId: match.steamId
                        };
                        changed = true;
                        console.log(`[IdentityService] Repaired ${profile.username} with steamId: ${match.steamId}`);
                    }
                } catch (error) {
                    console.warn(`[IdentityService] Failed to repair profile ${profile.username}:`, error);
                }
            }
        }

        if (changed) {
            this._persistState();
            this._notifyProfilesChanged();
        }
    }
}
