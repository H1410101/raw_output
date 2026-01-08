import { SettingsUiFactory } from "../ui/SettingsUiFactory";
import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../../services/SessionSettingsService";

export class SettingsSectionRenderer {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;

  constructor(
    visualSettingsService: VisualSettingsService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._visualSettingsService = visualSettingsService;
    this._sessionSettingsService = sessionSettingsService;
  }

  public appendVisualizationSection(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Visualization"));

    this._appendDotCloudConfiguration(container, settings);

    container.appendChild(
      SettingsUiFactory.createToggle("Show Grid Lines", settings.showGridLines, (checked) =>
        this._visualSettingsService.updateSetting("showGridLines", checked),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle("Highlight Recent", settings.highlightRecent, (checked) =>
        this._visualSettingsService.updateSetting("highlightRecent", checked),
      ),
    );
  }

  public appendLayoutSection(container: HTMLElement, settings: VisualSettings): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Layout"));

    this._appendSizeConfiguration(container, settings);

    container.appendChild(
      SettingsUiFactory.createToggle("Show Session Best", settings.showSessionBest, (checked) =>
        this._visualSettingsService.updateSetting("showSessionBest", checked),
      ),
    );

    container.appendChild(
      SettingsUiFactory.createToggle("Show Rank Badges", settings.showRankBadges, (checked) =>
        this._visualSettingsService.updateSetting("showRankBadges", checked),
      ),
    );
  }

  public appendAudioSection(container: HTMLElement): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Audio"));

    const subRowsContainer = document.createElement("div");
    subRowsContainer.className = "settings-sub-rows hidden";

    this._fillAudioPlaceholders(subRowsContainer);

    const masterVolume = SettingsUiFactory.createSlider(
      "Master Volume (Placeholder)",
      0,
      (value) => this._toggleVisibility(subRowsContainer, value > 0),
      10,
      100,
      true,
    );

    container.appendChild(
      SettingsUiFactory.createSettingsGroup(masterVolume, subRowsContainer),
    );
  }

  public appendSessionSection(
    container: HTMLElement,
    settings: SessionSettings,
  ): void {
    container.appendChild(SettingsUiFactory.createGroupTitle("Session"));

    const intervalSlider = SettingsUiFactory.createSlider(
      "Session Interval (min)",
      settings.sessionTimeoutMinutes,
      (value) => this._sessionSettingsService.update_setting("sessionTimeoutMinutes", value),
      1,
      120,
      false,
    );

    container.appendChild(intervalSlider);
  }

  private _appendDotCloudConfiguration(
    container: HTMLElement,
    settings: VisualSettings,
  ): void {
    const subRowsContainer = document.createElement("div");
    subRowsContainer.className = `settings-sub-rows ${settings.showDotCloud ? "" : "hidden"}`;

    this._createDotCloudSubRows(settings).forEach((row) =>
      subRowsContainer.appendChild(row),
    );

    const mainToggle = SettingsUiFactory.createToggle("Dot Cloud", settings.showDotCloud, (checked) => {
      this._visualSettingsService.updateSetting("showDotCloud", checked);
      this._toggleVisibility(subRowsContainer, checked);
    });

    container.appendChild(SettingsUiFactory.createSettingsGroup(mainToggle, subRowsContainer));
  }

  private _createDotCloudSubRows(settings: VisualSettings): HTMLElement[] {
    return [
      SettingsUiFactory.createSlider(
        "Dot Opacity",
        settings.dotOpacity,
        (val) => this._visualSettingsService.updateSetting("dotOpacity", val),
        10,
        100,
      ),
      SettingsUiFactory.createSegmentedControl(
        "Dot Cloud Bounds",
        ["Aligned", "Floating"],
        settings.scalingMode,
        (val) => this._visualSettingsService.updateSetting("scalingMode", val as any),
      ),
      SettingsUiFactory.createSegmentedControl(
        "Dot Size",
        ["Small", "Medium", "Large"],
        settings.dotSize,
        (val) => this._visualSettingsService.updateSetting("dotSize", val as any),
      ),
      SettingsUiFactory.createToggle("Jitter Dots", settings.dotJitter, (checked) =>
        this._visualSettingsService.updateSetting("dotJitter", checked),
      ),
    ];
  }

  private _appendSizeConfiguration(container: HTMLElement, settings: VisualSettings): void {
    const subRowsContainer = document.createElement("div");
    subRowsContainer.className = "settings-sub-rows";

    this._createSizeSubRows(settings).forEach((row) => subRowsContainer.appendChild(row));

    const masterScaling = SettingsUiFactory.createSegmentedControl(
      "Master Scaling",
      ["0.8x", "1.0x", "1.2x"],
      "1.0x",
      () => {},
    );

    container.appendChild(SettingsUiFactory.createSettingsGroup(masterScaling, subRowsContainer));
  }

  private _createSizeSubRows(settings: VisualSettings): HTMLElement[] {
    return [
      SettingsUiFactory.createSegmentedControl("Row Height", ["Compact", "Normal", "Spacious"], settings.rowHeight, (val) =>
        this._visualSettingsService.updateSetting("rowHeight", val as any),
      ),
      SettingsUiFactory.createSegmentedControl(
        "Scenario Font Size",
        ["Small", "Medium", "Large"],
        settings.scenarioFontSize,
        (val) => this._visualSettingsService.updateSetting("scenarioFontSize", val as any),
      ),
      SettingsUiFactory.createSegmentedControl(
        "Rank Font Size",
        ["Small", "Medium", "Large"],
        settings.rankFontSize,
        (val) => this._visualSettingsService.updateSetting("rankFontSize", val as any),
      ),
    ];
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

    setTimeout(() => {
      if (!container.classList.contains("hidden")) {
        container.style.overflowY = "auto";
      }
    }, 250);
  }

  private _fillAudioPlaceholders(container: HTMLElement): void {
    for (let i = 1; i <= 7; i++) {
      const item = document.createElement("div");
      item.className = "setting-item";
      item.innerHTML = `<label>Audio Placeholder ${i}</label>`;
      container.appendChild(item);
    }
  }
}
