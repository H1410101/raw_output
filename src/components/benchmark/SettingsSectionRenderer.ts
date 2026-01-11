import { SettingsUiFactory } from "../ui/SettingsUiFactory";
import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import { ScalingLevel } from "../../services/ScalingService";
import { SessionSettingsService } from "../../services/SessionSettingsService";

/**
 * Responsible for rendering specific sections of the settings menu.
 */
export class SettingsSectionRenderer {
  private readonly _visualSettingsService: VisualSettingsService;

  private static readonly _scalingOptions: ScalingLevel[] = [
    "Min",
    "Small",
    "Normal",
    "Large",
    "Max",
  ];

  /**
   * Initializes the renderer with required services.
   *
   * @param visualSettingsService - Service for managing visual configuration.
   * @param sessionSettingsService - Service for managing session-specific settings.
   */
  private readonly _sessionSettingsService: SessionSettingsService;

  /**
   * Initializes the renderer with required services.
   *
   * @param visualSettingsService - Service for managing visual configuration.
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
   * Builds and appends the unified elements settings section.
   *
   * @param container - The element to append settings to.
   * @param settings - Current visual settings.
   */
  public appendElementsSection(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Elements"));

    this._appendDotCloudToggle(container, settings);
    this._appendSessionToggles(container, settings);
    container.appendChild(this._createSessionIntervalSlider());
  }

  private _appendDotCloudToggle(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const dotCloudToggle: HTMLElement = SettingsUiFactory.createToggle(
      "Show Dot Cloud",
      settings.showDotCloud,
      (val: boolean): void =>
        this._visualSettingsService.updateSetting("showDotCloud", val),
    );

    const dotCloudSubRows: HTMLDivElement = document.createElement("div");
    dotCloudSubRows.className = "settings-sub-rows";
    if (!settings.showDotCloud) {
      dotCloudSubRows.classList.add("hidden");
    }

    this._appendDotCloudOptions(dotCloudSubRows, settings);
    container.appendChild(
      SettingsUiFactory.createSettingsGroup(dotCloudToggle, dotCloudSubRows),
    );
  }

