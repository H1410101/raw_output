import { AppStateService } from "../services/AppStateService";
import { RunIngestionService } from "../services/RunIngestionService";
import { BenchmarkView } from "./BenchmarkView";
import { RecentRunsDisplay } from "./RecentRunsDisplay";

/**
 * Responsibility: Manages application-level navigation and view switching.
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

  constructor(
    navRecent: HTMLButtonElement,
    navNew: HTMLButtonElement,
    navBenchmarks: HTMLButtonElement,
    viewRecent: HTMLElement,
    viewNew: HTMLElement,
    viewBenchmarks: HTMLElement,
    benchmarkView: BenchmarkView,
    ingestionService: RunIngestionService,
    newRunsDisplay: RecentRunsDisplay,
    appStateService: AppStateService,
  ) {
    this._navRecent = navRecent;
    this._navNew = navNew;
    this._navBenchmarks = navBenchmarks;

    this._viewRecent = viewRecent;
    this._viewNew = viewNew;
    this._viewBenchmarks = viewBenchmarks;

    this._benchmarkView = benchmarkView;
    this._ingestionService = ingestionService;
    this._newRunsDisplay = newRunsDisplay;
    this._appStateService = appStateService;
  }

  /**
   * Attaches event listeners and restores the persisted navigation state.
   */
  public initialize(): void {
    this._setupListeners();
    this._restoreInitialTab();
  }

  private _setupListeners(): void {
    this._navRecent.addEventListener("click", () => this._switchToRecent());
    this._navNew.addEventListener("click", () => this._switchToNew());
    this._navBenchmarks.addEventListener("click", () =>
      this._switchToBenchmarks(),
    );
  }

  private _restoreInitialTab(): void {
    const initialTabId: string = this._appStateService.get_active_tab_id();

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
    this._appStateService.set_active_tab_id("nav-recent");
  }

  private async _switchToNew(): Promise<void> {
    this._updateActiveNav(this._navNew);
    this._updateVisibleView(this._viewNew);
    this._appStateService.set_active_tab_id("nav-new");

    const newRuns = await this._ingestionService.getNewRuns();
    this._newRunsDisplay.renderRuns(newRuns);
  }

  private async _switchToBenchmarks(): Promise<void> {
    this._updateActiveNav(this._navBenchmarks);
    this._updateVisibleView(this._viewBenchmarks);
    this._appStateService.set_active_tab_id("nav-benchmarks");

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
