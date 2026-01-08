import {
  VisualSettingsService,
  VisualSettings,
} from "../../services/VisualSettingsService";
import {
  SessionSettingsService,
  SessionSettings,
} from "../../services/SessionSettingsService";

export class BenchmarkSettingsController {
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private _currentVisualSettings: VisualSettings;
  private _currentSessionSettings: SessionSettings;

  constructor(
    visualSettingsService: VisualSettingsService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._visualSettingsService = visualSettingsService;
    this._sessionSettingsService = sessionSettingsService;
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.get_settings();
  }

  public open_settings_menu(): void {
    this._currentVisualSettings = this._visualSettingsService.getSettings();
    this._currentSessionSettings = this._sessionSettingsService.get_settings();

    const existing_overlay = document.querySelector(".settings-overlay");

    if (existing_overlay) {
      existing_overlay.remove();
    }

    const settings_overlay = this._create_settings_overlay();
    const settings_menu_card = this._create_settings_menu_card();

    settings_overlay.appendChild(settings_menu_card);
    document.body.appendChild(settings_overlay);
  }

  private _create_settings_overlay(): HTMLElement {
    const overlay_element = document.createElement("div");
    overlay_element.className = "settings-overlay";

    overlay_element.addEventListener("click", (event) => {
      if (event.target === overlay_element) {
        overlay_element.remove();
      }
    });

    return overlay_element;
  }

  private _create_settings_menu_card(): HTMLElement {
    const menu_card_element = document.createElement("div");
    menu_card_element.className = "settings-menu-card";

    menu_card_element.appendChild(this._create_settings_menu_title());

    this._append_visualization_section(menu_card_element);
    this._append_layout_section(menu_card_element);
    this._append_audio_section(menu_card_element);
    this._append_session_section(menu_card_element);

    return menu_card_element;
  }

  private _create_settings_menu_title(): HTMLElement {
    const title_element = document.createElement("h2");
    title_element.textContent = "Visual Settings";
    return title_element;
  }

  private _append_visualization_section(container: HTMLElement): void {
    container.appendChild(this._create_group_title("Visualization"));
    this._append_dot_cloud_configuration(container);

    container.appendChild(
      this._create_setting_toggle(
        "Show Grid Lines",
        this._currentVisualSettings.showGridLines,
        (checked) =>
          this._visualSettingsService.updateSetting("showGridLines", checked),
      ),
    );

    container.appendChild(
      this._create_setting_toggle(
        "Highlight Recent",
        this._currentVisualSettings.highlightRecent,
        (checked) =>
          this._visualSettingsService.updateSetting("highlightRecent", checked),
      ),
    );
  }

  private _append_dot_cloud_configuration(container: HTMLElement): void {
    const sub_rows = this._create_dot_cloud_sub_rows();
    const sub_rows_container = document.createElement("div");

    sub_rows_container.className = `settings-sub-rows ${
      this._currentVisualSettings.showDotCloud ? "" : "hidden"
    }`;
    sub_rows.forEach((row) => sub_rows_container.appendChild(row));

    const main_toggle = this._create_setting_toggle(
      "Dot Cloud",
      this._currentVisualSettings.showDotCloud,
      (checked) => {
        this._visualSettingsService.updateSetting("showDotCloud", checked);
        checked
          ? this._reveal_sub_rows(sub_rows_container)
          : this._hide_sub_rows(sub_rows_container);
      },
    );

    container.appendChild(
      this._create_settings_group(main_toggle, sub_rows_container),
    );
  }

  private _create_dot_cloud_sub_rows(): HTMLElement[] {
    const visual_controls = this._create_dot_cloud_visual_controls();
    const behavioral_controls = this._create_dot_cloud_behavioral_controls();

    return [...visual_controls, ...behavioral_controls];
  }

  private _create_dot_cloud_visual_controls(): HTMLElement[] {
    const opacity_slider = this._create_setting_slider(
      "Dot Opacity",
      this._currentVisualSettings.dotOpacity,
      (value) => this._visualSettingsService.updateSetting("dotOpacity", value),
      10,
      100,
      false,
    );

    const bounds_control = this._create_setting_segmented_control(
      "Dot Cloud Bounds",
      ["Aligned", "Floating"],
      this._currentVisualSettings.scalingMode,
      (value) =>
        this._visualSettingsService.updateSetting("scalingMode", value as any),
    );

    return [opacity_slider, bounds_control];
  }

