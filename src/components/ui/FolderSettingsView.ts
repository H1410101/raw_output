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

    content.appendChild(this._createIntroTopWrapper());
    content.appendChild(this._createFolderIcon());
    content.appendChild(this._createIntroBottomWrapper());

    container.appendChild(content);

    return container;
  }

  /**
   * Cleans up resources.
   */
  public destroy(): void {
    this._observers.forEach((observer: ResizeObserver): void => observer.disconnect());
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

    container.appendChild(button);

    return container;
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
