import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";
import { SessionService } from "../services/SessionService";
import { AppStateService } from "../services/AppStateService";
import {
  VisualSettingsService,
  VisualSettings,
} from "../services/VisualSettingsService";
import { SessionSettingsService } from "../services/SessionSettingsService";
import {
  FocusManagementService,
  FocusState,
} from "../services/FocusManagementService";
import { BenchmarkTableComponent } from "./benchmark/BenchmarkTableComponent";
import { BenchmarkSettingsController } from "./benchmark/BenchmarkSettingsController";
import { FolderSettingsView } from "./ui/FolderSettingsView";
import { DirectoryAccessService } from "../services/DirectoryAccessService";
import { BenchmarkScenario, DifficultyTier } from "../data/benchmarks";

/**
 * Core services required by the BenchmarkView.
 */
export interface BenchmarkViewServices {
  benchmark: BenchmarkService;
  history: HistoryService;
  rank: RankService;
  session: SessionService;
  sessionSettings: SessionSettingsService;
  focus: FocusManagementService;
  directory: DirectoryAccessService;
  folderActions: {
    onLinkFolder: () => Promise<void>;
    onForceScan: () => Promise<void>;
    onUnlinkFolder: () => void;
  };
}

/**
 * Orchestrates the benchmark table view, handling difficulty tabs and settings.
 */