  private _create_dot_cloud_behavioral_controls(): HTMLElement[] {
    const size_control = this._create_setting_segmented_control(
      "Dot Size",
      ["Small", "Medium", "Large"],
      this._currentVisualSettings.dotSize,
      (value) =>
        this._visualSettingsService.updateSetting("dotSize", value as any),
    );

    const jitter_toggle = this._create_setting_toggle(
      "Jitter Dots",
      this._currentVisualSettings.dotJitter,
      (checked) =>
        this._visualSettingsService.updateSetting("dotJitter", checked),
    );

    return [size_control, jitter_toggle];
  }

  private _append_layout_section(container: HTMLElement): void {
    container.appendChild(this._create_group_title("Layout"));
    this._append_size_configuration(container);

    container.appendChild(
      this._create_setting_toggle(
        "Show Session Best",
        this._currentVisualSettings.showSessionBest,
        (checked) =>
          this._visualSettingsService.updateSetting("showSessionBest", checked),
      ),
    );

    container.appendChild(
      this._create_setting_toggle(
        "Show Rank Badges",
        this._currentVisualSettings.showRankBadges,
        (checked) =>
          this._visualSettingsService.updateSetting("showRankBadges", checked),
      ),
    );
  }

  private _append_size_configuration(container: HTMLElement): void {
    const sub_rows = this._create_size_sub_rows();
    const sub_rows_container = document.createElement("div");

    sub_rows_container.className = "settings-sub-rows";
    sub_rows.forEach((row) => sub_rows_container.appendChild(row));

    const master_scaling = this._create_setting_segmented_control(
      "Master Scaling",
      ["0.8x", "1.0x", "1.2x"],
      "1.0x",
      () => {},
    );

    container.appendChild(
      this._create_settings_group(master_scaling, sub_rows_container),
    );
  }

  private _create_size_sub_rows(): HTMLElement[] {
    return [
      this._create_row_height_control(),
      this._create_scenario_font_control(),
      this._create_rank_font_control(),
    ];
  }

  private _create_row_height_control(): HTMLElement {
    return this._create_setting_segmented_control(
      "Row Height",
      ["Compact", "Normal", "Spacious"],
      this._currentVisualSettings.rowHeight,
      (value) =>
        this._visualSettingsService.updateSetting("rowHeight", value as any),
    );
  }

  private _create_scenario_font_control(): HTMLElement {
    return this._create_setting_segmented_control(
      "Scenario Font Size",
      ["Small", "Medium", "Large"],
      this._currentVisualSettings.scenarioFontSize,
      (value) =>
        this._visualSettingsService.updateSetting(
          "scenarioFontSize",
          value as any,
        ),
    );
  }

  private _create_rank_font_control(): HTMLElement {
    return this._create_setting_segmented_control(
      "Rank Font Size",
      ["Small", "Medium", "Large"],
      this._currentVisualSettings.rankFontSize,
      (value) =>
        this._visualSettingsService.updateSetting("rankFontSize", value as any),
    );
  }

  private _append_audio_section(container: HTMLElement): void {
    container.appendChild(this._create_group_title("Audio"));
    const sub_rows_container = document.createElement("div");

    sub_rows_container.className = "settings-sub-rows hidden";
    this._fill_audio_placeholders(sub_rows_container);

    const master_volume = this._create_setting_slider(
      "Master Volume (Placeholder)",
      0,
      (value) => {
        value > 0
          ? this._reveal_sub_rows(sub_rows_container)
          : this._hide_sub_rows(sub_rows_container);
      },
      10,
      100,
      true,
    );

    container.appendChild(
      this._create_settings_group(master_volume, sub_rows_container),
    );
  }

  private _fill_audio_placeholders(container: HTMLElement): void {
    for (let i = 1; i <= 7; i++) {
      const item = document.createElement("div");
      item.className = "setting-item";

      const label = document.createElement("label");
      label.textContent = `Audio Placeholder ${i}`;

      item.appendChild(label);
      container.appendChild(item);
    }
  }

  private _append_session_section(container: HTMLElement): void {
    container.appendChild(this._create_group_title("Session"));

    const interval_slider = this._create_setting_slider(
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
    );

    container.appendChild(interval_slider);
  }

  private _create_settings_group(
    main_row: HTMLElement,
    sub_rows_container: HTMLElement,
  ): HTMLElement {
    const group_container = document.createElement("div");
    group_container.className = "settings-group";

    group_container.appendChild(main_row);
    group_container.appendChild(sub_rows_container);

    return group_container;
  }

