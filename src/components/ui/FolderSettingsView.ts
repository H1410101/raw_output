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

  private readonly _currentFolderName: string | null;

  private readonly _hasStats: boolean;

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

    container.appendChild(this._createActionsColumn());
    container.appendChild(this._createIntroColumn());

    return container;
  }

  /**
   * Cleans up resources.
   */
  public destroy(): void {}

  private _createActionsColumn(): HTMLElement {
    const column: HTMLDivElement = document.createElement("div");
    column.className = "folder-settings-actions-column";

    const content: HTMLDivElement = document.createElement("div");
    content.className = "folder-settings-actions-content";

    content.appendChild(this._createStatusItem());
    content.appendChild(this._createSeparator());
    content.appendChild(this._createActionButtons());

    column.appendChild(content);

    return column;
  }

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

  private _createStatusItem(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "folder-setting-row";

    container.appendChild(this._createStatusTitle());
    container.appendChild(this._createStatusDetails());

    return container;
  }

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

  private _createStatusDetails(): HTMLElement {
    const details: HTMLDivElement = document.createElement("div");
    details.className = "folder-status-details";

    if (!this._currentFolderName) {
      details.classList.add("invisible");
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

  private _createSeparator(): HTMLElement {
    const separator: HTMLDivElement = document.createElement("div");
    separator.className = "folder-settings-separator";

    return separator;
  }

  private _createIntroColumn(): HTMLElement {
    const column: HTMLDivElement = document.createElement("div");
    column.className = "folder-settings-intro-column";

    const content: HTMLDivElement = document.createElement("div");
    content.className = "intro-text-content";

    content.appendChild(this._createIntroduction());
    column.appendChild(content);

    return column;
  }

  private _createIntroduction(): HTMLElement {
    const intro: HTMLDivElement = document.createElement("div");
    intro.className = "app-introduction";

    intro.appendChild(this._createIntroTopGroup());
    intro.appendChild(this._createIntroSeparator());
    intro.appendChild(this._createIntroBottomGroup());

    return intro;
  }

  private _createIntroTopGroup(): HTMLElement {
    const topGroup: HTMLDivElement = document.createElement("div");
    topGroup.className = "intro-top-group";

    const title: HTMLHeadingElement = document.createElement("h2");
    title.textContent = "Welcome to Raw Output!";
    topGroup.appendChild(title);

    return topGroup;
  }

  private _createIntroSeparator(): HTMLElement {
    const separator: HTMLDivElement = document.createElement("div");
    separator.className = "folder-settings-separator intro-separator";

    return separator;
  }

  private _createIntroBottomGroup(): HTMLElement {
    const bottomGroup: HTMLDivElement = document.createElement("div");
    bottomGroup.className = "intro-bottom-group";

    bottomGroup.appendChild(this._createSetupInstruction());
    bottomGroup.appendChild(this._createPathInstruction());

    return bottomGroup;
  }

  private _createSetupInstruction(): HTMLElement {
    const setupInstruction: HTMLParagraphElement = document.createElement("p");
    setupInstruction.textContent =
      "To get started, link your Kovaak's Stats folder.";

    return setupInstruction;
  }

  private _createPathInstruction(): HTMLElement {
    const pathInstruction: HTMLParagraphElement = document.createElement("p");
    pathInstruction.innerHTML =
      "This is located in<br><code>&lt;steam library&gt;/steamapps/common/</code><br><code>FPSAimTrainer/FPSAimTrainer/stats</code>.";

    return pathInstruction;
  }
}
