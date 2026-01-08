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
 * Factory for creating standardized, tactical UI components for settings menus.
 */
export class SettingsUiFactory {
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
   * Creates a segmented control using dots for selection.
   *
   * @param label - The text label.
   * @param options - Array of string options.
   * @param currentValue - The currently selected option.
   * @param onChange - Callback for selection changes.
   * @returns A constructed HTMLElement.
   */
  public static createSegmentedControl(
    label: string,
    options: string[],
    currentValue: string,
    onChange: (value: string) => void,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "setting-item segmented-item";

    container.appendChild(this._createLabel(label));

    container.appendChild(
      this._createSegmentedTrack(options, currentValue, onChange),
    );

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
  public static updateTrackVisuals(track: HTMLElement, newIndex: number): void {
    const dots: NodeListOf<Element> = track.querySelectorAll(".dot-target");

    const oldIndex: number = parseInt(track.dataset.selectedIndex || "-1");

    track.dataset.selectedIndex = newIndex.toString();

    dots.forEach((dot: Element, index: number): void => {
      const dotElement: HTMLElement = dot as HTMLElement;

      this._applyTransitionToDot(dotElement, index, oldIndex);

      this._applyDotState(dotElement, index, newIndex);
    });
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

    checkbox.style.transition = "none";

    checkbox.addEventListener("click", (): void => {
      const newState: boolean = checkbox.classList.toggle("checked");

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
    const showNotch: boolean = config.showNotch ?? false;
    sliderContainer.className = "dot-slider-container";

    const track: HTMLElement = this._createDotTrack({
      currentValue: config.value,
      bounds: { min, max },
      dotCount,
      options: config.options,
      onChange: (value: number): void =>
        this._handleSliderUpdate(sliderContainer, value, config),
      hasNotch: showNotch,
    });

    const notch: HTMLElement = this._createSliderNotch(
      showNotch,
      config.value === min,

      (): void => {
        this.updateTrackVisuals(track, -1);

        this._handleSliderUpdate(sliderContainer, min, config);
      },
    );

    sliderContainer.appendChild(notch);

    sliderContainer.appendChild(track);

    return sliderContainer;
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
    const notch: HTMLDivElement = document.createElement("div");
    const activeClass: string = isActive ? "active" : "";
    notch.className = `slider-notch ${visible ? "" : "hidden"} ${activeClass}`;

    if (visible) {
      notch.addEventListener("click", (event: MouseEvent): void => {
        const current: HTMLElement = event.currentTarget as HTMLElement;
        const parent: HTMLElement | null = current.parentElement;

        if (parent) {
          parent
            .querySelectorAll(".slider-notch")
            .forEach((element: Element): void =>
              element.classList.remove("active"),
            );
        }

        current.classList.add("active");
        onClick();
      });
    }

    return notch;
  }

  private static _createDotTrack(config: DotTrackConfiguration): HTMLElement {
    const track: HTMLDivElement = document.createElement("div");
    const range: number = config.bounds.max - config.bounds.min;
    const totalSteps: number = config.hasNotch
      ? config.dotCount
      : config.dotCount - 1;
    const stepSize: number = config.options ? 1 : range / totalSteps;

    this._initializeTrack(track, config, stepSize);

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
    for (let index: number = 0; index < dotCount; index++) {
      const dot: HTMLElement = this._createDot(
        index,
        selectedIndex,
        (): void => {
          const parent: HTMLElement | null = track.parentElement;
          const notch: HTMLElement | null = parent
            ? parent.querySelector(".slider-notch")
            : null;

          if (notch) {
            notch.classList.remove("active");
          }

          this.updateTrackVisuals(track, index);
          onIndexSelect(index);
        },
      );

      track.appendChild(dot);
    }
  }

  private static _createDot(
    index: number,
    selectedIndex: number,
    onClick: () => void,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    const dotElement: HTMLDivElement = document.createElement("div");

    container.className = "dot-socket-container";

    dotElement.className = "dot-target";

    this._applyDotState(dotElement, index, selectedIndex);

    container.appendChild(dotElement);

    container.addEventListener("click", (event: MouseEvent): void => {
      event.stopPropagation();

      onClick();
    });

    return container;
  }

  private static _applyTransitionToDot(
    dot: HTMLElement,
    index: number,
    oldIndex: number,
  ): void {
    const distance: number = Math.abs(index - oldIndex);

    const delay: number = distance * 0.03;

    dot.style.transition =
      "background 0.2s ease, box-shadow 0.2s ease, height 0.2s ease, border-radius 0.2s ease";

    dot.style.transitionDelay = `${delay}s`;
  }

  private static _applyDotState(
    dot: HTMLElement,
    index: number,
    selectedIndex: number,
  ): void {
    dot.classList.remove("pill", "glow", "dull");

    if (index === selectedIndex) {
      dot.classList.add("pill");

      return;
    }

    if (index < selectedIndex) {
      dot.classList.add("glow");

      return;
    }

    dot.classList.add("dull");
  }

  private static _createSegmentedTrack(
    options: string[],
    currentValue: string,
    onChange: (value: string) => void,
  ): HTMLElement {
    const track: HTMLDivElement = document.createElement("div");

    const selectedIndex: number = options.indexOf(currentValue);

    track.className = "multi-select-dots";

    track.dataset.selectedIndex = selectedIndex.toString();

    options.forEach((option: string, index: number): void => {
      const dot: HTMLElement = this._createDot(
        index,
        selectedIndex,
        (): void => {
          this.updateTrackVisuals(track, index);

          onChange(option);
        },
      );

      track.appendChild(dot);
    });

    return track;
  }
}
