import { ScalingLevel, SCALING_FACTORS } from "./ScalingService";

export interface VisualSettings {
  showDotCloud: boolean;
  dotOpacity: number;
  scalingMode: "Aligned" | "Floating";
  dotSize: ScalingLevel;
  visDotSize: ScalingLevel;
  masterScaling: ScalingLevel;
  verticalSpacing: ScalingLevel;
  scenarioFontSize: ScalingLevel;
  rankFontSize: ScalingLevel;
  launchButtonSize: ScalingLevel;
  headerFontSize: ScalingLevel;
  labelFontSize: ScalingLevel;
  dotCloudSize: ScalingLevel;
  dotCloudWidth: ScalingLevel;
  visRankFontSize: ScalingLevel;
  showSessionBest: boolean;
  showAllTimeBest: boolean;
  dotJitterIntensity: ScalingLevel;
  showRankNotches: boolean;
  highlightLatestRun: boolean;
  audioVolume: number;
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
    this._applyCssVariables(this._currentSettings);
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
    this._applyCssVariables(this._currentSettings);
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

  private _applyCssVariables(settings: VisualSettings): void {
    const root: HTMLElement = document.documentElement;

    const apply = (varName: string, level: ScalingLevel): void => {
      root.style.setProperty(
        varName,
        (SCALING_FACTORS[level] ?? SCALING_FACTORS.Normal).toString(),
      );
    };

    apply("--master-scale", settings.masterScaling);
    apply("--vertical-spacing-multiplier", settings.verticalSpacing);
    apply("--scenario-font-multiplier", settings.scenarioFontSize);
    apply("--rank-font-multiplier", settings.rankFontSize);
    apply("--launch-button-multiplier", settings.launchButtonSize);
    apply("--header-font-multiplier", settings.headerFontSize);
    apply("--label-font-multiplier", settings.labelFontSize);
    apply("--dot-cloud-multiplier", settings.dotCloudSize);
    apply("--dot-cloud-width-multiplier", settings.dotCloudWidth);
    apply("--vis-rank-font-multiplier", settings.visRankFontSize);
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
      dotSize: "Normal",
      visDotSize: "Normal",
      masterScaling: "Normal",
      verticalSpacing: "Normal",
      scenarioFontSize: "Normal",
      rankFontSize: "Normal",
      launchButtonSize: "Normal",
      headerFontSize: "Normal",
      labelFontSize: "Normal",
      dotCloudSize: "Normal",
      dotCloudWidth: "Normal",
      visRankFontSize: "Normal",
      showSessionBest: true,
      showAllTimeBest: true,
      dotJitterIntensity: "Normal",
      showRankNotches: true,
      highlightLatestRun: true,
      audioVolume: 80,
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
