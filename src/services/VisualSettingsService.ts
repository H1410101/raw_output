import { ScalingLevel, SCALING_FACTORS } from "./ScalingService";

const BOOLEAN_SETTING_KEYS = [
  "showDotCloud", "showSessionBest", "showAllTimeBest", "showRankNotches",
  "highlightLatestRun", "showRankEstimate", "showRanks", "showIntervalsSettings",
  "playAnimationsUnfocused", "allowBackgroundPolling",
] as const;

const SCALING_SETTING_KEYS = [
  "dotSize", "visDotSize", "uiScaling", "marginSpacing", "verticalSpacing",
  "scenarioFontSize", "rankFontSize", "launchButtonSize", "headerFontSize",
  "labelFontSize", "categorySpacing", "dotCloudSize", "dotCloudWidth",
  "visRankFontSize", "dotJitterIntensity",
] as const;

export interface VisualSettings {
  theme: "dark" | "light";
  showDotCloud: boolean;
  dotOpacity: number;
  scalingMode: "Aligned" | "Floating";
  dotSize: ScalingLevel;
  visDotSize: ScalingLevel;
  uiScaling: ScalingLevel;
  marginSpacing: ScalingLevel;
  verticalSpacing: ScalingLevel;
  scenarioFontSize: ScalingLevel;
  rankFontSize: ScalingLevel;
  launchButtonSize: ScalingLevel;
  headerFontSize: ScalingLevel;
  labelFontSize: ScalingLevel;
  categorySpacing: ScalingLevel;
  dotCloudSize: ScalingLevel;
  dotCloudWidth: ScalingLevel;
  visRankFontSize: ScalingLevel;
  showSessionBest: boolean;
  showAllTimeBest: boolean;
  dotJitterIntensity: ScalingLevel;
  showRankNotches: boolean;
  highlightLatestRun: boolean;
  showRankEstimate: boolean;
  showRanks: boolean;
  audioVolume: number;
  showIntervalsSettings: boolean;
  playAnimationsUnfocused: boolean;
  allowBackgroundPolling: boolean;
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
    if (this._currentSettings[key] === value) return;

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

    root.setAttribute("data-theme", settings.theme);

    const apply = (varName: string, level: ScalingLevel): void => {
      root.style.setProperty(
        varName,
        (SCALING_FACTORS[level] ?? SCALING_FACTORS.Normal).toString(),
      );
    };

    apply("--ui-scale", settings.uiScaling);
    apply("--margin-spacing-multiplier", settings.marginSpacing);
    apply("--vertical-spacing-multiplier", settings.verticalSpacing);
    apply("--scenario-font-multiplier", settings.scenarioFontSize);
    apply("--rank-font-multiplier", settings.rankFontSize);
    apply("--launch-button-multiplier", settings.launchButtonSize);
    apply("--header-font-multiplier", settings.headerFontSize);
    apply("--label-font-multiplier", settings.labelFontSize);
    apply("--category-spacing-multiplier", settings.categorySpacing);
    apply("--dot-cloud-multiplier", settings.dotCloudSize);
    apply("--dot-cloud-width-multiplier", settings.dotCloudWidth);
    apply("--vis-rank-font-multiplier", settings.visRankFontSize);
    root.style.setProperty("--master-volume", (settings.audioVolume / 100).toString());
    this._syncThemeColorMeta();
  }

  private _syncThemeColorMeta(): void {
    const rootStyle: CSSStyleDeclaration = getComputedStyle(document.documentElement);
    const backgroundColor: string = rootStyle.getPropertyValue("--background-1").trim();

    if (!backgroundColor) {
      return;
    }

    this._updateMetaTag("theme-color", backgroundColor);
  }

  private _updateMetaTag(name: string, content: string): void {
    let meta: HTMLMetaElement | null = document.querySelector(
      `meta[name="${name}"]`,
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = name;
      document.head.appendChild(meta);
    }

    meta.content = content;
  }

  private _loadFromStorage(): VisualSettings {
    try {
      const stored: string | null = localStorage.getItem(
        VisualSettingsService._storageKey,
      );

      if (stored) {
        return this._parseSettings(JSON.parse(stored) as unknown);
      }
    } catch (error: unknown) {
      void error;
    }

    return this._getDefaults();
  }

  private _parseSettings(value: unknown): VisualSettings {
    const settings: VisualSettings = this._getDefaults();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return settings;

    const stored = value as Record<string, unknown>;
    this._applyBooleanSettings(settings, stored);
    this._applyScalingSettings(settings, stored);
    if (stored.theme === "dark" || stored.theme === "light") settings.theme = stored.theme;
    if (stored.scalingMode === "Aligned" || stored.scalingMode === "Floating") {
      settings.scalingMode = stored.scalingMode;
    }
    settings.dotOpacity = this._boundedNumber(stored.dotOpacity, settings.dotOpacity, 0, 100);
    settings.audioVolume = this._boundedNumber(stored.audioVolume, settings.audioVolume, 0, 100);

    return settings;
  }

  private _applyBooleanSettings(settings: VisualSettings, stored: Record<string, unknown>): void {
    BOOLEAN_SETTING_KEYS.forEach((key): void => {
      if (typeof stored[key] === "boolean") settings[key] = stored[key];
    });
  }

  private _applyScalingSettings(settings: VisualSettings, stored: Record<string, unknown>): void {
    SCALING_SETTING_KEYS.forEach((key): void => {
      const value: unknown = stored[key];
      if (typeof value === "string" && Object.hasOwn(SCALING_FACTORS, value)) {
        settings[key] = value as ScalingLevel;
      }
    });
  }

  private _boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(minimum, Math.min(maximum, value))
      : fallback;
  }

  private _getDefaults(): VisualSettings {
    return {
      theme: "dark",
      showDotCloud: true,
      dotOpacity: 50,
      scalingMode: "Aligned",
      dotSize: "Normal",
      visDotSize: "Normal",
      uiScaling: "Normal",
      marginSpacing: "Normal",
      verticalSpacing: "Normal",
      scenarioFontSize: "Normal",
      rankFontSize: "Normal",
      launchButtonSize: "Normal",
      headerFontSize: "Normal",
      labelFontSize: "Normal",
      categorySpacing: "Normal",
      dotCloudSize: "Normal",
      dotCloudWidth: "Normal",
      visRankFontSize: "Normal",
      showSessionBest: true, showAllTimeBest: true,
      dotJitterIntensity: "Normal",
      showRankNotches: true, highlightLatestRun: true,
      showRankEstimate: true, showRanks: true,
      audioVolume: 80,
      showIntervalsSettings: true,
      playAnimationsUnfocused: false,
      allowBackgroundPolling: true,
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
