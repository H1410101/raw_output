import { SettingsUiFactory } from "../ui/SettingsUiFactory";
import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../../services/SessionSettingsService";

/**
 * Handles the construction and event wiring of specific sections within the settings menu.
 */
export class SettingsSectionRenderer {
  private readonly _visualSettingsService: VisualSettingsService;

  private readonly _sessionSettingsService: SessionSettingsService;

  /**
   * Initializes the renderer with the required configuration services.
   *
   * @param visualSettingsService - Service for managing visualization and layout settings.
   * @param sessionSettingsService - Service for managing session-specific settings.
   */
  public constructor(
    visualSettingsService: VisualSettingsService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._visualSettingsService = visualSettingsService;

    this._sessionSettingsService = sessionSettingsService;
  }

  /**
   * Appends the visualization-related settings group to the provided container.
   *
   * @param container - The parent container element.
   * @param settings - The current visual settings state.
   */
  public appendVisualizationSection(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Visualization"));

    this._appendDotCloudConfiguration(container, settings);
  }

  /**
   * Appends the layout and sizing settings group to the provided container.
   *
   * @param container - The parent container element.
   * @param settings - The current visual settings state.
   */
  public appendLayoutSection(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Layout"));

    this._appendSizeConfiguration(container, settings);

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show Session Best",
        settings.showSessionBest,
        (checked: boolean): void =>
          this._visualSettingsService.updateSetting("showSessionBest", checked),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show All-Time Best",
        settings.showAllTimeBest,
        (checked: boolean): void =>
          this._visualSettingsService.updateSetting("showAllTimeBest", checked),
      ),
    );
  }

  /**
   * Appends the audio settings group, including placeholder logic.
   *
   * @param container - The parent container element.
   */
  public appendAudioSection(container: HTMLElement): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Audio"));

    const subRowsContainer: HTMLDivElement = document.createElement("div");

    subRowsContainer.className = "settings-sub-rows hidden";

    this._fillAudioPlaceholders(subRowsContainer);

    const masterVolume: HTMLElement = SettingsUiFactory.createSlider({
      label: "Master Volume (Placeholder)",
      unit: "%",
      value: 0,
      min: 0,
      max: 100,
      showNotch: true,
      onChange: (value: number): void =>
        this._toggleVisibility(subRowsContainer, value > 0),
    });

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(masterVolume, subRowsContainer),
    );
  }

  /**
   * Appends the session-related configuration group.
   *
   * @param container - The parent container element.
   * @param settings - The current session settings state.
   */
  public appendSessionSection(
    container: HTMLElement,
    settings: SessionSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Session"));

    const intervalSlider: HTMLElement = SettingsUiFactory.createSlider({
      label: "Session Interval",
      unit: "min",
      value: settings.sessionTimeoutMinutes,
      options: [1, 5, 10, 15, 30, 60, 120],
      showNotch: false,
      onChange: (value: number): void =>
        this._sessionSettingsService.updateSetting(
          "sessionTimeoutMinutes",
          value,
        ),
    });

    container.appendChild(intervalSlider);
  }

  private _appendDotCloudConfiguration(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRowsContainer: HTMLDivElement = document.createElement("div");

    const visibilityClass: string = settings.showDotCloud ? "" : "hidden";

    subRowsContainer.className = `settings-sub-rows ${visibilityClass}`;

    this._createDotCloudSubRows(settings).forEach((row: HTMLElement): void => {
      subRowsContainer.appendChild(row);
    });

    const mainToggle: HTMLElement = SettingsUiFactory.createToggle(
      "Dot Cloud",
      settings.showDotCloud,
      (checked: boolean): void => {
        this._visualSettingsService.updateSetting("showDotCloud", checked);
        this._toggleVisibility(subRowsContainer, checked);
      },
    );

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(mainToggle, subRowsContainer),
    );
  }

  private _createDotCloudSubRows(settings: VisualSettings): HTMLElement[] {
    return [
      this._createDotOpacitySlider(settings),
      this._createDotBoundsControl(settings),
      this._createDotSizeControl(settings),
      this._createDotJitterToggle(settings),
      this._createHighlightLatestToggle(settings),
      this._createRankNotchToggle(settings),
    ];
  }

  private _createDotOpacitySlider(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSlider({
      label: "Dot Opacity",
      unit: "%",
      value: settings.dotOpacity,
      min: 10,
      max: 100,
      onChange: (val: number): void =>
        this._visualSettingsService.updateSetting("dotOpacity", val),
    });
  }

  private _createDotBoundsControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Dot Cloud Bounds",
      ["Aligned", "Floating"],
      settings.scalingMode,
      (val: string): void =>
        this._visualSettingsService.updateSetting(
          "scalingMode",
          val as "Aligned" | "Floating",
        ),
    );
  }

  private _createDotSizeControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Dot Size",
      ["Small", "Medium", "Large"],
      settings.dotSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting(
          "dotSize",
          val as "Small" | "Medium" | "Large",
        ),
    );
  }

  private _createDotJitterToggle(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createToggle(
      "Jitter Dots",
      settings.dotJitter,
      (checked: boolean): void =>
        this._visualSettingsService.updateSetting("dotJitter", checked),
    );
  }

  private _createHighlightLatestToggle(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createToggle(
      "Highlight Latest Run",
      settings.highlightLatestRun,
      (checked: boolean): void =>
        this._visualSettingsService.updateSetting(
          "highlightLatestRun",
          checked,
        ),
    );
  }

  private _createRankNotchToggle(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createToggle(
      "Show Rank Notches",
      settings.showRankNotches,
      (checked: boolean): void =>
        this._visualSettingsService.updateSetting("showRankNotches", checked),
    );
  }

  private _appendSizeConfiguration(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRowsContainer: HTMLDivElement = document.createElement("div");

    subRowsContainer.className = "settings-sub-rows";

    this._createSizeSubRows(settings).forEach((row: HTMLElement): void => {
      subRowsContainer.appendChild(row);
    });

    const masterScaling: HTMLElement = SettingsUiFactory.createSegmentedControl(
      "Master Scaling",
      ["0.8x", "1.0x", "1.2x"],
      "1.0x",
      (): void => {},
    );

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(masterScaling, subRowsContainer),
    );
  }

  private _createSizeSubRows(settings: VisualSettings): HTMLElement[] {
    return [
      this._createRowHeightControl(settings),
      this._createScenarioFontControl(settings),
      this._createRankFontControl(settings),
    ];
  }

  private _createRowHeightControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Row Height",
      ["Compact", "Normal", "Spacious"],
      settings.rowHeight,
      (val: string): void =>
        this._visualSettingsService.updateSetting(
          "rowHeight",
          val as "Compact" | "Normal" | "Spacious",
        ),
    );
  }

  private _createScenarioFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Scenario Font Size",
      ["Small", "Medium", "Large"],
      settings.scenarioFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting(
          "scenarioFontSize",
          val as "Small" | "Medium" | "Large",
        ),
    );
  }

  private _createRankFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Rank Font Size",
      ["Small", "Medium", "Large"],
      settings.rankFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting(
          "rankFontSize",
          val as "Small" | "Medium" | "Large",
        ),
    );
  }

  private _toggleVisibility(container: HTMLElement, isVisible: boolean): void {
    if (isVisible) {
      container.classList.remove("hidden");

      this._enableScrollAfterDelay(container);

      return;
    }

    container.classList.add("hidden");

    container.style.overflowY = "hidden";
  }

  private _enableScrollAfterDelay(container: HTMLElement): void {
    container.style.overflowY = "hidden";

    setTimeout((): void => {
      if (!container.classList.contains("hidden")) {
        container.style.overflowY = "auto";
      }
    }, 250);
  }

  private _fillAudioPlaceholders(container: HTMLElement): void {
    for (let i: number = 1; i <= 7; i++) {
      const item: HTMLDivElement = document.createElement("div");

      item.className = "setting-item";

      item.innerHTML = `<label>Audio Placeholder ${i}</label>`;

      container.appendChild(item);
    }
  }
}
