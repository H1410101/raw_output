import { AudioService } from "../../services/AudioService";

/**
 * Internal configuration for dot track creation.
 */
interface DotTrackConfiguration {
  readonly currentValue: number;
  readonly bounds: { min: number; max: number };
  readonly dotCount: number;
  readonly options?: number[];
  readonly onChange: (value: number) => void;
  readonly hasNotch: boolean;
  readonly type?: "centered" | "left-aligned";
}

/**
 * Configuration for a dot-based slider.
 */
export interface SliderConfiguration {
  /** The display name of the setting. */
  readonly label: string;
  /** The current numeric value. */
  readonly value: number;
  /** Minimum allowed value. */
  readonly min?: number;
  /** Maximum allowed value. */
  readonly max?: number;
  /** Discrete values the slider can snap to. */
  readonly options?: number[];
  /** Optional unit for display (e.g., '%', 'min'). */
  readonly unit?: string;
  /** Whether to show a reset notch at the start. */
  readonly showNotch?: boolean;
  /** Callback triggered on value change. */
  readonly onChange: (value: number) => void;
}

/**
 * Configuration for a segmented control.
 */
export interface SegmentedControlConfiguration {
  /** The display name of the setting. */
  readonly label: string;
  /** Array of string options. */
  readonly options: string[];
  /** The currently selected value. */
  readonly currentValue: string;
  /** Callback triggered on selection change. */
  readonly onChange: (value: string) => void;
  /** Optional layout override. */
  readonly typeOverride?: "centered" | "left-aligned";
  /** Optional manual notch position. */
  readonly notchIndexOverride?: number;
}

/**
 * Factory for creating standardized, tactical UI components for settings menus.
 */
export class SettingsUiFactory {
  private static _audioService: AudioService | null = null;

  /**
   * Sets the audio service instance for UI interactions.
   *
   * @param service - The audio service to use.
   */
  public static setAudioService(service: AudioService): void {
    this._audioService = service;
  }
  /**
   * Creates a standardized toggle switch.
   *
   * @param label - The text label for the toggle.
   * @param isChecked - The current boolean state.
   * @param onChange - Callback for state changes.
   * @returns A constructed HTMLElement.
   */
  public static createToggle(
    label: string,
    isChecked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "setting-item toggle-item";

    container.appendChild(this._createLabel(label));
    container.appendChild(this._createToggleCircle(isChecked, onChange));

    return container;
  }

  /**
   * Creates a standardized dot-based slider using a configuration object.
   *
   * @param configuration - The slider settings.
   * @returns A constructed HTMLElement.
   */
  public static createSlider(configuration: SliderConfiguration): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    const min: number = configuration.min ?? 0;
    const max: number = configuration.max ?? 100;
    const dotCount: number = configuration.options
      ? configuration.options.length
      : 10;

    container.className = "setting-item slider-item";
    container.appendChild(
      this._createLabel(configuration.label, configuration),
    );
    container.appendChild(
      this._createSliderContainer(configuration, min, max, dotCount),
    );

