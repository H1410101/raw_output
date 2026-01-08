export class SettingsUiFactory {
  /**
   * Creates a standardized toggle switch.
   */
  public static createToggle(
    label: string,
    isChecked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "setting-item toggle-item";

    container.appendChild(this._createLabel(label));
    container.appendChild(this._createToggleCircle(isChecked, onChange));

    return container;
  }

  /**
   * Creates a standardized dot-based slider.
   */
  public static createSlider(
    label: string,
    value: number,
    onChange: (value: number) => void,
    min: number = 0,
    max: number = 100,
    showNotch: boolean = false,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "setting-item slider-item";

    container.appendChild(this._createLabel(label));
    container.appendChild(
      this._createSliderContainer(value, onChange, min, max, showNotch),
    );

    return container;
  }

  /**
   * Creates a segmented control using dots.
   */
  public static createSegmentedControl(
    label: string,
    options: string[],
    currentValue: string,
    onChange: (value: string) => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "setting-item segmented-item";

    container.appendChild(this._createLabel(label));
    container.appendChild(
      this._createSegmentedTrack(options, currentValue, onChange),
    );

    return container;
  }

  /**
   * Creates a group title.
   */
  public static createGroupTitle(text: string): HTMLElement {
    const title = document.createElement("div");
    title.className = "settings-group-title";
    title.textContent = text;
    return title;
  }

  /**
   * Groups a main row with its sub-rows.
   */
  public static createSettingsGroup(
    mainRow: HTMLElement,
    subRowsContainer: HTMLElement,
  ): HTMLElement {
    const groupContainer = document.createElement("div");
    groupContainer.className = "settings-group";

    groupContainer.appendChild(mainRow);
    groupContainer.appendChild(subRowsContainer);

    return groupContainer;
  }

  private static _createLabel(text: string): HTMLElement {
    const labelElement = document.createElement("label");
    labelElement.textContent = text;
    return labelElement;
  }

  private static _createToggleCircle(
    isChecked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const checkbox = document.createElement("div");
    checkbox.className = `circle-checkbox ${isChecked ? "checked" : ""}`;
    checkbox.style.transition = "none";

    checkbox.addEventListener("click", () => {
      const newState = checkbox.classList.toggle("checked");
      onChange(newState);
    });

    return checkbox;
  }

  private static _createSliderContainer(
    value: number,
    onChange: (value: number) => void,
    min: number,
    max: number,
    showNotch: boolean,
  ): HTMLElement {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "dot-slider-container";

    const notch = this._createSliderNotch(showNotch, () => onChange(0));
    const track = this._createDotTrack(value, min, max, 9, onChange);

    sliderContainer.appendChild(notch);
    sliderContainer.appendChild(track);

    return sliderContainer;
  }

  private static _createSliderNotch(
    visible: boolean,
    onClick: () => void,
  ): HTMLElement {
    const notch = document.createElement("div");
    notch.className = `slider-notch ${visible ? "" : "hidden"}`;

    if (visible) {
      notch.addEventListener("click", onClick);
    }

    return notch;
  }

  private static _createDotTrack(
    currentValue: number,
    min: number,
    max: number,
    dotCount: number,
    onChange: (value: number) => void,
  ): HTMLElement {
    const track = document.createElement("div");
    track.className = "dot-track";

    const selectedIndex = Math.round(
      ((currentValue - min) / (max - min)) * (dotCount - 1),
    );
    track.dataset.selectedIndex = selectedIndex.toString();

    this._appendDotsToTrack(track, dotCount, selectedIndex, (i) => {
      const newValue = Math.round(min + (i / (dotCount - 1)) * (max - min));
      onChange(newValue);
    });

    return track;
  }

  private static _appendDotsToTrack(
    track: HTMLElement,
    dotCount: number,
    selectedIndex: number,
    onIndexSelect: (index: number) => void,
  ): void {
    for (let i = 0; i < dotCount; i++) {
      const dot = this._createDot(i, selectedIndex, () => {
        this.updateTrackVisuals(track, i);
        onIndexSelect(i);
      });

      track.appendChild(dot);
    }
  }

  private static _createDot(
    index: number,
    selectedIndex: number,
    onClick: () => void,
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = "dot-socket-container";
    const dotElement = document.createElement("div");
    dotElement.className = "dot-target";

    this._applyDotState(dotElement, index, selectedIndex);
    container.appendChild(dotElement);

    container.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      onClick();
    });

    return container;
  }

  /**
   * Updates the visual state of dots in a track.
   */
  public static updateTrackVisuals(track: HTMLElement, newIndex: number): void {
    const dots = track.querySelectorAll(".dot-target");
    const oldIndex = parseInt(track.dataset.selectedIndex || "-1");
    track.dataset.selectedIndex = newIndex.toString();

    dots.forEach((dot, index) => {
      const dotElement = dot as HTMLElement;
      this._applyTransitionToDot(dotElement, index, oldIndex);
      this._applyDotState(dotElement, index, newIndex);
    });
  }

  private static _applyTransitionToDot(
    dot: HTMLElement,
    index: number,
    oldIndex: number,
  ): void {
    const distance = Math.abs(index - oldIndex);
    const delay = distance * 0.03;

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
    const track = document.createElement("div");
    track.className = "multi-select-dots";

    const selectedIndex = options.indexOf(currentValue);
    track.dataset.selectedIndex = selectedIndex.toString();

    options.forEach((option, index) => {
      const dot = this._createDot(index, selectedIndex, () => {
        this.updateTrackVisuals(track, index);
        onChange(option);
      });

      track.appendChild(dot);
    });

    return track;
  }
}