  private _appendSessionToggles(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show Session Best",
        settings.showSessionBest,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("showSessionBest", val),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show All-Time Best",
        settings.showAllTimeBest,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("showAllTimeBest", val),
      ),
    );
  }

  private _appendDotCloudOptions(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(this._createVisDotSizeControl(settings));
    container.appendChild(this._createVisRankFontControl(settings));

    container.appendChild(this._createDotOpacitySlider(settings));
    container.appendChild(this._createDotJitterControl(settings));

    this._appendDotCloudToggles(container, settings);
  }

  private _createDotOpacitySlider(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSlider({
      label: "Dot Opacity",
      value: settings.dotOpacity,
      min: 10,
      max: 100,
      unit: "%",
      onChange: (val: number): void =>
        this._visualSettingsService.updateSetting("dotOpacity", val),
    });
  }

  private _createDotJitterControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Dot Jitter",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.dotJitterIntensity,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "dotJitterIntensity",
          val as ScalingLevel,
        ),
      typeOverride: "left-aligned",
      notchIndexOverride: 0,
    });
  }

  private _appendDotCloudToggles(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show Rank Notches",
        settings.showRankNotches,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("showRankNotches", val),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Highlight Latest",
        settings.highlightLatestRun,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("highlightLatestRun", val),
      ),
    );
  }

  /**
   * Builds and appends the layout settings section.
   *
   * @param container - The element to append settings to.
   * @param settings - Current visual settings.
   */
  public appendLayoutSection(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Layout Scaling"));
    this._appendScalingConfiguration(container, settings);
  }

  /**
   * Builds and appends the audio settings section.
   *
   * @param container - The element to append settings to.
   */
  public appendAudioSection(container: HTMLElement): void {
    const settings: VisualSettings = this._visualSettingsService.getSettings();
    container.appendChild(SettingsUiFactory.createGroupTitle("Audio"));

    const volumeSlider: HTMLElement = SettingsUiFactory.createSlider({
      label: "Master Volume",
      value: settings.audioVolume,
      min: 0,
      max: 100,
      unit: "%",
      showNotch: true,
      onChange: (val: number): void =>
        this._visualSettingsService.updateSetting("audioVolume", val),
    });

    const audioSubRows: HTMLDivElement = document.createElement("div");
    audioSubRows.className = "settings-sub-rows";
    this._fillAudioPlaceholders(audioSubRows);

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(volumeSlider, audioSubRows),
    );
  }

  private _createSessionIntervalSlider(): HTMLElement {
    const sessionSettings = this._sessionSettingsService.getSettings();
    const options: number[] = [1, 5, 10, 15, 30, 45, 60, 90, 120];

    return SettingsUiFactory.createSlider({
      label: "Session Interval",
      value: sessionSettings.sessionTimeoutMinutes,
      options,
      unit: " min",
      onChange: (val: number): void =>
        this._sessionSettingsService.updateSetting(
          "sessionTimeoutMinutes",
          val,
        ),
    });
  }

  private _createVisRankFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Rank Text Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.visRankFontSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "visRankFontSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createVisDotSizeControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Vis Dot Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.visDotSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "visDotSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createDotCloudHeightControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Dot Cloud Height",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.dotCloudSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "dotCloudSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createDotCloudWidthControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Dot Cloud Width",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.dotCloudWidth,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "dotCloudWidth",
          val as ScalingLevel,
        ),
    });
  }

  private _appendScalingConfiguration(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRowsContainer: HTMLDivElement = document.createElement("div");
    subRowsContainer.className = "settings-sub-rows";

    this._appendScalingSubRows(subRowsContainer, settings);

    const uiScaling: HTMLElement = SettingsUiFactory.createSegmentedControl({
      label: "UI Scale",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.uiScaling,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "uiScaling",
          val as ScalingLevel,
        ),
    });

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(uiScaling, subRowsContainer),
    );
  }

  private _appendScalingSubRows(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRows: HTMLElement[] = [
      this._createMarginSpacingControl(settings),
      this._createVerticalSpacingControl(settings),
      this._createScenarioFontControl(settings),
      this._createRankFontControl(settings),
      this._createLaunchButtonSizeControl(settings),
      this._createHeaderFontControl(settings),
      this._createLabelFontControl(settings),
      this._createCategorySpacingControl(settings),
      this._createDotCloudHeightControl(settings),
      this._createDotCloudWidthControl(settings),
    ];

    subRows.forEach((row: HTMLElement): void => {
      container.appendChild(row);
    });
  }

  private _createMarginSpacingControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Margin Spacing",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.marginSpacing,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "marginSpacing",
          val as ScalingLevel,
        ),
    });
  }

  private _createVerticalSpacingControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Vertical Spacing",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.verticalSpacing,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "verticalSpacing",
          val as ScalingLevel,
        ),
    });
  }

  private _createScenarioFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Scenario Name Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.scenarioFontSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "scenarioFontSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createRankFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Rank Display Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.rankFontSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "rankFontSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createLaunchButtonSizeControl(
    settings: VisualSettings,
  ): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Launch Button Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.launchButtonSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "launchButtonSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createHeaderFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Header Text Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.headerFontSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "headerFontSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createLabelFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Category Label Size",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.labelFontSize,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "labelFontSize",
          val as ScalingLevel,
        ),
    });
  }

  private _createCategorySpacingControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl({
      label: "Category Spacing",
      options: SettingsSectionRenderer._scalingOptions,
      currentValue: settings.categorySpacing,
      onChange: (val: string): void =>
        this._visualSettingsService.updateSetting(
          "categorySpacing",
          val as ScalingLevel,
        ),
    });
  }

  private _fillAudioPlaceholders(container: HTMLElement): void {
    for (let i: number = 1; i <= 3; i++) {
      const item: HTMLDivElement = document.createElement("div");
      item.className = "setting-item";
      item.innerHTML = `<label>Audio Source ${i}</label>`;
      container.appendChild(item);
    }
  }
}