    return container;
  }

  /**
   * Creates a segmented control using dots and a central notch for selection.
   *
   * @param configuration - The setup parameters for the segmented control.
   * @returns A constructed HTMLElement.
   */
  public static createSegmentedControl(
    configuration: SegmentedControlConfiguration,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "setting-item segmented-item";

    container.appendChild(this._createLabel(configuration.label));
    container.appendChild(this._createSegmentedTrack(configuration));

    return container;
  }

  /**
   * Creates a stylized group title for settings sections.
   *
   * @param text - The title text.
   * @returns A constructed HTMLElement.
   */
  public static createGroupTitle(text: string): HTMLElement {
    const title: HTMLDivElement = document.createElement("div");
    title.className = "settings-group-title";
    title.textContent = text;

    return title;
  }

  /**
   * Groups a primary setting row with its dependent sub-rows.
   * Automatically handles visibility toggling if the main row contains a checkbox.
   *
   * @param mainRow - The parent setting element.
   * @param subRowsContainer - Container for child settings.
   * @returns A constructed HTMLElement.
   */
  public static createSettingsGroup(
    mainRow: HTMLElement,
    subRowsContainer: HTMLElement,
  ): HTMLElement {
    const groupContainer: HTMLDivElement = document.createElement("div");
    groupContainer.className = "settings-group";

    const checkbox: HTMLElement | null =
      mainRow.querySelector(".circle-checkbox");
    if (checkbox) {
      checkbox.addEventListener("click", (): void => {
        const isChecked: boolean = checkbox.classList.contains("checked");
        subRowsContainer.classList.toggle("hidden", !isChecked);
      });
    }

    groupContainer.appendChild(mainRow);
    groupContainer.appendChild(subRowsContainer);

    return groupContainer;
  }

  /**
   * Updates the visual state of dots in a track based on the new index.
   *
   * @param track - The track element containing dots.
   * @param newIndex - The index of the dot to be selected.
   */
  /**
   * Updates the visual state of the dots and notch in a track.
   *
   * @param track - The track element containing dots.
   * @param newIndex - The index of the dot to be selected.
   */
  public static updateTrackVisuals(track: HTMLElement, newIndex: number): void {
    const context = this._resolveVisualContext(track, newIndex);
    const items = context.target.querySelectorAll(".dot-target, .slider-notch");

    const oldIndex = parseInt(context.target.dataset.selectedIndex || "-1");
    context.target.dataset.selectedIndex = context.index.toString();

    const trackType = track.dataset.trackType || "left-aligned";

    items.forEach((item: Element, index: number): void => {
      const element = item as HTMLElement;
      this._applyTransitionToItem(element, index, oldIndex);
      this._applyItemState(element, index, context.index, trackType);
      this._playWaveHitSound(index, oldIndex, context.index);
    });
  }

  private static _playWaveHitSound(
    index: number,
    oldIndex: number,
    newIndex: number,
  ): void {
    if (!this._audioService || oldIndex === -1 || oldIndex === newIndex) {
      return;
    }

    const minIdx: number = Math.min(oldIndex, newIndex);
    const maxIdx: number = Math.max(oldIndex, newIndex);

    if (index >= minIdx && index <= maxIdx) {
      const distance: number = Math.abs(index - oldIndex);
      const delay: number = distance * 0.03;

      setTimeout((): void => {
        this._audioService?.playLight(0.35);
      }, delay * 1000);
    }
  }
  /**
   * Resolves the visual target and logical index based on the presence of an external notch.
   *
   * @param track - The track element to resolve context for.
   * @param newIndex - The newly selected index.
   * @returns An object containing the target element and adjusted index.
   */
  private static _resolveVisualContext(
    track: HTMLElement,
    newIndex: number,
  ): { target: HTMLElement; index: number } {
    const parent = track.parentElement;
    const isSlider = parent?.classList.contains("dot-slider-container");
    const hasExternalNotch = isSlider && !track.querySelector(".slider-notch");

    if (hasExternalNotch && parent) {
      return { target: parent, index: newIndex + 1 };
    }

    return { target: track, index: newIndex };
  }

  private static _createLabel(
    text: string,
    config?: SliderConfiguration,
  ): HTMLElement {
    const labelElement: HTMLLabelElement = document.createElement("label");
    labelElement.textContent = text;

    if (config?.unit) {
      const valueSpan: HTMLSpanElement = document.createElement("span");
      valueSpan.className = "slider-value-display";
      valueSpan.style.color = "var(--lower-band-3)";
      valueSpan.style.marginLeft = "0.5rem";
      valueSpan.textContent = `${config.value}${config.unit}`;
      labelElement.appendChild(valueSpan);
    }

    return labelElement;
  }

  private static _createToggleCircle(
    isChecked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const checkbox: HTMLDivElement = document.createElement("div");
    checkbox.className = `circle-checkbox ${isChecked ? "checked" : ""}`;

    checkbox.addEventListener("click", (): void => {
      const newState: boolean = checkbox.classList.toggle("checked");
      this._audioService?.playLight(0.5);
      onChange(newState);
    });

    return checkbox;
  }

  private static _createSliderContainer(
    config: SliderConfiguration,
    min: number,
    max: number,
    dotCount: number,
  ): HTMLElement {
    const sliderContainer: HTMLDivElement = document.createElement("div");
    sliderContainer.className = "dot-slider-container";

    const track = this._createTrackWithEvents(
      config,
      { min, max, dotCount },
      sliderContainer,
    );

    if (config.showNotch) {
      this._setupSliderWithNotch(sliderContainer, track, config, min);
    }

    sliderContainer.appendChild(track);

    return sliderContainer;
  }

  private static _setupSliderWithNotch(
    container: HTMLElement,
    track: HTMLElement,
    config: SliderConfiguration,
    min: number,
  ): void {
    const notch = this._createNotchWithEvents(config, min, track, container);
    container.appendChild(notch);

    container.dataset.notchIndex = "0";

    const dotIndex = parseInt(track.dataset.selectedIndex || "-1");
    if (dotIndex !== -1) {
      container.dataset.selectedIndex = (dotIndex + 1).toString();
    } else if (config.value === min) {
      container.dataset.selectedIndex = "0";
    }
  }

  private static _createTrackWithEvents(
    config: SliderConfiguration,
    bounds: { min: number; max: number; dotCount: number },
    container: HTMLElement,
  ): HTMLElement {
    return this._createDotTrack({
      currentValue: config.value,
      bounds: { min: bounds.min, max: bounds.max },
      dotCount: bounds.dotCount,
      options: config.options,
      onChange: (value: number): void =>
        this._handleSliderUpdate(container, value, config),
      hasNotch: config.showNotch ?? false,
      type: "left-aligned",
    });
  }

  private static _createNotchWithEvents(
    config: SliderConfiguration,
    min: number,
    track: HTMLElement,
    container: HTMLElement,
  ): HTMLElement {
    return this._createSliderNotch(
      config.showNotch ?? false,
      config.value === min,
      (): void => {
        this.updateTrackVisuals(track, -1);
        this._handleSliderUpdate(container, min, config);
      },
    );
  }

  private static _handleSliderUpdate(
    sliderContainer: HTMLElement,
    newValue: number,
    config: SliderConfiguration,
  ): void {
    const parent: HTMLElement | null = sliderContainer.parentElement;

    if (parent && config.unit) {
      const display: HTMLElement | null = parent.querySelector(
        ".slider-value-display",
      );
      if (display) {
        display.textContent = `${newValue}${config.unit}`;
      }
    }

    config.onChange(newValue);
  }

  private static _createSliderNotch(
    visible: boolean,
    isActive: boolean,
    onClick: () => void,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "dot-socket-container";

    const notch: HTMLDivElement = document.createElement("div");
    const activeClass: string = isActive ? "active" : "";
    notch.className = `slider-notch ${visible ? "" : "hidden"} ${activeClass}`;

    if (!isActive) {
      notch.classList.add("dull");
    }

    const index = isActive ? 0 : -1;
    this._applyTransitionToItem(notch, 0, index);

    container.appendChild(notch);

    if (visible) {
      container.addEventListener("click", (event: MouseEvent): void => {
        this._handleNotchClick(event, onClick);
      });
    }

    return container;
  }

  private static _handleNotchClick(
    event: MouseEvent,
    onClick: () => void,
  ): void {
    event.stopPropagation();
    this._audioService?.playLight(0.7);
    onClick();
  }

  private static _createDotTrack(config: DotTrackConfiguration): HTMLElement {
    const track: HTMLDivElement = document.createElement("div");
    const range: number = config.bounds.max - config.bounds.min;
    const totalSteps: number = config.hasNotch
      ? config.dotCount
      : config.dotCount - 1;
    const stepSize: number = config.options ? 1 : range / totalSteps;

    this._initializeTrack(track, config, stepSize);
    const trackType: string = config.type || "left-aligned";
    track.dataset.trackType = trackType;

    this._appendDotsToTrack(
      track,
      config.dotCount,
      parseInt(track.dataset.selectedIndex || "-1"),
      (index: number): void =>
        this._handleDotSelection(index, config, stepSize),
    );

    return track;
  }

  private static _initializeTrack(
    track: HTMLElement,
    config: DotTrackConfiguration,
    stepSize: number,
  ): void {
    const selectedIndex: number = config.options
      ? config.options.indexOf(config.currentValue)
      : this._calculateSelectedIndex(
        config.currentValue,
        config.bounds.min,
        stepSize,
        config.hasNotch,
      );

    track.className = "dot-track";
    track.dataset.selectedIndex = selectedIndex.toString();
  }

  private static _handleDotSelection(
    index: number,
    config: DotTrackConfiguration,
    stepSize: number,
  ): void {
    if (config.options) {
      config.onChange(config.options[index]);

      return;
    }

    const value: number = config.hasNotch
      ? config.bounds.min + (index + 1) * stepSize
      : config.bounds.min + index * stepSize;

    config.onChange(Math.round(value));
  }

  private static _calculateSelectedIndex(
    current: number,
    min: number,
    stepSize: number,
    hasNotch: boolean,
  ): number {
    if (hasNotch) {
      return current > min ? Math.round((current - min) / stepSize) - 1 : -1;
    }

    return Math.round((current - min) / stepSize);
  }

  private static _appendDotsToTrack(
    track: HTMLElement,
    dotCount: number,
    selectedIndex: number,
    onIndexSelect: (index: number) => void,
  ): void {
    const trackType: string = track.dataset.trackType || "left-aligned";

    for (let index: number = 0; index < dotCount; index++) {
      const dot: HTMLElement = this._createDot(
        index,
        selectedIndex,
        (): void => {
          this._updateTrackOnSelection(track, index);
          this._audioService?.playLight(0.5);
          onIndexSelect(index);
        },
        trackType,
      );
      track.appendChild(dot);
    }
  }

  private static _updateTrackOnSelection(
    track: HTMLElement,
    index: number,
  ): void {
    this.updateTrackVisuals(track, index);
  }

  private static _createDot(
    index: number,
    selectedIndex: number,
    onClick: () => void,
    trackType: string,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    const dotElement: HTMLDivElement = document.createElement("div");

    container.className = "dot-socket-container";
    dotElement.className = "dot-target";
    this._applyItemState(dotElement, index, selectedIndex, trackType);

    container.appendChild(dotElement);
    container.addEventListener("click", (event: MouseEvent): void => {
      event.stopPropagation();
      onClick();
    });

    return container;
  }

  private static _applyTransitionToItem(
    item: HTMLElement,
    index: number,
    oldIndex: number,
  ): void {
    const distance = this._calculateWaveDistance(index, oldIndex);
    const delay = distance * 0.03;

    item.style.transition =
      "background 0.2s ease, box-shadow 0.2s ease, height 0.2s ease, border-radius 0.2s ease, transform 0.2s ease";
    item.style.transitionDelay = `${delay}s`;
  }

  private static _calculateWaveDistance(
    itemIndex: number,
    oldIndex: number,
  ): number {
    if (oldIndex === -1) {
      return 0;
    }

    return Math.abs(itemIndex - oldIndex);
  }

  private static _applyItemState(
    element: HTMLElement,
    index: number,
    selectedIndex: number,
    trackType: string,
  ): void {
    element.classList.remove("pill", "glow", "dull", "active");

    if (index === selectedIndex) {
      const isNotch: boolean = element.classList.contains("slider-notch");
      if (isNotch) {
        element.classList.add("active");
      } else {
        this._applyActiveState(element);
      }

      return;
    }

    if (trackType === "centered") {
      this._applyCenteredState(element, index, selectedIndex);

      return;
    }

    this._applyLeftAlignedState(element, index, selectedIndex);
  }

  private static _applyActiveState(element: HTMLElement): void {
    if (element.classList.contains("slider-notch")) {
      element.classList.add("active");
    } else {
      element.classList.add("pill");
    }
  }

  private static _applyCenteredState(
    element: HTMLElement,
    index: number,
    selectedIndex: number,
  ): void {
    const container: HTMLElement | null = element.closest(
      ".dot-track, .dot-slider-container",
    );
    const notchIndex: number = parseInt(container?.dataset?.notchIndex || "2");
    const isNotch: boolean = element.classList.contains("slider-notch");

    if (selectedIndex === notchIndex) {
      this._applyNotchActiveState(element, isNotch);

      return;
    }

    const isDirectionalGlow: boolean =
      (selectedIndex < notchIndex &&
        index > selectedIndex &&
        index < notchIndex) ||
      (selectedIndex > notchIndex &&
        index < selectedIndex &&
        index > notchIndex);

    element.classList.add(isDirectionalGlow ? "glow" : "dull");
  }

  private static _applyNotchActiveState(
    element: HTMLElement,
    isNotch: boolean,
  ): void {
    if (isNotch) {
      element.classList.add("active");
    } else {
      element.classList.add("dull");
    }
  }

  private static _applyLeftAlignedState(
    element: HTMLElement,
    index: number,
    selectedIndex: number,
  ): void {
    const isNotch: boolean = element.classList.contains("slider-notch");

    if (index < selectedIndex && !isNotch) {
      element.classList.add("glow");
    } else {
      element.classList.add("dull");
    }
  }

  private static _createSegmentedTrack(
    configuration: SegmentedControlConfiguration,
  ): HTMLElement {
    const track: HTMLDivElement = document.createElement("div");
    const selectedIndex: number = configuration.options.indexOf(
      configuration.currentValue,
    );

    const trackType: string = this._resolveTrackType(configuration);
    const notchPos: number = this._resolveNotchPosition(
      configuration,
      trackType,
    );

    this._setupTrackAttributes(track, selectedIndex, trackType, notchPos);
    this._appendSegmentedOptions(track, configuration, notchPos, selectedIndex);

    return track;
  }

  private static _resolveTrackType(
    config: SegmentedControlConfiguration,
  ): string {
    if (config.typeOverride) {
      return config.typeOverride;
    }

    return config.options.length === 5 ? "centered" : "left-aligned";
  }

  private static _resolveNotchPosition(
    config: SegmentedControlConfiguration,
    trackType: string,
  ): number {
    if (config.notchIndexOverride !== undefined) {
      return config.notchIndexOverride;
    }

    return trackType === "centered" ? 2 : -1;
  }

  private static _setupTrackAttributes(
    track: HTMLElement,
    selectedIndex: number,
    trackType: string,
    notchPos: number,
  ): void {
    track.className = "multi-select-dots";
    track.dataset.selectedIndex = selectedIndex.toString();
    track.dataset.trackType = trackType;

    if (notchPos !== -1) {
      track.dataset.notchIndex = notchPos.toString();
    }
  }

  private static _appendSegmentedOptions(
    track: HTMLElement,
    config: SegmentedControlConfiguration,
    notchPos: number,
    selectedIndex: number,
  ): void {
    const trackType: string = track.dataset.trackType || "left-aligned";

    config.options.forEach((option: string, index: number): void => {
      const onSelect = (): void => {
        this.updateTrackVisuals(track, index);
        config.onChange(option);
      };

      const item: HTMLElement = this._createSegmentedItem(
        { index, notchPos, selectedIndex, trackType },
        onSelect,
      );

      track.appendChild(item);
    });
  }

  private static _createSegmentedItem(
    context: {
      index: number;
      notchPos: number;
      selectedIndex: number;
      trackType: string;
    },
    onSelect: () => void,
  ): HTMLElement {
    if (context.index === context.notchPos) {
      return this._createNotchItem(
        context.index,
        context.selectedIndex,
        onSelect,
        context.trackType,
      );
    }

    return this._createDot(
      context.index,
      context.selectedIndex,
      onSelect,
      context.trackType,
    );
  }

  private static _createNotchItem(
    index: number,
    selectedIndex: number,
    onClick: () => void,
    trackType: string,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    const notchElement: HTMLDivElement = document.createElement("div");
    container.className = "dot-socket-container";
    notchElement.className = "slider-notch";

    // Override margin for segmented control
    notchElement.style.margin = "0";

    this._applyItemState(notchElement, index, selectedIndex, trackType);

    container.appendChild(notchElement);
    container.addEventListener("click", (event: MouseEvent): void => {
      event.stopPropagation();
      onClick();
    });

    return container;
  }
}
