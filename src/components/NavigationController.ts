import { AppStateService } from "../services/AppStateService";
import { BenchmarkView } from "./BenchmarkView";

/**
 * Interface for navigation trigger elements.
 */
export interface NavButtons {
  /** Button for Benchmarks view. */
  readonly benchmarksButton: HTMLButtonElement;
}

/**
 * Interface for top-level view containers.
 */
export interface ViewContainers {
  /** Container for the Benchmarks view. */
  readonly benchmarksView: HTMLElement;
}

/**
 * Services and components required for navigation logic.
 */
export interface NavDependencies {
  /** The benchmark view component. */
  readonly benchmarkView: BenchmarkView;
  /** Service for managing application state. */
  readonly appStateService: AppStateService;
}

/**
 * Manages application-level navigation and view switching.
 *
 * Currently simplified to handle the Benchmarks view as the primary interface.
 */
export class NavigationController {
  private readonly _navBenchmarks: HTMLButtonElement;

  private readonly _viewBenchmarks: HTMLElement;

  private readonly _benchmarkView: BenchmarkView;

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
    this._navBenchmarks = buttons.benchmarksButton;

    this._viewBenchmarks = views.benchmarksView;

    this._benchmarkView = dependencies.benchmarkView;

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
    this._navBenchmarks.addEventListener("click", (): Promise<void> => {
      return this._switchToBenchmarks();
    });
  }

  private _restoreInitialTab(): void {
    this._updateVisibleView(this._viewBenchmarks);

    this._appStateService.setActiveTabId("nav-benchmarks");
  }

  private async _switchToBenchmarks(): Promise<void> {
    const isAlreadyActive: boolean =
      this._appStateService.getActiveTabId() === "nav-benchmarks";

    const wasFolderDismissed: boolean =
      await this._benchmarkView.tryReturnToTable();

    this._updateVisibleView(this._viewBenchmarks);

    this._appStateService.setActiveTabId("nav-benchmarks");

    if (!isAlreadyActive && !wasFolderDismissed) {
      await this._benchmarkView.render();
    }
  }

  private _updateVisibleView(visibleView: HTMLElement): void {
    this._viewBenchmarks.classList.add("hidden-view");

    visibleView.classList.remove("hidden-view");
  }
}
