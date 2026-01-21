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

  private readonly _benchmarkView: BenchmarkView;

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

    this._benchmarkView = dependencies.benchmarkView;

    this._appStateService = dependencies.appStateService;
    this._rankedSession = dependencies.rankedSession;
    this._rankedView = dependencies.rankedView;
    this._focusService = dependencies.focusService;

    this._rankedSession.onStateChanged((): void => {
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
    const activeTabId = this._appStateService.getActiveTabId();

    if (activeTabId === "nav-ranked") {
      this._updateVisibleView(this._viewRanked);
    } else {
      this._updateVisibleView(this._viewBenchmarks);
    }
  }

  private async _switchToBenchmarks(): Promise<void> {
    const isAlreadyActive: boolean =
      this._appStateService.getActiveTabId() === "nav-benchmarks";

    const wasFolderDismissed: boolean =
      await this._benchmarkView.tryReturnToTable();

    this._appStateService.setActiveTabId("nav-benchmarks");

    this._updateVisibleView(this._viewBenchmarks);

    if (!isAlreadyActive || wasFolderDismissed) {
      this._highlightCurrentRankedScenario();
    }

    if (!isAlreadyActive && !wasFolderDismissed) {
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
    const isAlreadyActive: boolean =
      this._appStateService.getActiveTabId() === "nav-ranked";

    if (isAlreadyActive) {
      await this._rankedView.tryReturnToTable();

      return;
    }

    await this._benchmarkView.tryReturnToTable();

    this._appStateService.setActiveTabId("nav-ranked");

    await this._rankedView.render();
    this._updateVisibleView(this._viewRanked);
  }

  private _updateVisibleView(visibleView: HTMLElement): void {
    this._viewBenchmarks.classList.add("hidden-view");
    this._viewRanked.classList.add("hidden-view");

    visibleView.classList.remove("hidden-view");

    document.body.classList.toggle(
      "on-ranked-view",
      visibleView === this._viewRanked,
    );

    this._updateButtonStates();
  }

  private _updateButtonStates(): void {
    const activeTabId = this._appStateService.getActiveTabId();

    this._navBenchmarks.classList.toggle(
      "active",
      activeTabId === "nav-benchmarks",
    );
    this._navRanked.classList.toggle("active", activeTabId === "nav-ranked");

    const isSessionActive: boolean = this._rankedSession.state.status !== "IDLE";
    this._navRanked.classList.toggle("ranked-active", isSessionActive);
  }
}
