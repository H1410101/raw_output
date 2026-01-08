export interface VisualSettings {
  showDotCloud: boolean;
  dotOpacity: number;
  scalingMode: "Aligned" | "Floating";
  dotSize: "Small" | "Medium" | "Large";
  rowHeight: "Compact" | "Normal" | "Spacious";
  scenarioFontSize: "Small" | "Medium" | "Large";
  rankFontSize: "Small" | "Medium" | "Large";
  showSessionBest: boolean;
  showAllTimeBest: boolean;
  dotJitter: boolean;
  showRankNotches: boolean;
  highlightLatestRun: boolean;
}

/**
 * Service for managing and persisting visual preferences and display settings.
 */
export class VisualSettingsService {
  private static readonly _storageKey: string = "visual_settings";

  private _currentSettings: VisualSettings;

  private _listeners: ((settings: VisualSettings) => void)[] = [];

  /**
   * Initializes the service and loads settings from local storage.
   */
  public constructor() {
    this._currentSettings = this._loadFromStorage();
  }

  /**
   * Retrieves a snapshot of the current visual settings.
   *
   * @returns A copy of the current settings.
   */
  public getSettings(): VisualSettings {
    return { ...this._currentSettings };
  }

  /**
   * Updates a specific visual setting and persists the change.
   *
   * @param key - The setting key to update.
   * @param value - The new value for the setting.
   */
  public updateSetting<K extends keyof VisualSettings>(
    key: K,
    value: VisualSettings[K],
  ): void {
    this._currentSettings[key] = value;

    this._saveToStorage();

    this._notifyListeners();
  }

  /**
   * Registers a listener to be notified when visual settings change.
   *
   * @param listener - Callback function receiving the updated settings.
   * @returns An unsubscription function.
   */
  public subscribe(listener: (settings: VisualSettings) => void): () => void {
    this._listeners.push(listener);

    listener(this.getSettings());

    return (): void => {
      this._listeners = this._listeners.filter(
        (existing: (settings: VisualSettings) => void): boolean =>
          existing !== listener,
      );
    };
  }

  private _loadFromStorage(): VisualSettings {
    try {
      const stored: string | null = localStorage.getItem(
        VisualSettingsService._storageKey,
      );

      if (stored) {
        return { ...this._getDefaults(), ...JSON.parse(stored) };
      }
    } catch (error: unknown) {
      void error;
    }

    return this._getDefaults();
  }

  private _getDefaults(): VisualSettings {
    return {
      showDotCloud: true,
      dotOpacity: 40,
      scalingMode: "Aligned",
      dotSize: "Medium",
      rowHeight: "Normal",
      scenarioFontSize: "Medium",
      rankFontSize: "Medium",
      showSessionBest: true,
      showAllTimeBest: true,
      dotJitter: true,
      showRankNotches: true,
      highlightLatestRun: true,
    };
  }

  private _saveToStorage(): void {
    try {
      const serialized: string = JSON.stringify(this._currentSettings);

      localStorage.setItem(VisualSettingsService._storageKey, serialized);
    } catch (error: unknown) {
      void error;
    }
  }

  private _notifyListeners(): void {
    const settings: VisualSettings = this.getSettings();

    this._listeners.forEach(
      (listener: (settings: VisualSettings) => void): void => {
        listener(settings);
      },
    );
  }
}
