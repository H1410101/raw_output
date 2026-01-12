/**
 * Configuration for the folder settings actions.
 */
interface FolderActionHandlers {
  readonly onLinkFolder: () => Promise<void>;
  readonly onForceScan: () => Promise<void>;
  readonly onUnlinkFolder: () => void;
}

/**
 * Provides a two-column view for folder management and application introduction.
 *
 * Left column: Folder status and primary actions.
 * Right column: Scrollable introduction text.
 */
export class FolderSettingsView {
  private readonly _handlers: FolderActionHandlers;

  /** The name of the currently linked folder, if any. */
  private readonly _currentFolderName: string | null;

  /** Whether the application has successfully parsed statistics. */
  private readonly _hasStats: boolean;

  /** Active ResizeObservers for cleanup. */
  private readonly _observers: ResizeObserver[] = [];

  /**
   * Initializes the view with state management and action handlers.
   *
   * @param handlers - Callbacks for folder-related interactions.
   * @param currentFolderName - The name of the currently linked folder, if any.
   * @param hasStats - Whether the application has successfully parsed statistics.
   */
  public constructor(
    handlers: FolderActionHandlers,
    currentFolderName: string | null,
    hasStats: boolean = false,
  ) {
    this._handlers = handlers;
    this._currentFolderName = currentFolderName;
    this._hasStats = hasStats;
  }

  /**
   * Renders the folder settings view into the provided container.
   *
   * @returns The root element of the folder settings view.
   */
  public render(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "folder-settings-container pane-container";

    const actionsColumn: HTMLElement = this._createActionsColumn();
    const introColumn: HTMLElement = this._createIntroColumn();

    container.appendChild(actionsColumn);
    container.appendChild(introColumn);

    this._setupAlignment(actionsColumn, introColumn);

    return container;
  }

  /**
   * Cleans up resources.
   */
  public destroy(): void {
    this._observers.forEach((observer: ResizeObserver): void => observer.disconnect());
  }

  /**
   * Creates the actions column container.
   *
   * @returns The actions column element.
   */
  private _createActionsColumn(): HTMLElement {
    const column: HTMLDivElement = document.createElement("div");
    column.className = "folder-settings-actions-column";

    const content: HTMLDivElement = document.createElement("div");
    content.className = "folder-settings-actions-content";

    content.appendChild(this._createTopActionWrapper());
    content.appendChild(this._createSeparator());
    content.appendChild(this._createBottomActionWrapper());

    column.appendChild(content);

    return column;
  }

  /**
   * Creates a wrapper for the top part of the actions column.
   *
   * @returns The top actions wrapper element.
   */
  private _createTopActionWrapper(): HTMLElement {
    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "folder-settings-row-wrapper top-wrapper";
    wrapper.appendChild(this._createStatusItem());

    return wrapper;
  }

  /**
   * Creates a wrapper for the bottom part of the actions column.
   *
   * @returns The bottom actions wrapper element.
   */
  private _createBottomActionWrapper(): HTMLElement {
    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "folder-settings-row-wrapper bottom-wrapper";
    wrapper.appendChild(this._createActionButtons());

    return wrapper;
  }

  /**
   * Creates the row containing the primary folder actions.
   *
   * @returns The button container.
   */
  private _createActionButtons(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "folder-setting-row";

    container.appendChild(
      this._createActionItem("Link Stats Folder", this._handlers.onLinkFolder),
    );
    container.appendChild(
      this._createActionItem("Force Scan CSVs", this._handlers.onForceScan),
    );
    container.appendChild(
      this._createActionItem(
        "Unlink Folder",
        this._handlers.onUnlinkFolder,
        true,
      ),
    );

    return container;
  }

  /**
   * Creates the status item showing the currently connected folder.
   *
   * @returns The status element.
   */
  private _createStatusItem(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "folder-setting-row";

    container.appendChild(this._createStatusTitle());
    container.appendChild(this._createStatusDetails());

    return container;
  }

  /**
   * Creates the status title element based on current link state.
   *
   * @returns The title element.
   */
  private _createStatusTitle(): HTMLElement {
    const title: HTMLDivElement = document.createElement("div");
    title.className = "folder-status-title";

    if (!this._currentFolderName) {
      title.textContent = "Not Linked";
    } else if (!this._hasStats) {
      title.textContent = "Stats Not Found";
    } else {
      title.textContent = "Stats Linked";
    }

    return title;
  }

  /**
   * Creates the status details element (Connected To label).
   *
   * @returns The details element.
   */
  private _createStatusDetails(): HTMLElement {
    const details: HTMLDivElement = document.createElement("div");
    details.className = "folder-status-details";

    if (!this._currentFolderName) {
      details.classList.add("hidden-view");
    }

    const label: HTMLSpanElement = document.createElement("span");
    label.className = "connected-label";
    label.textContent = "Connected To:";

    const name: HTMLSpanElement = document.createElement("span");
    name.className = "folder-name-highlight";
    name.textContent = this._currentFolderName || "";

    details.appendChild(label);
    details.appendChild(name);

    return details;
  }

  /**
   * Creates a single action button item.
   *
   * @param text - Button text.
   * @param handler - Click handler.
   * @param isDanger - Whether to apply danger styling.
   * @returns The button element.
   */
  private _createActionItem(
    text: string,
    handler: () => void | Promise<void>,
    isDanger: boolean = false,
  ): HTMLElement {
    const button: HTMLButtonElement = document.createElement("button");
    button.className = `folder-action-item ${isDanger ? "danger" : ""}`;
    button.textContent = text;
    button.addEventListener("click", () => handler());

    return button;
  }

