import { AppStateService } from "../services/AppStateService";
import { BenchmarkView } from "./BenchmarkView";
import { RankedView } from "./RankedView";
import { RankedSessionService } from "../services/RankedSessionService";
import { FocusManagementService } from "../services/FocusManagementService";

/**
 * Interface for navigation trigger elements.
 */
export interface NavButtons {
  /** Button for Benchmarks view. */
  readonly benchmarksButton: HTMLButtonElement;
  /** Button for Ranked view. */
  readonly rankedButton: HTMLButtonElement;
}

/**
 * Interface for top-level view containers.
 */
export interface ViewContainers {
  /** Container for the Benchmarks view. */
  readonly benchmarksView: HTMLElement;
  /** Container for the Ranked view. */
  readonly rankedView: HTMLElement;
  /** Container for the Folder view. */
  readonly folderView: HTMLElement;
}

/**
 * Services and components required for navigation logic.
 */
export interface NavDependencies {
  /** The benchmark view component. */
  readonly benchmarkView: BenchmarkView;
  /** Service for managing application state. */
  readonly appStateService: AppStateService;
  /** Service for ranked session lifecycle. */
  readonly rankedSession: RankedSessionService;
  /** The ranked view component. */
  readonly rankedView: RankedView;
  /** The folder view component. */
  readonly folderView: import("./FolderView").FolderView;
  /** Service for managing the focused scenario. */
  readonly focusService: FocusManagementService;
}

/**
 * Manages application-level navigation and view switching.
 *
 * Currently simplified to handle the Benchmarks view as the primary interface.
 */
export class NavigationController {
  private readonly _navBenchmarks: HTMLButtonElement;
  private readonly _navRanked: HTMLButtonElement;

  private readonly _viewBenchmarks: HTMLElement;
  private readonly _viewRanked: HTMLElement;
  private readonly _viewFolder: HTMLElement;

  private readonly _benchmarkView: BenchmarkView;
  private readonly _folderView: import("./FolderView").FolderView;

  private readonly _appStateService: AppStateService;
  private readonly _rankedSession: RankedSessionService;
  private readonly _rankedView: RankedView;
  private readonly _focusService: FocusManagementService;

  /**
   * Initializes the controller with grouped navigation elements and dependencies.
   *
   * @param buttons - Navigation button elements.
   * @param views - View container elements.
   * @param dependencies - Required services and components.
   */
  public constructor(
    buttons: NavButtons,
    views: ViewContainers,
    dependencies: NavDependencies,
  ) {
    this._navBenchmarks = buttons.benchmarksButton;
    this._navRanked = buttons.rankedButton;

    this._viewBenchmarks = views.benchmarksView;
    this._viewRanked = views.rankedView;
    this._viewFolder = views.folderView;

    this._benchmarkView = dependencies.benchmarkView;
    this._folderView = dependencies.folderView;

    this._appStateService = dependencies.appStateService;
    this._rankedSession = dependencies.rankedSession;
    this._rankedView = dependencies.rankedView;
    this._focusService = dependencies.focusService;

    this._rankedSession.onStateChanged((): void => {
      this._updateButtonStates();
    });

    this._appStateService.onFolderValidityChanged((): void => {
      this._updateButtonStates();
    });
  }

  /**
   * Attaches event listeners and restores the persisted navigation state.
   */
  public initialize(): void {
    this._setupListeners();

    this._restoreInitialTab();
  }

  private _setupListeners(): void {
    this._navBenchmarks.addEventListener("click", (): Promise<void> => {
      return this._switchToBenchmarks();
    });

    this._navRanked.addEventListener("click", (): Promise<void> => {
      return this._switchToRanked();
    });
  }

  private _restoreInitialTab(): void {
    const isFolderOpen = this._appStateService.getIsFolderViewOpen();
    if (isFolderOpen) {
      this._updateVisibleView(this._viewFolder);

      return;
    }

    const activeTabId = this._appStateService.getActiveTabId();

    if (activeTabId === "nav-ranked") {
      this._updateVisibleView(this._viewRanked);
    } else {
      this._updateVisibleView(this._viewBenchmarks);
    }
  }