export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;

  private readonly _benchmarkService: BenchmarkService;

  private readonly _historyService: HistoryService;

  private readonly _rankService: RankService;

  private readonly _sessionService: SessionService;

  private readonly _directoryService: DirectoryAccessService;

  private readonly _appStateService: AppStateService;

  private readonly _visualSettingsService: VisualSettingsService;

  private readonly _sessionSettingsService: SessionSettingsService;

  private readonly _focusService: FocusManagementService;

  private readonly _settingsController: BenchmarkSettingsController;

  private readonly _folderActions: {
    onLinkFolder: () => Promise<void>;
    onForceScan: () => Promise<void>;
    onUnlinkFolder: () => void;
  };

  private _tableComponent: BenchmarkTableComponent | null = null;

  private _folderSettingsView: FolderSettingsView | null = null;

  private _activeDifficulty: DifficultyTier;

  private _refreshTimeoutId: number | null = null;

  private readonly _handleWindowResize: () => void = (): void => {
    this._refreshIfVisible();
  };

  /**
   * Initializes the view with required dependencies and sub-controllers.
   *
   * @param mountPoint - The DOM element where the view is rendered.
   * @param services - Core application services.
   * @param appStateService - Service for persisting UI state.
   */
  public constructor(
    mountPoint: HTMLElement,
    services: BenchmarkViewServices,
    appStateService: AppStateService,
  ) {
    this._mountPoint = mountPoint;
    this._benchmarkService = services.benchmark;
    this._historyService = services.history;
    this._rankService = services.rank;
    this._sessionService = services.session;
    this._directoryService = services.directory;
    this._folderActions = services.folderActions;
    this._focusService = services.focus;
    this._appStateService = appStateService;
    this._visualSettingsService = new VisualSettingsService();
    this._sessionSettingsService = services.sessionSettings;

    this._activeDifficulty = this._determineInitialDifficulty();
    this._settingsController = this._initSettingsController();

    this._subscribeToServiceUpdates();
  }

  /**
   * Opens the settings menu overlay.
   */
  public openSettings(): void {
    this._settingsController.openSettingsMenu();
  }

  /**
   * Schedules a refresh of the view to reflect external state changes.
   */
  public refresh(): void {
    this._refreshIfVisible();
  }

  /**
   * Toggles the visibility of the advanced folder settings view.
   */
  public toggleFolderView(): void {
    const isCurrentlyOpen: boolean =
      this._appStateService.getIsFolderViewOpen();

    this._appStateService.setIsFolderViewOpen(!isCurrentlyOpen);

    this.render();
  }

  /**
   * Renders the benchmark view content based on current state.
   */
  public async render(): Promise<void> {
    this._cancelPendingRefresh();

    if (document.fonts.status !== "loaded") {
      await document.fonts.ready;
    }

    this._tableComponent?.destroy();
    this._folderSettingsView?.destroy();
    this._mountPoint.innerHTML = "";

    const shouldShowFolder: boolean = await this._shouldShowFolderSettings();
    this._updateHeaderButtonStates(shouldShowFolder);

    if (shouldShowFolder) {
      await this._renderFolderSettings();

      return;
    }

    await this._renderBenchmarkTable();
  }

  /**
   * Cleans up the view, including sub-components and global listeners.
   */
  public destroy(): void {
    this._cancelPendingRefresh();

    this._tableComponent?.destroy();

    this._folderSettingsView?.destroy();

    window.removeEventListener("resize", this._handleWindowResize);
  }

  private _subscribeToServiceUpdates(): void {
    this._visualSettingsService.subscribe((settings: VisualSettings): void => {
      if (
        this._tableComponent &&
        !this._mountPoint.classList.contains("hidden-view")
      ) {
        const requiresFullRender: boolean =
          this._tableComponent.updateVisualSettings(settings);

        if (!requiresFullRender) {
          return;
        }
      }

      this._refreshIfVisible();
    });

    this._sessionSettingsService.subscribe((): void =>
      this._refreshIfVisible(),
    );

    this._subscribeToScoreUpdates();

    this._subscribeToFocusUpdates();

    window.addEventListener("resize", this._handleWindowResize);
  }

  private _subscribeToScoreUpdates(): void {
    this._historyService.onHighscoreUpdated((scenarioName?: string): void => {
      if (scenarioName) {
        this._updateSingleScenario(scenarioName);
      } else {
        this._refreshIfVisible();
      }
    });

    this._historyService.onScoreRecorded((scenarioName: string): void => {
      this._updateSingleScenario(scenarioName);
    });

    this._sessionService.onSessionUpdated((updatedNames?: string[]): void => {
      if (updatedNames) {
        updatedNames.forEach((name: string): void => {
          this._updateSingleScenario(name);
        });
      } else {
        this._refreshIfVisible();
      }
    });
  }

  private _subscribeToFocusUpdates(): void {
    this._focusService.subscribe((state: FocusState): void => {
      const scenarioDifficulty: DifficultyTier | null =
        this._benchmarkService.getDifficulty(state.scenarioName);

      if (scenarioDifficulty && scenarioDifficulty !== this._activeDifficulty) {
        this._handleDifficultyChange(scenarioDifficulty);

        return;
      }

      if (
        this._tableComponent &&
        !this._mountPoint.classList.contains("hidden-view")
      ) {
        this._tableComponent.focusScenario(state.scenarioName);
      }
    });
  }

  private _applyActiveFocus(): void {
    const focusState: FocusState | null = this._focusService.getFocusState();

    if (focusState && this._tableComponent) {
      this._tableComponent.focusScenario(focusState.scenarioName, "auto");

      this._focusService.clearFocus();
    }
  }

  private async _shouldShowFolderSettings(): Promise<boolean> {
    const isFolderLinked: boolean = !!this._directoryService.currentFolderName;
    const isManualOpen: boolean = this._appStateService.getIsFolderViewOpen();

    if (!isFolderLinked || isManualOpen) {
      return true;
    }

    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    return lastCheck === 0;
  }

  private async _renderFolderSettings(): Promise<void> {
    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    const handlers = {
      onLinkFolder: async (): Promise<void> => {
        await this._folderActions.onLinkFolder();
        this._dismissFolderView();
      },
      onForceScan: async (): Promise<void> => {
        await this._folderActions.onForceScan();
        this._dismissFolderView();
      },
      onUnlinkFolder: (): void => {
        this._folderActions.onUnlinkFolder();
        this._dismissFolderView();
      },
    };

    this._folderSettingsView = new FolderSettingsView(
      handlers,
      this._directoryService.originalSelectionName,
      lastCheck > 0,
    );

    this._mountPoint.appendChild(this._folderSettingsView.render());
  }

  private _updateHeaderButtonStates(isFolderActive: boolean): void {
    const folderBtn: HTMLElement | null =
      document.getElementById("header-folder-btn");
    const settingsBtn: HTMLElement | null = document.getElementById(
      "header-settings-btn",
    );

    if (folderBtn) {
      folderBtn.classList.toggle("active", isFolderActive);
    }

    if (settingsBtn) {
      settingsBtn.classList.toggle(
        "active",
        this._appStateService.getIsSettingsMenuOpen(),
      );
    }
  }

  private _dismissFolderView(): void {
    this._appStateService.setIsFolderViewOpen(false);
    this.render();
  }

  private async _renderBenchmarkTable(): Promise<void> {
    const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );
    const highscores: Record<string, number> =
      await this._historyService.getBatchHighscores(
        scenarios.map((scenario: BenchmarkScenario): string => scenario.name),
      );

    this._mountPoint.appendChild(
      this._createViewContainer(scenarios, highscores),
    );

    this._applyActiveFocus();
    this._restoreScrollPosition();
  }

  private _restoreScrollPosition(): void {
    const tableElement: HTMLElement | null =
      this._mountPoint.querySelector(".benchmark-table");

    if (tableElement) {
      tableElement.scrollTop = this._appStateService.getBenchmarkScrollTop();
    }
  }

  private _determineInitialDifficulty(): DifficultyTier {
    const focusState: FocusState | null = this._focusService.getFocusState();
    const focusDifficulty: DifficultyTier | null = focusState
      ? this._benchmarkService.getDifficulty(focusState.scenarioName)
      : null;

    const result: DifficultyTier =
      focusDifficulty ||
      (this._appStateService.getBenchmarkDifficulty() as DifficultyTier);

    if (focusDifficulty) {
      this._appStateService.setBenchmarkDifficulty(focusDifficulty);
    }

    return result;
  }

  private _initSettingsController(): BenchmarkSettingsController {
    return new BenchmarkSettingsController(
      this._visualSettingsService,
      this._sessionSettingsService,
      this._focusService,
      this._benchmarkService,
    );
  }

  private async _updateSingleScenario(scenarioName: string): Promise<void> {
    if (!this._tableComponent) {
      return;
    }

    const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );

    const scenario: BenchmarkScenario | undefined = scenarios.find(
      (benchmarkScenario: BenchmarkScenario): boolean =>
        benchmarkScenario.name === scenarioName,
    );

    if (scenario) {
      const highscore: number =
        await this._historyService.getHighscore(scenarioName);

      this._tableComponent.updateScenarioRow(scenario, highscore);
    }
  }

  private _refreshIfVisible(): void {
    if (this._mountPoint.classList.contains("hidden-view")) {
      return;
    }

    this._cancelPendingRefresh();

    this._refreshTimeoutId = window.setTimeout((): void => {
      this.render();
    }, 50);
  }

  private _cancelPendingRefresh(): void {
    if (this._refreshTimeoutId !== null) {
      window.clearTimeout(this._refreshTimeoutId);
      this._refreshTimeoutId = null;
    }
  }

  private _createViewContainer(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "benchmark-view-container";

    container.appendChild(this._createHeaderControls());

    container.appendChild(this._createTableElement(scenarios, highscores));

    return container;
  }

  private _createHeaderControls(): HTMLElement {
    const header: HTMLDivElement = document.createElement("div");

    header.className = "benchmark-header-controls";

    header.style.justifyContent = "center";

    header.appendChild(this._createDifficultyTabs());

    return header;
  }

  private _createDifficultyTabs(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "difficulty-tabs";

    this._benchmarkService
      .getAvailableDifficulties()
      .forEach((difficulty: DifficultyTier): void => {
        container.appendChild(this._createTab(difficulty));
      });

    return container;
  }

  private _createTab(difficulty: DifficultyTier): HTMLButtonElement {
    const tab: HTMLButtonElement = document.createElement("button");

    const isActive: boolean = this._activeDifficulty === difficulty;

    tab.className = `tab-button ${isActive ? "active" : ""}`;

    tab.textContent = difficulty;

    tab.addEventListener(
      "click",
      (): Promise<void> => this._handleDifficultyChange(difficulty),
    );

    return tab;
  }

  private async _handleDifficultyChange(
    difficulty: DifficultyTier,
  ): Promise<void> {
    this._activeDifficulty = difficulty;

    this._appStateService.setBenchmarkDifficulty(difficulty);

    await this.render();
  }

  private _createTableElement(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    this._tableComponent = new BenchmarkTableComponent({
      historyService: this._historyService,
      rankService: this._rankService,
      sessionService: this._sessionService,
      appStateService: this._appStateService,
      visualSettings: this._visualSettingsService.getSettings(),
      focusService: this._focusService,
    });

    return this._tableComponent.render(scenarios, highscores);
  }
}