  /**
   * Creates the vertical separator between top and bottom groups.
   *
   * @returns The separator element.
   */
  private _createSeparator(): HTMLElement {
    const separator: HTMLDivElement = document.createElement("div");
    separator.className = "folder-settings-separator";

    return separator;
  }

  /**
   * Creates the intro column container.
   *
   * @returns The intro column element.
   */
  private _createIntroColumn(): HTMLElement {
    const column: HTMLDivElement = document.createElement("div");
    column.className = "folder-settings-intro-column";

    const content: HTMLDivElement = document.createElement("div");
    content.className = "intro-text-content";

    content.appendChild(this._createIntroduction());
    column.appendChild(content);

    return column;
  }

  /**
   * Creates the introduction column content.
   *
   * @returns The intro column element.
   */
  private _createIntroduction(): HTMLElement {
    const intro: HTMLDivElement = document.createElement("div");
    intro.className = "app-introduction";

    intro.appendChild(this._createIntroTopWrapper());
    intro.appendChild(this._createIntroSeparator());
    intro.appendChild(this._createIntroBottomWrapper());

    return intro;
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

    return topGroup;
  }

  /**
   * Creates the separator for the intro column.
   *
   * @returns The intro separator element.
   */
  private _createIntroSeparator(): HTMLElement {
    const separator: HTMLDivElement = document.createElement("div");
    separator.className = "folder-settings-separator intro-separator";

    return separator;
  }

  /**
   * Creates the instructions group for the intro.
   *
   * @returns The intro bottom group element.
   */
  private _createIntroBottomGroup(): HTMLElement {
    const bottomGroup: HTMLDivElement = document.createElement("div");
    bottomGroup.className = "intro-bottom-group";

    bottomGroup.appendChild(this._createSetupInstruction());
    bottomGroup.appendChild(this._createPathInstruction());

    return bottomGroup;
  }

  /**
   * Creates the setup instruction paragraph.
   *
   * @returns The setup instruction element.
   */
  private _createSetupInstruction(): HTMLElement {
    const setupInstruction: HTMLParagraphElement = document.createElement("p");
    setupInstruction.textContent =
      "To get started, link your Kovaak's Stats folder.";

    return setupInstruction;
  }

  /**
   * Creates the path instruction paragraph.
   *
   * @returns The path instruction element.
   */
  private _createPathInstruction(): HTMLElement {
    const pathInstruction: HTMLParagraphElement = document.createElement("p");
    pathInstruction.innerHTML =
      "This is located in<br><code>&lt;steam library&gt;/steamapps/common/</code><br><code>FPSAimTrainer/FPSAimTrainer/stats</code>.";

    return pathInstruction;
  }

  /**
   * Sets up cross-column alignment for separators and content.
   *
   * @param actionsColumn - The column containing folder actions.
   * @param introColumn - The column containing intro text.
   */
  private _setupAlignment(
    actionsColumn: HTMLElement,
    introColumn: HTMLElement,
  ): void {
    const actions: HTMLElement | null = actionsColumn.querySelector(
      ".folder-settings-actions-content",
    );
    const intro: HTMLElement | null = introColumn.querySelector(
      ".app-introduction",
    );

    if (!actions || !intro) {
      return;
    }

    const quadrants: { wrapper: HTMLElement; content: HTMLElement }[] =
      this._identifyQuadrants(actions, intro);

    if (quadrants.length === 0) {
      return;
    }

    this._initializeQuadrantSync(quadrants);
  }

  /**
   * Identifies valid quadrant wrappers and their content children.
   *
   * @param actionsContent - Actions column content.
   * @param introContent - Intro column content.
   * @returns List of valid quadrants.
   */
  private _identifyQuadrants(
    actionsContent: HTMLElement,
    introContent: HTMLElement,
  ): { wrapper: HTMLElement; content: HTMLElement }[] {
    const selectors: string[] = [".top-wrapper", ".bottom-wrapper"];
    const valid: { wrapper: HTMLElement; content: HTMLElement }[] = [];

    [actionsContent, introContent].forEach((container): void => {
      selectors.forEach((selector): void => {
        const wrapper: HTMLElement | null = container.querySelector(selector);
        const content: HTMLElement | null = wrapper?.firstElementChild as HTMLElement;

        if (wrapper && content) {
          valid.push({ wrapper, content });
        }
      });
    });

    return valid;
  }

  /**
   * Initializes ResizeObserver and initial sync for quadrants.
   *
   * @param quadrants - Quadrants to synchronize.
   */
  private _initializeQuadrantSync(
    quadrants: { wrapper: HTMLElement; content: HTMLElement }[],
  ): void {
    const observer: ResizeObserver = new ResizeObserver((): void => {
      this._updateQuadrantsSync(quadrants);
    });

    quadrants.forEach((quadrant): void => observer.observe(quadrant.content));
    this._observers.push(observer);

    requestAnimationFrame((): void => {
      this._updateQuadrantsSync(quadrants);
    });
  }

  /**
   * Updates the height of all synchronized quadrants to match the tallest one.
   *
   * @param quadrants - The list of quadrants to synchronize.
   */
  private _updateQuadrantsSync(
    quadrants: { wrapper: HTMLElement; content: HTMLElement }[],
  ): void {
    const heights: number[] = quadrants.map(
      (quadrant): number => quadrant.content.offsetHeight,
    );
    const maxHeight: number = Math.max(...heights);

    quadrants.forEach((quadrant): void => {
      quadrant.wrapper.style.height = `${maxHeight}px`;
    });
  }
}
