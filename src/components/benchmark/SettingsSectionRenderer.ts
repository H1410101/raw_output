import { SettingsUiFactory } from "../ui/SettingsUiFactory";
import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import { ScalingLevel } from "../../services/ScalingService";
import {
  SessionSettingsService,
} from "../../services/SessionSettingsService";

/**
 * Responsible for rendering specific sections of the settings menu.
 */
export class SettingsSectionRenderer {
  private readonly _visualSettingsService: VisualSettingsService;

  private static readonly _SCALING_OPTIONS: ScalingLevel[] = ["Min", "Small", "Normal", "Large", "Max"];

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
    void sessionSettingsService;
  }

  /**
   * Builds and appends the visualization settings section.
   *
   * @param container - The element to append settings to.
   * @param settings - Current visual settings.
   */
  public appendVisualizationSection(container: HTMLElement, settings: VisualSettings): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Visualization"));

    // Nested Dot Cloud Settings
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
    container.appendChild(SettingsUiFactory.createSettingsGroup(dotCloudToggle, dotCloudSubRows));
  }

  private _appendDotCloudOptions(container: HTMLElement, settings: VisualSettings): void {
    container.appendChild(this._createVisDotSizeControl(settings));
    container.appendChild(this._createVisRankFontControl(settings));

    container.appendChild(
      SettingsUiFactory.createSlider({
        label: "Dot Opacity",
        value: settings.dotOpacity,
        min: 10,
        max: 100,
        unit: "%",
        onChange: (val: number): void =>
          this._visualSettingsService.updateSetting("dotOpacity", val),
      }),
    );

    container.appendChild(
      SettingsUiFactory.createSegmentedControl(
        "Dot Jitter",
        SettingsSectionRenderer._SCALING_OPTIONS,
        settings.dotJitterIntensity,
        (val: string): void =>
          this._visualSettingsService.updateSetting(
            "dotJitterIntensity",
            val as ScalingLevel,
          ),
        "left-aligned",
        0,
      ),
    );

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
  public appendLayoutSection(container: HTMLElement, settings: VisualSettings): void {
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

    container.appendChild(SettingsUiFactory.createSettingsGroup(volumeSlider, audioSubRows));
  }

  /**
   * Builds and appends the session settings section.
   *
   * @param container - The element to append settings to.
   * @param settings - Current session settings.
   */
  public appendSessionSection(container: HTMLElement, settings: any): void {
    const visualSettings: VisualSettings = this._visualSettingsService.getSettings();

    container.appendChild(SettingsUiFactory.createGroupTitle("Information"));

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show Session Best",
        visualSettings.showSessionBest,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("showSessionBest", val),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle(
        "Show All-Time Best",
        visualSettings.showAllTimeBest,
        (val: boolean): void =>
          this._visualSettingsService.updateSetting("showAllTimeBest", val),
      ),
    );

    void settings;
  }

  private _createVisRankFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Rank Text Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.visRankFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("visRankFontSize", val as ScalingLevel),
    );
  }

  private _createVisDotSizeControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Vis Dot Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.visDotSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("visDotSize", val as ScalingLevel),
    );
  }

  private _createDotCloudHeightControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Dot Cloud Height",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.dotCloudSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("dotCloudSize", val as ScalingLevel),
    );
  }

  private _createDotCloudWidthControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Dot Cloud Width",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.dotCloudWidth,
      (val: string): void =>
        this._visualSettingsService.updateSetting("dotCloudWidth", val as ScalingLevel),
    );
  }

  private _appendScalingConfiguration(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRowsContainer: HTMLDivElement = document.createElement("div");
    subRowsContainer.className = "settings-sub-rows";

    this._appendScalingSubRows(subRowsContainer, settings);

    const masterScaling: HTMLElement = SettingsUiFactory.createSegmentedControl(
      "Master Scale",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.masterScaling,
      (val: string): void =>
        this._visualSettingsService.updateSetting("masterScaling", val as ScalingLevel),
    );

    container.appendChild(SettingsUiFactory.createSettingsGroup(masterScaling, subRowsContainer));
  }

  private _appendScalingSubRows(container: HTMLElement, settings: VisualSettings): void {
    const subRows: HTMLElement[] = [
      this._createVerticalSpacingControl(settings),
      this._createScenarioFontControl(settings),
      this._createRankFontControl(settings),
      this._createLaunchButtonSizeControl(settings),
      this._createHeaderFontControl(settings),
      this._createLabelFontControl(settings),
      this._createDotCloudHeightControl(settings),
      this._createDotCloudWidthControl(settings),
      this._createHorizontalSpacingControl(settings),
    ];

    subRows.forEach((row: HTMLElement): void => {
      container.appendChild(row);
    });
  }

  private _createHorizontalSpacingControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Horizontal Spacing",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.horizontalSpacing,
      (val: string): void =>
        this._visualSettingsService.updateSetting("horizontalSpacing", val as ScalingLevel),
    );
  }

  private _createVerticalSpacingControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Vertical Spacing",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.verticalSpacing,
      (val: string): void =>
        this._visualSettingsService.updateSetting("verticalSpacing", val as ScalingLevel),
    );
  }

  private _createScenarioFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Scenario Name Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.scenarioFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("scenarioFontSize", val as ScalingLevel),
    );
  }

  private _createRankFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Rank Display Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.rankFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("rankFontSize", val as ScalingLevel),
    );
  }

  private _createLaunchButtonSizeControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Launch Button Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.launchButtonSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("launchButtonSize", val as ScalingLevel),
    );
  }

  private _createHeaderFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Header Text Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.headerFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("headerFontSize", val as ScalingLevel),
    );
  }

  private _createLabelFontControl(settings: VisualSettings): HTMLElement {
    return SettingsUiFactory.createSegmentedControl(
      "Category Label Size",
      SettingsSectionRenderer._SCALING_OPTIONS,
      settings.labelFontSize,
      (val: string): void =>
        this._visualSettingsService.updateSetting("labelFontSize", val as ScalingLevel),
    );
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
