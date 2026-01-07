/**
 * Configuration parameters for session behavior.
 */
export interface SessionSettings {
  /**
   * The number of minutes of inactivity before a session is considered expired.
   */
  sessionTimeoutMinutes: number;
}

/**
 * Responsibility: Manage persistence and notification of session-related configuration.
 */
export class SessionSettingsService {
  private static readonly _STORAGE_KEY = "session_settings";

  private _currentSettings: SessionSettings;

  private _listeners: ((settings: SessionSettings) => void)[] = [];

  constructor() {
    this._currentSettings = this._load_from_storage();
  }

  /**
   * Retrieves a snapshot of the current session settings.
   */
  public get_settings(): SessionSettings {
    return { ...this._currentSettings };
  }

  /**
   * Updates a specific session setting and persists the change.
   */
  public update_setting<K extends keyof SessionSettings>(
    key: K,
    value: SessionSettings[K],
  ): void {
    this._currentSettings[key] = value;

    this._save_to_storage();

    this._notify_listeners();
  }

  /**
   * Subscribes to changes in session settings.
   * Immediately calls the listener with the current settings upon subscription.
   */
  public subscribe(listener: (settings: SessionSettings) => void): () => void {
    this._listeners.push(listener);

    listener(this.get_settings());

    return () => {
      this._listeners = this._listeners.filter(
        (existing_listener) => existing_listener !== listener,
      );
    };
  }

  private _load_from_storage(): SessionSettings {
    try {
      const stored_settings = localStorage.getItem(
        SessionSettingsService._STORAGE_KEY,
      );

      if (stored_settings) {
        return {
          ...this._get_defaults(),
          ...JSON.parse(stored_settings),
        };
      }
    } catch (error) {
      // Fallback to defaults
    }

    return this._get_defaults();
  }

  private _get_defaults(): SessionSettings {
    return {
      sessionTimeoutMinutes: 10,
    };
  }

  private _save_to_storage(): void {
    try {
      const serialized_settings = JSON.stringify(this._currentSettings);

      localStorage.setItem(
        SessionSettingsService._STORAGE_KEY,
        serialized_settings,
      );
    } catch (error) {
      // Ignore storage errors
    }
  }

  private _notify_listeners(): void {
    const settings = this.get_settings();

    this._listeners.forEach((listener) => {
      listener(settings);
    });
  }
}