  private async _switchToBenchmarks(): Promise<void> {
    if (!this._appStateService.getIsFolderValid()) {
      return;
    }

    const isAlreadyActive: boolean =
      this._appStateService.getActiveTabId() === "nav-benchmarks" &&
      !this._appStateService.getIsFolderViewOpen();

    this._appStateService.setIsFolderViewOpen(false);
    this._appStateService.setActiveTabId("nav-benchmarks");
    this._updateButtonStates();

    this._updateVisibleView(this._viewBenchmarks);

    if (!isAlreadyActive) {
      this._highlightCurrentRankedScenario();
      await this._benchmarkView.render();
    }
  }

  private _highlightCurrentRankedScenario(): void {
    const currentScenario: string | null = this._rankedSession.currentScenarioName;

    if (currentScenario) {
      this._focusService.focusScenario(currentScenario, "RANKED_SESSION");
    }
  }

  private async _switchToRanked(): Promise<void> {
    if (!this._appStateService.getIsFolderValid()) {
      return;
    }

    this._appStateService.setIsFolderViewOpen(false);
    this._appStateService.setActiveTabId("nav-ranked");
    this._updateButtonStates();

    await this._rankedView.render();
    this._updateVisibleView(this._viewRanked);
  }

  /**
   * Toggles the visibility of the folder view.
   */
  public async toggleFolderView(): Promise<void> {
    const isCurrentlyOpen: boolean = this._appStateService.getIsFolderViewOpen();

    if (isCurrentlyOpen) {
      const activeTabId = this._appStateService.getActiveTabId();
      if (activeTabId === "nav-ranked") {
        await this._switchToRanked();
      } else {
        await this._switchToBenchmarks();
      }
    } else {
      await this._switchToFolder();
    }
  }

  /**
   * Attempts to exit the folder view if conditions for returning are met.
   *
   * @returns A promise that resolves to true if the folder view was exited.
   */
  public async tryExitFolderView(): Promise<boolean> {
    if (!this._appStateService.getIsFolderViewOpen()) {
      return false;
    }

    const isStatsFolder: boolean =
      await this._folderView.isFolderValidAndPopulated();

    if (isStatsFolder) {
      await this.toggleFolderView();

      return true;
    }

    return false;
  }

  private async _switchToFolder(): Promise<void> {
    this._appStateService.setIsFolderViewOpen(true);
    await this._folderView.render();
    this._updateVisibleView(this._viewFolder);
  }

  private _updateVisibleView(visibleView: HTMLElement): void {
    this._viewBenchmarks.classList.add("hidden-view");
    this._viewRanked.classList.add("hidden-view");
    this._viewFolder.classList.add("hidden-view");

    visibleView.classList.remove("hidden-view");

    const isRanked = visibleView === this._viewRanked;
    const isFolder = visibleView === this._viewFolder;

    document.body.classList.toggle("on-ranked-view", isRanked);

    const folderBtn: HTMLElement | null = document.getElementById("header-folder-btn");
    if (folderBtn) {
      folderBtn.classList.toggle("active", isFolder);
    }

    this._updateButtonStates();
  }

  private _updateButtonStates(): void {
    const activeTabId = this._appStateService.getActiveTabId();
    const isFolderOpen = this._appStateService.getIsFolderViewOpen();
    const isFolderValid = this._appStateService.getIsFolderValid();

    this._navBenchmarks.classList.toggle(
      "active",
      !isFolderOpen && activeTabId === "nav-benchmarks",
    );
    this._navRanked.classList.toggle(
      "active",
      !isFolderOpen && activeTabId === "nav-ranked",
    );

    const isInactive = isFolderOpen && !isFolderValid;

    this._navBenchmarks.classList.toggle("inactive", isInactive);
    this._navRanked.classList.toggle("inactive", isInactive);

    const isSessionActive: boolean = this._rankedSession.state.status !== "IDLE";
    this._navRanked.classList.toggle("ranked-active", isSessionActive);
  }
}
