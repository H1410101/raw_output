import { AppStateService } from "../services/AppStateService";
import { RunIngestionService } from "../services/RunIngestionService";
import { BenchmarkView } from "./BenchmarkView";
import { RecentRunsDisplay } from "./RecentRunsDisplay";

/**
 * Interface for navigation trigger elements.
 */
export interface NavButtons {
  /** Button for Recent Runs view. */
  readonly recentButton: HTMLButtonElement;
  /** Button for New Runs view. */
  readonly newButton: HTMLButtonElement;
  /** Button for Benchmarks view. */
  readonly benchmarksButton: HTMLButtonElement;
}

/**
 * Interface for top-level view containers.
 */
export interface ViewContainers {
  /** Container for the Recent Runs view. */
  readonly recentView: HTMLElement;
  /** Container for the New Runs view. */
  readonly newView: HTMLElement;
  /** Container for the Benchmarks view. */
  readonly benchmarksView: HTMLElement;
}

/**
 * Services and components required for navigation logic.
 */
export interface NavDependencies {
  /** The benchmark view component. */
  readonly benchmarkView: BenchmarkView;
  /** Service for ingesting new runs. */
  readonly ingestionService: RunIngestionService;
  /** Display component for new runs. */
  readonly newRunsDisplay: RecentRunsDisplay;
  /** Service for managing application state. */
  readonly appStateService: AppStateService;
}

/**
 * Manages application-level navigation and view switching.
 *
 * Syncs the visual state of buttons and containers with the underlying application state.
 */
export class NavigationController {
  private readonly _navRecent: HTMLButtonElement;

  private readonly _navNew: HTMLButtonElement;

  private readonly _navBenchmarks: HTMLButtonElement;

  private readonly _viewRecent: HTMLElement;

  private readonly _viewNew: HTMLElement;

  private readonly _viewBenchmarks: HTMLElement;

  private readonly _benchmarkView: BenchmarkView;

  private readonly _ingestionService: RunIngestionService;

  private readonly _newRunsDisplay: RecentRunsDisplay;

  private readonly _appStateService: AppStateService;

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
    this._navRecent = buttons.recentButton;
    this._navNew = buttons.newButton;
    this._navBenchmarks = buttons.benchmarksButton;

    this._viewRecent = views.recentView;
    this._viewNew = views.newView;
    this._viewBenchmarks = views.benchmarksView;

    this._benchmarkView = dependencies.benchmarkView;
    this._ingestionService = dependencies.ingestionService;
    this._newRunsDisplay = dependencies.newRunsDisplay;
    this._appStateService = dependencies.appStateService;
  }

  /**
   * Attaches event listeners and restores the persisted navigation state.
   */
  public initialize(): void {
    this._setupListeners();

    this._restoreInitialTab();
  }

  private _setupListeners(): void {
    this._navRecent.addEventListener("click", (): void => {
      this._switchToRecent();
    });

    this._navNew.addEventListener("click", (): Promise<void> => {
      return this._switchToNew();
    });

    this._navBenchmarks.addEventListener("click", (): Promise<void> => {
      return this._switchToBenchmarks();
    });
  }

  private _restoreInitialTab(): void {
    const initialTabId: string = this._appStateService.getActiveTabId();

    if (initialTabId === "nav-new") {
      this._switchToNew();

      return;
    }

    if (initialTabId === "nav-benchmarks") {
      this._switchToBenchmarks();

      return;
    }

    this._switchToRecent();
  }

  private _switchToRecent(): void {
    this._updateActiveNav(this._navRecent);

    this._updateVisibleView(this._viewRecent);

    this._appStateService.setActiveTabId("nav-recent");
  }

  private async _switchToNew(): Promise<void> {
    this._updateActiveNav(this._navNew);

    this._updateVisibleView(this._viewNew);

    this._appStateService.setActiveTabId("nav-new");

    const newRuns = await this._ingestionService.getNewRuns();

    this._newRunsDisplay.renderRuns(newRuns);
  }

  private async _switchToBenchmarks(): Promise<void> {
    this._updateActiveNav(this._navBenchmarks);

    this._updateVisibleView(this._viewBenchmarks);

    this._appStateService.setActiveTabId("nav-benchmarks");

    await this._benchmarkView.render();
  }

  private _updateActiveNav(activeButton: HTMLButtonElement): void {
    this._navRecent.classList.remove("active");
    this._navNew.classList.remove("active");
    this._navBenchmarks.classList.remove("active");

    activeButton.classList.add("active");
  }

  private _updateVisibleView(visibleView: HTMLElement): void {
    this._viewRecent.classList.add("hidden-view");
    this._viewNew.classList.add("hidden-view");
    this._viewBenchmarks.classList.add("hidden-view");

    visibleView.classList.remove("hidden-view");
  }
}
