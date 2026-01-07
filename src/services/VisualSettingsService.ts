export interface VisualSettings {
  showDotCloud: boolean;
  dotOpacity: number;
  scalingMode: "Aligned" | "Floating";
  dotSize: "Small" | "Medium" | "Large";
  rowHeight: "Compact" | "Normal" | "Spacious";
  scenarioFontSize: "Small" | "Medium" | "Large";
  rankFontSize: "Small" | "Medium" | "Large";
  showSessionBest: boolean;
  showRankBadges: boolean;
  dotJitter: boolean;
  showGridLines: boolean;
  highlightRecent: boolean;
}

export class VisualSettingsService {
  private static readonly _STORAGE_KEY = "visual_settings";

  private _currentSettings: VisualSettings;

  private _listeners: ((settings: VisualSettings) => void)[] = [];

  constructor() {
    this._currentSettings = this._loadFromStorage();
  }

  public getSettings(): VisualSettings {
    return { ...this._currentSettings };
  }

  public updateSetting<K extends keyof VisualSettings>(
    key: K,
    value: VisualSettings[K],
  ): void {
    this._currentSettings[key] = value;

    this._saveToStorage();

    this._notifyListeners();
  }

  public subscribe(listener: (settings: VisualSettings) => void): () => void {
    this._listeners.push(listener);

    listener(this.getSettings());

    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  private _loadFromStorage(): VisualSettings {
    try {
      const stored = localStorage.getItem(VisualSettingsService._STORAGE_KEY);

      if (stored) {
        return { ...this._getDefaults(), ...JSON.parse(stored) };
      }
    } catch (error) {
      // Fallback to defaults on error
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
      showRankBadges: true,
      dotJitter: true,
      showGridLines: true,
      highlightRecent: true,
    };
  }

  private _saveToStorage(): void {
    try {
      const serialized = JSON.stringify(this._currentSettings);

      localStorage.setItem(VisualSettingsService._STORAGE_KEY, serialized);
    } catch (error) {
      // Ignore storage errors
    }
  }

  private _notifyListeners(): void {
    const settings = this.getSettings();

    this._listeners.forEach((listener) => listener(settings));
  }
}
