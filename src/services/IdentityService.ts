/**
 * Service responsible for managing user identity and privacy preferences.
 * Generates and persists a unique, anonymous device ID and tracks analytics consent.
 */
export class IdentityService {
    private static readonly _deviceIdKey: string = "raw_output_device_id";
    private static readonly _analyticsEnabledKey: string = "raw_output_analytics_consent";

    private _deviceId: string | null = null;
    private _isAnalyticsEnabled: boolean = false;

    /**
     * Initializes the identity and privacy settings from local storage.
     */
    public constructor() {
        this._loadOrCreateDeviceId();
        this._loadAnalyticsConsent();
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
     * Returns whether the user has opted into anonymous analytics.
     *
     * @returns True if analytics are enabled, false otherwise.
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
}