  private _reveal_sub_rows(container: HTMLElement): void {
    container.classList.remove("hidden");
    container.style.overflowY = "hidden";

    setTimeout(() => {
      if (!container.classList.contains("hidden")) {
        container.style.overflowY = "auto";
      }
    }, 250);
  }

  private _hide_sub_rows(container: HTMLElement): void {
    container.classList.add("hidden");
    container.style.overflowY = "hidden";
  }

  private _create_group_title(text: string): HTMLElement {
    const title = document.createElement("div");
    title.className = "settings-group-title";
    title.textContent = text;
    return title;
  }

  private _create_setting_toggle(
    label: string,
    checked: boolean,
    on_change: (checked: boolean) => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "setting-item toggle-item";

    const label_element = document.createElement("label");
    label_element.textContent = label;
    container.appendChild(label_element);

    const checkbox = document.createElement("div");
    checkbox.className = `circle-checkbox ${checked ? "checked" : ""}`;
    checkbox.style.transition = "none";

    checkbox.addEventListener("click", () =>
      on_change(checkbox.classList.toggle("checked")),
    );
    container.appendChild(checkbox);

    return container;
  }

  private _create_setting_slider(
    label: string,
    value: number,
    on_change: (value: number) => void,
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

    const notch = this._create_slider_notch(show_notch, () => on_change(0));
    const track = this._create_dot_track(value, min, max, 9, on_change);

    slider_container.appendChild(notch);
    slider_container.appendChild(track);
    container.appendChild(slider_container);

    return container;
  }

  private _create_slider_notch(
    visible: boolean,
    on_click: () => void,
  ): HTMLElement {
    const notch = document.createElement("div");
    notch.className = `slider-notch ${visible ? "" : "hidden"}`;

    if (visible) {
      notch.addEventListener("click", on_click);
    }

    return notch;
  }

  private _create_dot_track(
    current_value: number,
    min: number,
    max: number,
    dot_count: number,
    on_change: (value: number) => void,
  ): HTMLElement {
    const track = document.createElement("div");
    track.className = "dot-track";

    const selected_index = Math.round(
      ((current_value - min) / (max - min)) * (dot_count - 1),
    );
    track.dataset.selectedIndex = selected_index.toString();

    for (let i = 0; i < dot_count; i++) {
      const dot = this._create_dot(i, selected_index, () => {
        const new_value = Math.round(min + (i / (dot_count - 1)) * (max - min));
        this._update_track_visuals(track, i);
        on_change(new_value);
      });
      track.appendChild(dot);
    }

    return track;
  }

  private _create_dot(
    index: number,
    selected_index: number,
    on_click: () => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "dot-socket-container";

    const dot_element = document.createElement("div");
    dot_element.className = "dot-target";

    this._apply_dot_state(dot_element, index, selected_index);
    container.appendChild(dot_element);

    container.addEventListener("click", (event) => {
      event.stopPropagation();
      on_click();
    });

    return container;
  }

  private _update_track_visuals(track: HTMLElement, new_index: number): void {
    const dots = track.querySelectorAll(".dot-target");
    const old_index = parseInt(track.dataset.selectedIndex || "-1");
    track.dataset.selectedIndex = new_index.toString();

    dots.forEach((dot, index) => {
      const distance = Math.abs(index - old_index);
      const delay = distance * 0.03;

      const dot_element = dot as HTMLElement;
      dot_element.style.transition =
        "background 0.2s ease, box-shadow 0.2s ease, height 0.2s ease, border-radius 0.2s ease";
      dot_element.style.transitionDelay = `${delay}s`;

      this._apply_dot_state(dot_element, index, new_index);
    });
  }

  private _apply_dot_state(
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

  private _create_setting_segmented_control(
    label: string,
    options: string[],
    current_value: string,
    on_change: (value: string) => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "setting-item segmented-item";

    const label_element = document.createElement("label");
    label_element.textContent = label;
    container.appendChild(label_element);

    const track = document.createElement("div");
    track.className = "multi-select-dots";

    const selected_index = options.indexOf(current_value);
    track.dataset.selectedIndex = selected_index.toString();

    options.forEach((option, index) => {
      const dot = this._create_dot(index, selected_index, () => {
        this._update_track_visuals(track, index);
        on_change(option);
      });
      track.appendChild(dot);
    });

    container.appendChild(track);
    return container;
  }
}
