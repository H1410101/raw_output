import { AppStateService } from "../services/AppStateService";
import { BenchmarkView } from "./BenchmarkView";
import { RankedView } from "./RankedView";
import { RankedSessionService } from "../services/RankedSessionService";
import { FocusManagementService } from "../services/FocusManagementService";
import { IdentityService } from "../services/IdentityService";

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
  /** Container for the Account Selection view. */
  readonly accountSelectionView: HTMLElement;
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
  /** Service for managing user identity. */
  readonly identityService: IdentityService;
}

/**
 * Manages application-level navigation and view switching.
 */
export class NavigationController {
  private readonly _navBenchmarks: HTMLButtonElement;
  private readonly _navRanked: HTMLButtonElement;

  private readonly _viewBenchmarks: HTMLElement;
  private readonly _viewRanked: HTMLElement;
  private readonly _viewAccountSelection: HTMLElement;

  private readonly _benchmarkView: BenchmarkView;

  private readonly _appStateService: AppStateService;
  private readonly _rankedSession: RankedSessionService;
  private readonly _rankedView: RankedView;
  private readonly _focusService: FocusManagementService;
  private readonly _identityService: IdentityService;

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
    this._viewAccountSelection = views.accountSelectionView;

    this._benchmarkView = dependencies.benchmarkView;

    this._appStateService = dependencies.appStateService;
    this._rankedSession = dependencies.rankedSession;
    this._rankedView = dependencies.rankedView;
    this._focusService = dependencies.focusService;
    this._identityService = dependencies.identityService;

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
    const hasLinkedAccount = this._identityService.hasLinkedAccount();
    if (!hasLinkedAccount) {
      this._updateVisibleView(this._viewAccountSelection);

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
    const hasLinkedAccount = this._identityService.hasLinkedAccount();

    if (!hasLinkedAccount) {
      this._updateVisibleView(this._viewAccountSelection);

      return;
    }

    const isAlreadyActive: boolean =
      this._appStateService.getActiveTabId() === "nav-benchmarks";

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
    const hasLinkedAccount = this._identityService.hasLinkedAccount();

    if (!hasLinkedAccount) {
      this._updateVisibleView(this._viewAccountSelection);

      return;
    }

    this._appStateService.setActiveTabId("nav-ranked");
    this._updateButtonStates();

    await this._rankedView.render();
    this._updateVisibleView(this._viewRanked);
  }

  /**
   * Switches to the account selection view.
   */
  public switchToAccountSelection(): void {
    this._updateVisibleView(this._viewAccountSelection);
  }

  private _updateVisibleView(visibleView: HTMLElement): void {
    this._viewBenchmarks.classList.add("hidden-view");
    this._viewRanked.classList.add("hidden-view");
    this._viewAccountSelection.classList.add("hidden-view");

    visibleView.classList.remove("hidden-view");

    const isRanked = visibleView === this._viewRanked;
    document.body.classList.toggle("on-ranked-view", isRanked);

    this._updateButtonStates();
  }

  private _updateButtonStates(): void {
    const activeTabId = this._appStateService.getActiveTabId();
    const hasLinkedAccount = this._identityService.hasLinkedAccount();
    const isAccountSelectionVisible = !this._viewAccountSelection.classList.contains("hidden-view");

    this._navBenchmarks.classList.toggle(
      "active",
      !isAccountSelectionVisible && activeTabId === "nav-benchmarks",
    );
    this._navRanked.classList.toggle(
      "active",
      !isAccountSelectionVisible && activeTabId === "nav-ranked",
    );

    const isInactive = !hasLinkedAccount;

    this._navBenchmarks.classList.toggle("inactive", isInactive);
    this._navRanked.classList.toggle("inactive", isInactive);

    const isSessionActive: boolean = this._rankedSession.state.status !== "IDLE";
    this._navRanked.classList.toggle("ranked-active", isSessionActive);
  }
}
