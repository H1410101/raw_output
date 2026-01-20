/**
 * Service responsible for managing user identity and privacy preferences.
 * Generates and persists a unique, anonymous device ID and tracks analytics consent.
 */
export class IdentityService {
    private static readonly _deviceIdKey: string = "raw_output_device_id";
    private static readonly _analyticsEnabledKey: string = "raw_output_analytics_consent";
    private static readonly _lastAnalyticsPromptKey: string = "raw_output_analytics_last_prompt";

    private _deviceId: string | null = null;
    private _isAnalyticsEnabled: boolean = false;
    private _lastAnalyticsPromptDate: Date | null = null;

    /**
     * Initializes the identity and privacy settings from local storage.
     */
    public constructor() {
        this._loadOrCreateDeviceId();
        this._loadAnalyticsConsent();
        this._loadLastAnalyticsPromptDate();
    }

    /**
     * Returns the anonymous device ID.
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

        const today: Date = new Date();
        const midnight: number = 0;
        today.setHours(midnight, midnight, midnight, midnight);

        const lastPrompt: Date = new Date(this._lastAnalyticsPromptDate);
        lastPrompt.setHours(midnight, midnight, midnight, midnight);

        const diffTime: number = today.getTime() - lastPrompt.getTime();
        const diffDays: number = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 7;
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

    /**
     * Loads the device ID from storage or generates a new one if missing.
     */
    private _loadOrCreateDeviceId(): void {
        const storedId: string | null = localStorage.getItem(IdentityService._deviceIdKey);

        if (storedId) {
            this._deviceId = storedId;
        } else {
            this._deviceId = crypto.randomUUID();
            localStorage.setItem(IdentityService._deviceIdKey, this._deviceId);
        }
    }

    /**
     * Loads the analytics consent state from storage.
     */
    private _loadAnalyticsConsent(): void {
        const storedConsent: string | null = localStorage.getItem(IdentityService._analyticsEnabledKey);

        if (storedConsent !== null) {
            try {
                this._isAnalyticsEnabled = JSON.parse(storedConsent) === true;
            } catch {
                this._isAnalyticsEnabled = false;
            }
        } else {
            // Default to false (opt-in required)
            this._isAnalyticsEnabled = false;
        }
    }

    /**
     * Loads the last analytics prompt date or initializes it to 6 days ago.
     */
    private _loadLastAnalyticsPromptDate(): void {
        const storedDate: string | null = localStorage.getItem(IdentityService._lastAnalyticsPromptKey);

        if (storedDate) {
            const date: Date = new Date(storedDate);
            if (!isNaN(date.getTime())) {
                this._lastAnalyticsPromptDate = date;

                return;
            }
        }

        const sixDaysAgo: Date = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
        this.recordAnalyticsPrompt(sixDaysAgo);
    }
}
