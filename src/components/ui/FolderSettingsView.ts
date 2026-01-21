/**
 * Configuration for the folder settings actions.
 */
export interface FolderActionHandlers {
  readonly onLinkFolder: () => Promise<void>;
  readonly onForceScan: () => Promise<void>;
  readonly onUnlinkFolder: () => void;
}

/**
 * Configuration for the folder settings view.
 */
export interface FolderSettingsConfig {
  /** Callbacks for folder-related interactions. */
  readonly handlers: FolderActionHandlers;
  /** The name of the currently linked folder, if any. */
  readonly currentFolderName: string | null;
  /** Whether the application has successfully parsed statistics. */
  readonly hasStats?: boolean;
  /** Whether the current folder selection is invalid. */
  readonly isInvalid?: boolean;
  /** Whether the current folder selection is valid. */
  readonly isValid?: boolean;
}

/**
 * Provides a single-column view for folder management and application introduction.
 */
export class FolderSettingsView {
  private readonly _handlers: FolderActionHandlers;

  /** Whether the current folder selection is invalid. */
  private readonly _isInvalid: boolean;

  /** Whether the current folder selection is valid. */
  private readonly _isValid: boolean;

  /** Active ResizeObservers for cleanup. */
  private readonly _observers: ResizeObserver[] = [];

  /** Request animation frame ID for the error scroller. */
  private _scrollerRequestId: number | null = null;

  /** Active error text elements. */
  private readonly _activeErrorElements: HTMLElement[] = [];

  /** The container for scrolling error text. */
  private _errorContainer: HTMLElement | null = null;

  /** The element used to measure width for clamping. */
  private _mainContent: HTMLElement | null = null;

  /** Speed of the scrolling text in pixels per second. */
  private readonly _scrollSpeed: number = 120;

  /**
   * Initializes the view with state management and action handlers.
   *
   * @param config - The view configuration.
   */
  public constructor(config: FolderSettingsConfig) {
    this._handlers = config.handlers;
    this._isInvalid = config.isInvalid ?? false;
    this._isValid = config.isValid ?? false;
  }

  /**
   * Renders the folder settings view into the provided container.
   *
   * @returns The root element of the folder settings view.
   */
  public render(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "folder-settings-container single-column-view";

    const content: HTMLDivElement = document.createElement("div");
    content.className = "folder-settings-main-content";
    this._mainContent = content;

    content.appendChild(this._createIntroTopWrapper());
    content.appendChild(this._createFolderIcon());
    content.appendChild(this._createIntroBottomWrapper());

    container.appendChild(content);

    if (this._isInvalid) {
      requestAnimationFrame(() => this._startErrorScroller());
    }

    return container;
  }

  /**
   * Cleans up resources.
   */
  public destroy(): void {
    this._observers.forEach((observer: ResizeObserver): void => observer.disconnect());
    if (this._scrollerRequestId !== null) {
      cancelAnimationFrame(this._scrollerRequestId);
    }
  }

