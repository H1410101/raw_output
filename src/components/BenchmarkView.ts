import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";
import { SessionService } from "../services/SessionService";
import { AppStateService } from "../services/AppStateService";
import {
  VisualSettingsService,
  VisualSettings,
} from "../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../services/SessionSettingsService";
import { DotCloudComponent } from "./visualizations/DotCloudComponent";
import { BenchmarkScenario } from "../data/benchmarks";

export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;
  private readonly _benchmarkService: BenchmarkService;
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _sessionService: SessionService;
  private _activeDifficulty: string;
  private readonly _appStateService: AppStateService;
  private readonly _visualSettingsService: VisualSettingsService;
  private _currentVisualSettings: VisualSettings;
  private readonly _sessionSettingsService: SessionSettingsService;
  private _currentSessionSettings: SessionSettings;
  private _autoScrollTimer: number | null = null;
  private _scrollDirection: number = 0;
  private _isDragging: boolean = false;
  private _dragStartY: number = 0;
  private _dragStartScrollTop: number = 0;

  constructor(
    mountPoint: HTMLElement,
    benchmarkService: BenchmarkService,
    historyService: HistoryService,
    rankService: RankService,
    sessionService: SessionService,
    sessionSettingsService: SessionSettingsService,
    appStateService: AppStateService,
  ) {
    this._mountPoint = mountPoint;
    this._benchmarkService = benchmarkService;
    this._historyService = historyService;
    this._rankService = rankService;
    this._sessionService = sessionService;
    this._appStateService = appStateService;
    this._visualSettingsService = new VisualSettingsService();
    this._sessionSettingsService = sessionSettingsService;

    this._activeDifficulty = this._appStateService.get_benchmark_difficulty();
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.get_settings();

    this._subscribeToUpdates();
  }

  private _subscribeToUpdates(): void {
    this._visualSettingsService.subscribe((settings) => {
      this._currentVisualSettings = settings;
      this._refreshIfVisible();
    });

    this._sessionSettingsService.subscribe((settings) => {
      this._currentSessionSettings = settings;
      this._refreshIfVisible();
    });

    this._historyService.onHighscoreUpdated(() => {
      this._refreshIfVisible();
    });

    this._sessionService.onSessionUpdated(() => {
      this._refreshIfVisible();
    });

    window.addEventListener("resize", () => {
      this._refreshIfVisible();
    });
  }

  private _refreshIfVisible(): void {
    if (this._mountPoint.classList.contains("hidden-view")) {
      return;
    }

    this.render();
  }

  public async render(): Promise<void> {
    const scenarios = this._benchmarkService.getScenarios(
      this._activeDifficulty as any,
    );

    const highscores = await this._historyService.getBatchHighscores(
      scenarios.map((s) => s.name),
    );

    this._mountPoint.innerHTML = "";

    this._mountPoint.appendChild(
      this._createViewContainer(scenarios, highscores),
    );

    this._setupStickyCentering();
  }

  private _setupStickyCentering(): void {
    const table = this._mountPoint.querySelector(".benchmark-table");

    if (!table) return;

    table.addEventListener("scroll", () =>
      this._updateLabelPositions(table as HTMLElement),
    );

    this._updateLabelPositions(table as HTMLElement);
  }

  private _updateLabelPositions(scrollContainer: HTMLElement): void {
    const labels = this._mountPoint.querySelectorAll(
      ".vertical-text",
    ) as NodeListOf<HTMLElement>;

    const containerRect = scrollContainer.getBoundingClientRect();

    labels.forEach((label) => {
      this._updateSingleLabelPosition(label, containerRect);
    });
  }

  private _updateSingleLabelPosition(
    label: HTMLElement,
    containerRect: DOMRect,
  ): void {
    const track = label.parentElement;

    if (!track) return;

    const trackRect = track.getBoundingClientRect();

    if (this._isTrackSmallerThanLabel(trackRect, label)) {
      this._centerLabelInTrack(label);

      return;
    }

    this._stickLabelToVisibleCenter(label, trackRect, containerRect);
  }

  private _isTrackSmallerThanLabel(
    trackRect: DOMRect,
    label: HTMLElement,
  ): boolean {
    return trackRect.height <= label.offsetHeight;
  }

  private _centerLabelInTrack(label: HTMLElement): void {
    label.style.top = "50%";
  }

  private _stickLabelToVisibleCenter(
    label: HTMLElement,
    trackRect: DOMRect,
    containerRect: DOMRect,
  ): void {
    const visibleTop = Math.max(trackRect.top, containerRect.top);

    const visibleBottom = Math.min(trackRect.bottom, containerRect.bottom);

    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    const visibleCenterY = visibleTop + visibleHeight / 2;

    const relativeCenter = visibleCenterY - trackRect.top;

    this._applyClampedLabelPosition(label, relativeCenter, trackRect.height);
  }

  private _applyClampedLabelPosition(
    label: HTMLElement,
    targetY: number,
    trackHeight: number,
  ): void {
    const labelHalfHeight = label.offsetHeight / 2;

    const minTop = labelHalfHeight;

    const maxTop = trackHeight - labelHalfHeight;

    const clampedTop = Math.max(minTop, Math.min(maxTop, targetY));

    label.style.top = `${clampedTop}px`;
  }

  private _createViewContainer(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "benchmark-view-container";

    const headerContainer = document.createElement("div");

    headerContainer.className = "benchmark-header-controls";

    const leftSpacer = document.createElement("div");

    leftSpacer.style.flex = "1";

    headerContainer.appendChild(leftSpacer);

    headerContainer.appendChild(this._createDifficultyTabs());

    const rightContainer = document.createElement("div");

    rightContainer.style.flex = "1";

    rightContainer.style.display = "flex";

    rightContainer.style.justifyContent = "flex-end";

    rightContainer.appendChild(this._createSettingsButton());

    headerContainer.appendChild(rightContainer);

    container.appendChild(headerContainer);

    container.appendChild(this._createScenarioTable(scenarios, highscores));

    return container;
  }

  private _createSettingsButton(): HTMLElement {
    const settingsButton = document.createElement("button");

    settingsButton.className = "visual-settings-button";

    settingsButton.title = "Visual Settings";

    settingsButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;

    settingsButton.addEventListener("click", () => {
      this._openSettingsMenu();
    });

    return settingsButton;
  }

  private _openSettingsMenu(): void {
    const existing = document.querySelector(".settings-overlay");

    if (existing) {
      existing.remove();
    }

    const settingsOverlay = this._createSettingsOverlay();

    const settingsMenuCard = this._createSettingsMenuCard();

    settingsOverlay.appendChild(settingsMenuCard);

    document.body.appendChild(settingsOverlay);
  }

  private _createSettingsOverlay(): HTMLElement {
    const overlayElement = document.createElement("div");

    overlayElement.className = "settings-overlay";

    overlayElement.addEventListener("click", (event) => {
      if (event.target === overlayElement) {
        overlayElement.remove();
      }
    });

    return overlayElement;
  }

  private _createSettingsMenuCard(): HTMLElement {
    const menuCardElement = document.createElement("div");

    menuCardElement.className = "settings-menu-card";

    menuCardElement.appendChild(this._createSettingsMenuTitle());

    this._appendVisualizationSettings(menuCardElement);

    this._appendLayoutSettings(menuCardElement);

    this._appendAudioSettings(menuCardElement);

    this._appendSessionSettings(menuCardElement);

    return menuCardElement;
  }

  private _appendVisualizationSettings(container: HTMLElement): void {
    container.appendChild(this._createGroupTitle("Visualization"));

    this._appendDotCloudGroup(container);

    container.appendChild(
      this._createSettingToggle(
        "Show Grid Lines",
        this._currentVisualSettings.showGridLines,
        (checked) =>
          this._visualSettingsService.updateSetting("showGridLines", checked),
      ),
    );

    container.appendChild(
      this._createSettingToggle(
        "Highlight Recent",
        this._currentVisualSettings.highlightRecent,
        (checked) =>
          this._visualSettingsService.updateSetting("highlightRecent", checked),
      ),
    );
  }

  private _appendDotCloudGroup(container: HTMLElement): void {
    const sub_rows = [
      this._createSettingSlider(
        "Dot Opacity",
        this._currentVisualSettings.dotOpacity,
        (value) =>
          this._visualSettingsService.updateSetting("dotOpacity", value),
        10,
        100,
        false,
      ),
      this._createSettingSegmentedControl(
        "Dot Cloud Bounds",
        ["Aligned", "Floating"],
        this._currentVisualSettings.scalingMode,
        (value) =>
          this._visualSettingsService.updateSetting(
            "scalingMode",
            value as "Aligned" | "Floating",
          ),
      ),
      this._createSettingSegmentedControl(
        "Dot Size",
        ["Small", "Medium", "Large"],
        this._currentVisualSettings.dotSize,
        (value) =>
          this._visualSettingsService.updateSetting(
            "dotSize",
            value as "Small" | "Medium" | "Large",
          ),
      ),
      this._createSettingToggle(
        "Jitter Dots",
        this._currentVisualSettings.dotJitter,
        (checked) =>
          this._visualSettingsService.updateSetting("dotJitter", checked),
      ),
    ];

    const sub_rows_container = document.createElement("div");
    sub_rows_container.className = `settings-sub-rows ${
      this._currentVisualSettings.showDotCloud ? "" : "hidden"
    }`;
    sub_rows.forEach((row) => sub_rows_container.appendChild(row));

    const toggle = this._createSettingToggle(
      "Dot Cloud",
      this._currentVisualSettings.showDotCloud,
      (checked) => {
        this._visualSettingsService.updateSetting("showDotCloud", checked);
        if (checked) {
          this._revealSubRows(sub_rows_container);
        } else {
          this._hideSubRows(sub_rows_container);
        }
      },
    );

    container.appendChild(
      this._createSettingsGroup(toggle, sub_rows_container),
    );
  }

  private _appendLayoutSettings(container: HTMLElement): void {
    container.appendChild(this._createGroupTitle("Layout"));

    this._appendSizeGroup(container);

    container.appendChild(
      this._createSettingToggle(
        "Show Session Best",
        this._currentVisualSettings.showSessionBest,
        (checked) =>
          this._visualSettingsService.updateSetting("showSessionBest", checked),
      ),
    );

    container.appendChild(
      this._createSettingToggle(
        "Show Rank Badges",
        this._currentVisualSettings.showRankBadges,
        (checked) =>
          this._visualSettingsService.updateSetting("showRankBadges", checked),
      ),
    );
  }

  private _appendSizeGroup(container: HTMLElement): void {
    const sub_rows = [
      this._createSettingSegmentedControl(
        "Row Height",
        ["Compact", "Normal", "Spacious"],
        this._currentVisualSettings.rowHeight,
        (value) =>
          this._visualSettingsService.updateSetting(
            "rowHeight",
            value as "Compact" | "Normal" | "Spacious",
          ),
      ),
      this._createSettingSegmentedControl(
        "Scenario Font Size",
        ["Small", "Medium", "Large"],
        this._currentVisualSettings.scenarioFontSize,
        (value) =>
          this._visualSettingsService.updateSetting(
            "scenarioFontSize",
            value as "Small" | "Medium" | "Large",
          ),
      ),
      this._createSettingSegmentedControl(
        "Rank Font Size",
        ["Small", "Medium", "Large"],
        this._currentVisualSettings.rankFontSize,
        (value) =>
          this._visualSettingsService.updateSetting(
            "rankFontSize",
            value as "Small" | "Medium" | "Large",
          ),
      ),
    ];

    const sub_rows_container = document.createElement("div");
    sub_rows_container.className = "settings-sub-rows";
    sub_rows.forEach((row) => sub_rows_container.appendChild(row));

    const master_scaling = this._createSettingSegmentedControl(
      "Master Scaling",
      ["0.8x", "1.0x", "1.2x"],
      "1.0x",
      () => {},
    );

    container.appendChild(
      this._createSettingsGroup(master_scaling, sub_rows_container),
    );
  }

  private _appendAudioSettings(container: HTMLElement): void {
    container.appendChild(this._createGroupTitle("Audio"));

    const sub_rows: HTMLElement[] = [];

    for (let i = 1; i <= 7; i++) {
      const placeholder = document.createElement("div");
      placeholder.className = "setting-item";
      const label = document.createElement("label");
      label.textContent = `Audio Placeholder ${i}`;
      placeholder.appendChild(label);
      sub_rows.push(placeholder);
    }

    const sub_rows_container = document.createElement("div");
    sub_rows_container.className = "settings-sub-rows hidden";
    sub_rows.forEach((row) => sub_rows_container.appendChild(row));

    const master_volume_slider = this._createSettingSlider(
      "Master Volume (Placeholder)",
      0,
      (value) => {
        const is_active = value > 0;

        if (is_active && sub_rows_container.classList.contains("hidden")) {
          this._revealSubRows(sub_rows_container);
        } else if (
          !is_active &&
          !sub_rows_container.classList.contains("hidden")
        ) {
          this._hideSubRows(sub_rows_container);
        }
      },
      10,
      100,
      true,
    );

    container.appendChild(
      this._createSettingsGroup(master_volume_slider, sub_rows_container),
    );
  }

  private _appendSessionSettings(container: HTMLElement): void {
    container.appendChild(this._createGroupTitle("Session"));

    container.appendChild(
      this._createSettingSlider(
        "Session Interval (min)",
        this._currentSessionSettings.sessionTimeoutMinutes,
        (value) =>
          this._sessionSettingsService.update_setting(
            "sessionTimeoutMinutes",
            value,
          ),
        1,
        120,
        false,
      ),
    );
  }

  private _createSettingsGroup(
    main_row: HTMLElement,
    sub_rows_container: HTMLElement,
  ): HTMLElement {
    const group_container = document.createElement("div");
    group_container.className = "settings-group";

    group_container.appendChild(main_row);
    group_container.appendChild(sub_rows_container);

    return group_container;
  }

  private _revealSubRows(container: HTMLElement): void {
    container.classList.remove("hidden");
    container.style.overflowY = "hidden";
    setTimeout(() => {
      if (!container.classList.contains("hidden")) {
        container.style.overflowY = "auto";
      }
    }, 250);
  }

  private _hideSubRows(container: HTMLElement): void {
    container.classList.add("hidden");
    container.style.overflowY = "hidden";
  }

  private _createSettingsMenuTitle(): HTMLElement {
    const titleElement = document.createElement("h2");

    titleElement.textContent = "Visual Settings";

    return titleElement;
  }

  private _createGroupTitle(text: string): HTMLElement {
    const title = document.createElement("div");
    title.className = "settings-group-title";
    title.textContent = text;
    return title;
  }

  private _createSettingToggle(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "setting-item toggle-item";

    const label_element = document.createElement("label");

    label_element.textContent = label;

    container.appendChild(label_element);

    const checkbox = document.createElement("div");

    checkbox.className = `circle-checkbox ${checked ? "checked" : ""}`;
    checkbox.style.transition = "none";

    container.appendChild(checkbox);
    checkbox.addEventListener("click", () => {
      const is_checked = checkbox.classList.toggle("checked");

      onChange(is_checked);
    });

    return container;
  }

  private _createSettingSlider(
    label: string,
    value: number,
    onChange: (value: number) => void,
    min: number = 0,
    max: number = 100,
    show_notch: boolean = false,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "setting-item slider-item";

    const label_element = document.createElement("label");

    label_element.textContent = label;

    container.appendChild(label_element);

    const slider_container = document.createElement("div");

    slider_container.className = "dot-slider-container";

    const notch = document.createElement("div");

    notch.className = `slider-notch ${show_notch ? "" : "hidden"}`;

    const track = this._createDotTrack(value, min, max, 9, onChange);

    if (show_notch) {
      notch.addEventListener("click", () => {
        onChange(0);
        this._updateTrackVisuals(track, -1);
      });
    }

    slider_container.appendChild(notch);

    slider_container.appendChild(track);

    container.appendChild(slider_container);

    return container;
  }

  private _createDotTrack(
    current_value: number,
    min: number,
    max: number,
    dot_count: number,
    onChange: (value: number) => void,
  ): HTMLElement {
    const track = document.createElement("div");

    track.className = "dot-track";

    const selected_index = Math.round(
      ((current_value - min) / (max - min)) * (dot_count - 1),
    );

    track.dataset.selectedIndex = selected_index.toString();

    for (let i = 0; i < dot_count; i++) {
      const dot_container = this._createDot(i, selected_index, () => {
        const new_value = Math.round(min + (i / (dot_count - 1)) * (max - min));

        this._updateTrackVisuals(track, i);

        onChange(new_value);
      });

      track.appendChild(dot_container);
    }

    return track;
  }

  private _createDot(
    index: number,
    selected_index: number,
    onClick: () => void,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "dot-socket-container";

    const dot = document.createElement("div");

    dot.className = "dot-target";

    this._applyDotState(dot, index, selected_index);

    container.appendChild(dot);

    container.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });

    return container;
  }

  private _updateTrackVisuals(
    track: HTMLElement,
    new_selected_index: number,
  ): void {
    const dots = track.querySelectorAll(".dot-target");
    const previous_index = parseInt(track.dataset.selectedIndex || "-1");
    track.dataset.selectedIndex = new_selected_index.toString();

    dots.forEach((dot, index) => {
      const distance = Math.abs(index - previous_index);
      const delay = distance * 0.03;

      const dotEl = dot as HTMLElement;
      dotEl.style.transition =
        "background 0.2s ease, box-shadow 0.2s ease, height 0.2s ease, border-radius 0.2s ease";
      dotEl.style.transitionDelay = `${delay}s`;

      this._applyDotState(dotEl, index, new_selected_index);
    });
  }

  private _applyDotState(
    dot: HTMLElement,
    index: number,
    selected_index: number,
  ): void {
    dot.classList.remove("pill", "glow", "dull");

    if (index === selected_index) {
      dot.classList.add("pill");
    } else if (index < selected_index) {
      dot.classList.add("glow");
    } else {
      dot.classList.add("dull");
    }
  }

  private _createSettingSegmentedControl(
    label: string,
    options: string[],
    currentValue: string,
    onChange: (value: string) => void,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "setting-item segmented-item";

    const label_element = document.createElement("label");

    label_element.textContent = label;

    container.appendChild(label_element);

    const track = document.createElement("div");

    track.className = "multi-select-dots";

    const selected_index = options.indexOf(currentValue);
    track.dataset.selectedIndex = selected_index.toString();

    options.forEach((option, index) => {
      const dot_container = this._createDot(index, selected_index, () => {
        this._updateTrackVisuals(track, index);
        onChange(option);
      });

      track.appendChild(dot_container);
    });

    container.appendChild(track);

    return container;
  }

  private _createDifficultyTabs(): HTMLElement {
    const tabsContainer = document.createElement("div");

    tabsContainer.className = "difficulty-tabs";

    const difficulties = ["Easier", "Medium", "Harder"];

    difficulties.forEach((difficulty) => {
      tabsContainer.appendChild(this._createTab(difficulty));
    });

    return tabsContainer;
  }

  private _createTab(difficulty: string): HTMLButtonElement {
    const tab = document.createElement("button");

    const isActive = this._activeDifficulty === difficulty;

    tab.className = `tab-button ${isActive ? "active" : ""}`;

    tab.textContent = difficulty;

    tab.addEventListener("click", () => {
      this._handleDifficultyChange(difficulty);
    });

    return tab;
  }

  private async _handleDifficultyChange(difficulty: string): Promise<void> {
    this._activeDifficulty = difficulty;

    this._appStateService.set_benchmark_difficulty(difficulty as any);

    await this.render();
  }

  private _createScenarioTable(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "benchmark-table-container";

    const table = document.createElement("div");
    table.className = "benchmark-table";

    const customThumb = document.createElement("div");
    customThumb.className = "custom-scroll-thumb";

    this._setupScrollSync(table, customThumb);
    this._setupDragScroll(table, customThumb);
    this._setupAutoScroll(container, table, customThumb);

    this._appendCategorizedScenarios(table, scenarios, highscores);

    container.appendChild(table);
    container.appendChild(customThumb);

    return container;
  }

  private _setupScrollSync(table: HTMLElement, thumb: HTMLElement): void {
    table.addEventListener("scroll", () =>
      this._syncThumbPosition(table, thumb),
    );

    requestAnimationFrame(() => this._syncThumbPosition(table, thumb));
  }

  private _syncThumbPosition(table: HTMLElement, thumb: HTMLElement): void {
    const scrollRange = table.scrollHeight - table.clientHeight;

    if (scrollRange <= 0) {
      thumb.style.display = "none";
      return;
    }

    thumb.style.display = "block";

    const trackRange = table.clientHeight - 32;
    const thumbHeight = thumb.offsetHeight || 32;
    const availableTrack = trackRange - thumbHeight;

    const scrollRatio = table.scrollTop / scrollRange;
    const translateY = scrollRatio * availableTrack;

    thumb.style.transform = `translateY(${translateY}px)`;
  }

  private _setupDragScroll(table: HTMLElement, thumb: HTMLElement): void {
    thumb.addEventListener("mousedown", (event) => {
      this._isDragging = true;
      this._dragStartY = event.clientY;
      this._dragStartScrollTop = table.scrollTop;
      this._stopAutoScroll();

      event.preventDefault();
      event.stopPropagation();
    });

    window.addEventListener("mousemove", (event) => {
      if (!this._isDragging) return;

      const deltaY = event.clientY - this._dragStartY;
      const scrollRange = table.scrollHeight - table.clientHeight;
      const trackRange = table.clientHeight - 32;
      const thumbHeight = thumb.offsetHeight || 32;
      const availableTrack = trackRange - thumbHeight;

      if (availableTrack <= 0) return;

      const scrollPerPixel = scrollRange / availableTrack;
      table.scrollTop = this._dragStartScrollTop + deltaY * scrollPerPixel;
    });

    window.addEventListener("mouseup", () => {
      this._isDragging = false;
    });
  }

  private _setupAutoScroll(
    container: HTMLElement,
    table: HTMLElement,
    thumb: HTMLElement,
  ): void {
    container.addEventListener("mousemove", (event) =>
      this._handleContainerHover(event, table, thumb),
    );

    container.addEventListener("mouseleave", () => this._stopAutoScroll());
  }

  private _handleContainerHover(
    event: MouseEvent,
    table: HTMLElement,
    thumb: HTMLElement,
  ): void {
    if (this._isDragging || event.buttons !== 0) {
      this._stopAutoScroll();
      return;
    }

    const rect = thumb.getBoundingClientRect();
    const isInsideX = event.clientX >= rect.left && event.clientX <= rect.right;
    const isInsideY = event.clientY >= rect.top && event.clientY <= rect.bottom;

    if (!isInsideX || !isInsideY) {
      this._stopAutoScroll();
      return;
    }

    const relativeY = event.clientY - rect.top;
    const threshold = rect.height * 0.1;

    if (relativeY < threshold) {
      this._startAutoScroll(table, -1);
    } else if (relativeY > rect.height - threshold) {
      this._startAutoScroll(table, 1);
    } else {
      this._stopAutoScroll();
    }
  }

  private _startAutoScroll(table: HTMLElement, direction: number): void {
    if (this._scrollDirection === direction) {
      return;
    }

    this._stopAutoScroll();

    this._scrollDirection = direction;

    this._animateAutoScroll(table);
  }

  private _animateAutoScroll(table: HTMLElement): void {
    const scroll = (): void => {
      if (this._scrollDirection === 0) {
        return;
      }

      table.scrollTop += this._scrollDirection * 8;

      this._autoScrollTimer = requestAnimationFrame(scroll);
    };

    this._autoScrollTimer = requestAnimationFrame(scroll);
  }

  private _stopAutoScroll(): void {
    if (this._autoScrollTimer !== null) {
      cancelAnimationFrame(this._autoScrollTimer);
      this._autoScrollTimer = null;
    }

    this._scrollDirection = 0;
  }

  private _appendCategorizedScenarios(
    table: HTMLElement,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    const groups = this._groupScenarios(scenarios);

    groups.forEach((subgroups, category) => {
      table.appendChild(
        this._createCategoryGroup(category, subgroups, highscores),
      );
    });
  }

  private _groupScenarios(
    scenarios: BenchmarkScenario[],
  ): Map<string, Map<string, BenchmarkScenario[]>> {
    const groups = new Map<string, Map<string, BenchmarkScenario[]>>();

    scenarios.forEach((scenario) => {
      if (!groups.has(scenario.category)) {
        groups.set(scenario.category, new Map());
      }

      const categoryMap = groups.get(scenario.category)!;

      if (!categoryMap.has(scenario.subcategory)) {
        categoryMap.set(scenario.subcategory, []);
      }

      categoryMap.get(scenario.subcategory)!.push(scenario);
    });

    return groups;
  }

  private _createCategoryGroup(
    category: string,
    subgroups: Map<string, BenchmarkScenario[]>,
    highscores: Record<string, number>,
  ): HTMLElement {
    const categoryGroup = document.createElement("div");

    categoryGroup.className = "benchmark-category-group";

    categoryGroup.appendChild(this._createVerticalLabel(category, "category"));

    const subcategoryContainer = document.createElement("div");

    subcategoryContainer.className = "subcategory-container";

    subgroups.forEach((scenarios, subcategory) => {
      subcategoryContainer.appendChild(
        this._createSubcategoryGroup(subcategory, scenarios, highscores),
      );
    });

    categoryGroup.appendChild(subcategoryContainer);

    return categoryGroup;
  }

  private _createSubcategoryGroup(
    subcategory: string,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const subcategoryGroup = document.createElement("div");

    subcategoryGroup.className = "benchmark-subcategory-group";

    subcategoryGroup.appendChild(
      this._createVerticalLabel(subcategory, "subcategory"),
    );

    subcategoryGroup.appendChild(this._createSubcategoryHeader());

    const scenarioList = document.createElement("div");

    scenarioList.className = "scenario-list";

    scenarios.forEach((scenario) => {
      const highscore = highscores[scenario.name] || 0;

      scenarioList.appendChild(this._createScenarioRow(scenario, highscore));
    });

    subcategoryGroup.appendChild(scenarioList);

    return subcategoryGroup;
  }

  private _createSubcategoryHeader(): HTMLElement {
    const header = document.createElement("div");

    header.className = "subcategory-header";

    const sessionLabel = this._createColumnHeader("Session");

    const allTimeLabel = this._createColumnHeader("All-time");

    const dotSpacer = document.createElement("div");

    dotSpacer.className = "header-dot-spacer";

    const actionSpacer = document.createElement("div");

    actionSpacer.className = "header-action-spacer";

    if (this._currentVisualSettings.showDotCloud) {
      header.appendChild(dotSpacer);
    }

    if (this._currentVisualSettings.showRankBadges) {
      header.appendChild(allTimeLabel);
    }

    if (this._currentVisualSettings.showSessionBest) {
      header.appendChild(sessionLabel);
    }

    header.appendChild(actionSpacer);

    return header;
  }

  private _createColumnHeader(text: string): HTMLElement {
    const label = document.createElement("div");

    label.className = "column-header";

    label.textContent = text;

    return label;
  }

  private _createVerticalLabel(
    text: string,
    type: "category" | "subcategory",
  ): HTMLElement {
    const labelContainer = document.createElement("div");

    labelContainer.className = `vertical-label-container ${type}-label`;

    const labelText = document.createElement("span");

    labelText.className = "vertical-text";

    labelText.textContent = text;

    labelContainer.appendChild(labelText);

    return labelContainer;
  }

  private _createScenarioRow(
    scenario: BenchmarkScenario,
    highscore: number,
  ): HTMLElement {
    const row = document.createElement("div");

    row.className = `scenario-row row-height-${this._currentVisualSettings.rowHeight.toLowerCase()}`;

    row.appendChild(this._createNameCell(scenario));

    const rightContent = document.createElement("div");

    rightContent.className = "row-right-content";

    if (this._currentVisualSettings.showDotCloud) {
      rightContent.appendChild(this._createDotCloudCell(scenario));
    }

    if (this._currentVisualSettings.showRankBadges) {
      rightContent.appendChild(this._createRankBadge(scenario, highscore));
    }

    if (this._currentVisualSettings.showSessionBest) {
      rightContent.appendChild(this._createSessionRankBadge(scenario));
    }

    rightContent.appendChild(this._createPlayButton(scenario.name));

    row.appendChild(rightContent);

    row.addEventListener("click", () => {
      row.classList.toggle("selected");
    });

    return row;
  }

  private _createNameCell(scenario: BenchmarkScenario): HTMLElement {
    const nameSpan = document.createElement("span");

    nameSpan.className = "scenario-name";

    nameSpan.textContent = scenario.name;

    return nameSpan;
  }

  private _createDotCloudCell(scenario: BenchmarkScenario): HTMLElement {
    const container = document.createElement("div");

    container.className = "dot-cloud-container";

    if (!this._currentVisualSettings.showDotCloud) {
      return container;
    }

    this._historyService.getLastScores(scenario.name, 100).then((scores) => {
      if (scores.length > 0) {
        const rankInterval = this._calculateAverageRankInterval(scenario);

        const dotCloud = new DotCloudComponent(
          scores,
          scenario.thresholds,
          this._currentVisualSettings,
          rankInterval,
        );

        const visualization = dotCloud.render();

        container.replaceWith(visualization);
      }
    });

    return container;
  }

  private _calculateAverageRankInterval(scenario: BenchmarkScenario): number {
    const thresholds = Object.values(scenario.thresholds).sort((a, b) => a - b);

    if (thresholds.length < 2) return 100;

    let totalInterval = 0;

    for (let i = 1; i < thresholds.length; i++) {
      totalInterval += thresholds[i] - thresholds[i - 1];
    }

    return totalInterval / (thresholds.length - 1);
  }

  private _createSessionRankBadge(scenario: BenchmarkScenario): HTMLElement {
    const session_best = this._sessionService.getScenarioSessionBest(
      scenario.name,
    );

    const score = session_best ? session_best.bestScore : 0;

    const badge = this._createRankBadge(scenario, score);

    const is_inactive = !this._sessionService.is_session_active();

    if (score === 0 || is_inactive) {
      badge.style.visibility = "hidden";
    }

    badge.classList.add("session-badge");

    return badge;
  }

  private _createRankBadge(
    scenario: BenchmarkScenario,
    score: number,
  ): HTMLElement {
    const badge = document.createElement("div");

    badge.className = "rank-badge-container";

    const badgeContent = document.createElement("div");

    badgeContent.className = "badge-content";

    this._fillBadgeContent(badgeContent, scenario, score);

    badge.appendChild(badgeContent);

    return badge;
  }

  private _fillBadgeContent(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    score: number,
  ): void {
    if (score === 0) {
      container.innerHTML = `<span class="unranked-text">Unranked</span>`;

      return;
    }

    const rank = this._rankService.calculateRank(score, scenario);

    container.innerHTML = `
      <span class="rank-name">${rank.currentRank}</span>
      <span class="rank-progress">+${rank.progressPercentage}%</span>
    `;
  }

  private _createPlayButton(scenarioName: string): HTMLElement {
    const playButton = document.createElement("button");

    playButton.className = "play-scenario-button";

    playButton.title = `Launch ${scenarioName}`;

    playButton.addEventListener("click", (event) => {
      event.stopPropagation();

      this._launchScenario(scenarioName);
    });

    return playButton;
  }

  private _launchScenario(scenarioName: string): void {
    const encodedName = encodeURIComponent(scenarioName);

    const steamUrl = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;

    window.location.href = steamUrl;
  }
}
