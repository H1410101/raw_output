/**
 * Configuration parameters for session behavior.
 */
export interface SessionSettings {
  /** The number of minutes of inactivity before a session is considered expired. */
  sessionTimeoutMinutes: number;
  /** The interval used for ranked runs in minutes. */
  rankedIntervalMinutes: number;
}

/**
 * Manages persistence and notification of session-related configuration.
 */
export class SessionSettingsService {
  private static readonly _storageKey: string = "session_settings";
  private static readonly _maximumIntervalMinutes: number = 24 * 60;

  private _currentSettings: SessionSettings;

  private _listeners: ((settings: SessionSettings) => void)[] = [];

  /**
   * Initializes the service by loading settings from local storage.
   */
  public constructor() {
    this._currentSettings = this._loadFromStorage();
  }

  /**
   * Retrieves a snapshot of the current session settings.
   *
   * @returns A copy of the current settings.
   */
  public getSettings(): SessionSettings {
    return { ...this._currentSettings };
  }

  /**
   * Updates a specific session setting and persists the change.
   *
   * @param key - The setting key to update.
   * @param value - The new value for the setting.
   */
  public updateSetting<K extends keyof SessionSettings>(
    key: K,
    value: SessionSettings[K],
  ): void {
    if (!this._isValidInterval(value) || this._currentSettings[key] === value) {
      return;
    }

    this._currentSettings[key] = value;

    this._saveToStorage();

    this._notifyListeners();
  }

  /**
   * Subscribes to changes in session settings.
   *
   * @param listener - Callback function receiving updated settings.
   * @returns An unsubscription function.
   */
  public subscribe(listener: (settings: SessionSettings) => void): () => void {
    this._listeners.push(listener);

    listener(this.getSettings());

    return (): void => {
      this._listeners = this._listeners.filter(
        (existingListener: (settings: SessionSettings) => void): boolean =>
          existingListener !== listener,
      );
    };
  }

  private _loadFromStorage(): SessionSettings {
    try {
      const storedSettings: string | null = localStorage.getItem(
        SessionSettingsService._storageKey,
      );

      if (storedSettings) {
        return this._parseSettings(JSON.parse(storedSettings) as unknown);
      }
    } catch {
      // Fallback to defaults on corruption or access error
    }

    return this._getDefaults();
  }

  private _parseSettings(value: unknown): SessionSettings {
    const settings: SessionSettings = this._getDefaults();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return settings;

    const storedSettings = value as Record<string, unknown>;
    if (this._isValidInterval(storedSettings.sessionTimeoutMinutes)) {
      settings.sessionTimeoutMinutes = storedSettings.sessionTimeoutMinutes;
    }
    if (this._isValidInterval(storedSettings.rankedIntervalMinutes)) {
      settings.rankedIntervalMinutes = storedSettings.rankedIntervalMinutes;
    }

    return settings;
  }

  private _isValidInterval(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 &&
      value <= SessionSettingsService._maximumIntervalMinutes;
  }

  private _getDefaults(): SessionSettings {
    return {
      sessionTimeoutMinutes: 15,
      rankedIntervalMinutes: 5,
    };
  }

  private _saveToStorage(): void {
    try {
      const serializedSettings: string = JSON.stringify(this._currentSettings);

      localStorage.setItem(
        SessionSettingsService._storageKey,
        serializedSettings,
      );
    } catch {
      // Ignore storage errors to avoid crashing non-critical UI settings
    }
  }

  private _notifyListeners(): void {
    const settings: SessionSettings = this.getSettings();

    this._listeners.forEach(
      (listener: (settings: SessionSettings) => void): void => {
        listener(settings);
      },
    );
  }
}