  /**
   * Creates the centralized folder icon button.
   *
   * @returns The folder icon container.
   */
  private _createFolderIcon(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "central-folder-icon-wrapper";

    const button: HTMLButtonElement = document.createElement("button");
    const baseClass = "central-folder-icon-btn";
    let finalClass = baseClass;
    if (this._isInvalid) finalClass += " invalid-selection";
    else if (this._isValid) finalClass += " valid-selection";
    button.className = finalClass;
    button.setAttribute("aria-label", "Link Kovaak's Stats Folder");

    button.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    `;

    button.addEventListener("click", () => this._handlers.onLinkFolder());

    if (this._isInvalid) {
      this._errorContainer = document.createElement("div");
      this._errorContainer.className = "error-scrolling-text-container";
      container.appendChild(this._errorContainer);
    }

    container.appendChild(button);

    return container;
  }

  /**
   * Starts the animation loop for the scrolling error text.
   */
  private _startErrorScroller(): void {
    if (!this._errorContainer || !this._mainContent) return;

    this._preFillErrorElements();

    let lastTimestamp: number = performance.now();

    const animate = (currentTimestamp: number): void => {
      const deltaTime = (currentTimestamp - lastTimestamp) / 1000;
      lastTimestamp = currentTimestamp;

      this._updateErrorElements(deltaTime);
      this._scrollerRequestId = requestAnimationFrame(animate);
    };

    this._scrollerRequestId = requestAnimationFrame(animate);
  }

  /**
   * Pre-fills error elements from the left boundary to the right boundary.
   */
  private _preFillErrorElements(): void {
    if (!this._errorContainer || !this._mainContent) return;

    const mainWidth = this._mainContent.offsetWidth;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const dist = Math.max(mainWidth * 0.1, Math.min(mainWidth, 10 * rem));
    const deathX = -dist;
    const spawnX = dist;

    // Start from the leftmost visible point (deathX)
    // We want the element's left edge to be at deathX initially.
    let currentX = deathX;

    while (currentX < spawnX) {
      const element = this._spawnErrorElement(currentX);
      const width = element.offsetWidth;
      // Advance currentX to the next element's left edge
      currentX += width;
    }
  }

  /**
   * Updates the position of error elements and handles spawning/despawning.
   *
   * @param deltaTime - Time passed since last frame in seconds.
   */
  private _updateErrorElements(deltaTime: number): void {
    if (!this._errorContainer || !this._mainContent) return;

    const mainWidth = this._mainContent.offsetWidth;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

    const dist = Math.max(mainWidth * 0.1, Math.min(mainWidth, 10 * rem));
    const spawnX = dist;
    const deathX = -dist;

    this._moveElements(deltaTime);
    this._despawnElements(deathX);
    this._maybeSpawnElement(spawnX);
  }

  /**
   * Moves all active error elements based on scroll speed.
   *
   * @param deltaTime - Time passed since last frame in seconds.
   */
  private _moveElements(deltaTime: number): void {
    this._activeErrorElements.forEach((element) => {
      const currentX = parseFloat(element.dataset.x || "0");
      const nextX = currentX - this._scrollSpeed * deltaTime;
      element.dataset.x = nextX.toString();
      element.style.transform = `translateX(${nextX}px)`;
    });
  }

  /**
   * Despawns elements that have moved off the left boundary.
   *
   * @param deathX - The exit boundary coordinate.
   */
  private _despawnElements(deathX: number): void {
    if (this._activeErrorElements.length === 0) return;

    const firstElement = this._activeErrorElements[0];
    const x = parseFloat(firstElement.dataset.x || "0");
    if (x + firstElement.offsetWidth / 2 < deathX) {
      firstElement.remove();
      this._activeErrorElements.shift();
    }
  }

  /**
   * Spawns a new error element if the previous one has moved far enough.
   *
   * @param spawnX - The entry boundary coordinate.
   */
  private _maybeSpawnElement(spawnX: number): void {
    const lastElement = this._activeErrorElements[this._activeErrorElements.length - 1];

    let shouldSpawn = !lastElement;
    if (lastElement) {
      const midpoint = parseFloat(lastElement.dataset.x || "0");
      const width = lastElement.offsetWidth;
      // Spawns when the right edge reaches the entry boundary (spawnX)
      shouldSpawn = (midpoint + width / 2) <= spawnX;
    }

    if (shouldSpawn) {
      // Pass the left edge where we want to spawn
      const entryX = lastElement
        ? parseFloat(lastElement.dataset.x || "0") + lastElement.offsetWidth / 2
        : spawnX;
      this._spawnErrorElement(entryX);
    }
  }

  /**
   * Spawns a single "ERROR: TRY AGAIN" element at the specified left coordinate.
   *
   * @param leftX - The X coordinate for the element's left edge.
   * @returns The created element.
   */
  private _spawnErrorElement(leftX: number): HTMLElement {
    const element = document.createElement("div");
    element.className = "error-scrolling-text";
    element.textContent = "ERROR: TRY AGAIN";

    this._errorContainer!.appendChild(element);
    const width = element.offsetWidth;

    // midpoint = left_edge + width/2
    const initialX = leftX + width / 2;

    element.dataset.x = initialX.toString();
    element.style.transform = `translateX(${initialX}px)`;

    this._activeErrorElements.push(element);

    return element;
  }

  /**
   * Creates a wrapper for the top part of the introduction content.
   *
   * @returns The top intro wrapper element.
   */
  private _createIntroTopWrapper(): HTMLElement {
    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "intro-group-wrapper top-wrapper";
    wrapper.appendChild(this._createIntroTopGroup());

    return wrapper;
  }

  /**
   * Creates a wrapper for the bottom part of the introduction content.
   *
   * @returns The bottom intro wrapper element.
   */
  private _createIntroBottomWrapper(): HTMLElement {
    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "intro-group-wrapper bottom-wrapper";
    wrapper.appendChild(this._createIntroBottomGroup());

    return wrapper;
  }

  /**
   * Creates the title and welcome message for the intro.
   *
   * @returns The intro top group element.
   */
  private _createIntroTopGroup(): HTMLElement {
    const topGroup: HTMLDivElement = document.createElement("div");
    topGroup.className = "intro-top-group";

    const title: HTMLHeadingElement = document.createElement("h2");
    title.textContent = "Welcome to Raw Output!";
    topGroup.appendChild(title);

    const setupInstruction: HTMLParagraphElement = document.createElement("p");
    setupInstruction.className = "setup-instruction";
    setupInstruction.textContent = "To get started, link your Kovaak's Stats folder:";
    topGroup.appendChild(setupInstruction);

    return topGroup;
  }

  /**
   * Creates the instructions group for the intro.
   *
   * @returns The intro bottom group element.
   */
  private _createIntroBottomGroup(): HTMLElement {
    const bottomGroup: HTMLDivElement = document.createElement("div");
    bottomGroup.className = "intro-bottom-group";

    bottomGroup.appendChild(this._createPathInstruction());

    return bottomGroup;
  }

  /**
   * Creates the path instruction paragraph.
   *
   * @returns The path instruction element.
   */
  private _createPathInstruction(): HTMLElement {
    const pathInstruction: HTMLParagraphElement = document.createElement("p");
    pathInstruction.className = "path-instruction";
    pathInstruction.innerHTML =
      "This is located in<br><code>&lt;steam library&gt;/steamapps/common/</code><br><code>FPSAimTrainer/FPSAimTrainer/stats</code>.";

    return pathInstruction;
  }
}
