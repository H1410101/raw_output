import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";
import { SessionService } from "../services/SessionService";
import { AppStateService } from "../services/AppStateService";
import { RankEstimator } from "../services/RankEstimator";
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
import { FolderSettingsView, FolderActionHandlers } from "./ui/FolderSettingsView";
import { RankPopupComponent } from "./ui/RankPopupComponent";
import { PeakWarningPopupComponent } from "./ui/PeakWarningPopupComponent";

import { DirectoryAccessService } from "../services/DirectoryAccessService";
import { BenchmarkScenario, DifficultyTier } from "../data/benchmarks";
import { AudioService } from "../services/AudioService";
import { CloudflareService } from "../services/CloudflareService";
import { IdentityService } from "../services/IdentityService";
import { CosmeticOverrideService } from "../services/CosmeticOverrideService";

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
  visualSettings: VisualSettingsService;
  audio: AudioService;
  cloudflare: CloudflareService;
  identity: IdentityService;
  folderActions: {
    onLinkFolder: () => Promise<void>;
    onForceScan: () => Promise<void>;
    onUnlinkFolder: () => void;
  };
  rankEstimator: RankEstimator;
  cosmeticOverride: CosmeticOverrideService;
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
  private readonly _audioService: AudioService;
  private readonly _cloudflareService: CloudflareService;
  private readonly _identityService: IdentityService;
  private readonly _rankEstimator: RankEstimator;
  private readonly _cosmeticOverrideService: CosmeticOverrideService;

  private readonly _settingsController: BenchmarkSettingsController;

  private readonly _folderActions: {
    onLinkFolder: () => Promise<void>;
    onForceScan: () => Promise<void>;
    onUnlinkFolder: () => void;
  };

  private _tableComponent: BenchmarkTableComponent | null = null;

  private _folderSettingsView: FolderSettingsView | null = null;

  private _activeDifficulty: DifficultyTier;

  private _isRendering: boolean = false;

  private _refreshTimeoutId: number | null = null;

  private _isInitialRender: boolean = true;

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
    this._visualSettingsService = services.visualSettings;
    this._audioService = services.audio;
    this._sessionSettingsService = services.sessionSettings;
    this._cloudflareService = services.cloudflare;
    this._identityService = services.identity;
    this._rankEstimator = services.rankEstimator;
    this._cosmeticOverrideService = services.cosmeticOverride;

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
   * Updates the active difficulty of the view.
   *
   * @param difficulty - The new difficulty tier.
   */
  public updateDifficulty(difficulty: DifficultyTier): void {
    if (this._activeDifficulty === difficulty) {
      return;
    }

    this._activeDifficulty = difficulty;
    this.refresh();
  }

  /**
   * Toggles the application between dark and light themes.
   */
  public toggleTheme(): void {
    const currentTheme: "dark" | "light" =
      this._visualSettingsService.getSettings().theme;

    const targetTheme: "dark" | "light" =
      currentTheme === "dark" ? "light" : "dark";

    this._visualSettingsService.updateSetting("theme", targetTheme);
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
   * Attempts to return to the benchmark table view from the folder settings view.
   * This succeeds only if a folder is already linked and statistics have been found.
   *
   * @returns A promise that resolves to true if the folder view was dismissed.
   */
  public async tryReturnToTable(): Promise<boolean> {
    if (!this._appStateService.getIsFolderViewOpen()) {
      return false;
    }

    const isStatsFolder: boolean = this._directoryService.isStatsFolderSelected();
    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    if (isStatsFolder && lastCheck > 0) {
      await this._dismissFolderView();

      return true;
    }

    return false;
  }

  /**
   * Renders the benchmark view content based on current state.
   */
  public async render(): Promise<void> {
    if (this._isRendering) {
      return;
    }

    this._isRendering = true;

    try {
      this._cancelPendingRefresh();
      if (document.fonts.status !== "loaded") {
        await document.fonts.ready;
      }
      const shouldShowFolder: boolean = await this._shouldShowFolderSettings();

      if (shouldShowFolder) {
        await this._renderFolderView();
      } else {
        await this._renderScenariosView();
      }
    } finally {
      this._isRendering = false;
    }
  }

  private async _renderFolderView(): Promise<void> {
    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    this._clearAndPrepareMount();
    this._updateHeaderButtonStates(true);
    this._renderFolderSettings(lastCheck);
    this._showView();
  }

  private async _renderScenariosView(): Promise<void> {
    const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );

    const highscores: Record<string, number> =
      await this._historyService.getBatchHighscores(
        scenarios.map((scenario: BenchmarkScenario): string => scenario.name),
      );

    this._clearAndPrepareMount();
    this._updateHeaderButtonStates(false);
    this._renderBenchmarkTable(scenarios, highscores);
    this._showView();
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

  private _showView(): void {
    if (this._isInitialRender && this._mountPoint.parentElement) {
      this._mountPoint.parentElement.style.opacity = "1";
      this._isInitialRender = false;
    }
  }

  private _clearAndPrepareMount(): void {
    this._tableComponent?.destroy();
    this._folderSettingsView?.destroy();
    this._mountPoint.innerHTML = "";
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

    this._rankEstimator.onEstimateUpdated((scenarioName: string): void => {
      this._updateSingleScenario(scenarioName);
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

  private _applyActiveFocus(): boolean {
    const focusState: FocusState | null = this._focusService.getFocusState();

    if (focusState && this._tableComponent) {
      this._tableComponent.focusScenario(focusState.scenarioName, "smooth");

      this._focusService.clearFocus();

      return true;
    }

    return false;
  }

  private async _shouldShowFolderSettings(): Promise<boolean> {
    const isStatsFolder: boolean = this._directoryService.isStatsFolderSelected();
    const isManualOpen: boolean = this._appStateService.getIsFolderViewOpen();

    if (!isStatsFolder || isManualOpen) {
      return true;
    }

    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    return lastCheck === 0;
  }

  private _renderFolderSettings(lastCheck: number): void {
    const handlers = this._createFolderViewHandlers();

    const isInvalid = !!this._directoryService.originalSelectionName && !this._directoryService.isStatsFolderSelected();
    const isValid = this._directoryService.isStatsFolderSelected();

    this._folderSettingsView = new FolderSettingsView({
      handlers,
      currentFolderName: this._directoryService.originalSelectionName,
      hasStats: lastCheck > 0,
      isInvalid,
      isValid,
    });

    this._mountPoint.appendChild(this._folderSettingsView.render());
  }

  private _createFolderViewHandlers(): FolderActionHandlers {
    return {
      onLinkFolder: async (): Promise<void> => {
        await this._folderActions.onLinkFolder();
        await this._dismissFolderView();
      },
      onForceScan: async (): Promise<void> => {
        await this._folderActions.onForceScan();
        await this._dismissFolderView();
      },
      onUnlinkFolder: async (): Promise<void> => {
        this._folderActions.onUnlinkFolder();
        await this._dismissFolderView();
      },
    };
  }

  private _updateHeaderButtonStates(isFolderActive: boolean): void {
    const folderBtn: HTMLElement | null =
      document.getElementById("header-folder-btn");
    const settingsBtn: HTMLElement | null = document.getElementById(
      "header-settings-btn",
    );
    const benchmarkNavBtn: HTMLElement | null =
      document.getElementById("nav-benchmarks");

    if (folderBtn) {
      folderBtn.classList.toggle("active", isFolderActive);
    }

    if (settingsBtn) {
      settingsBtn.classList.toggle(
        "active",
        this._appStateService.getIsSettingsMenuOpen(),
      );
    }

    if (benchmarkNavBtn) {
      benchmarkNavBtn.classList.toggle("active", !isFolderActive);
    }
  }

  private async _dismissFolderView(): Promise<void> {
    this._appStateService.setIsFolderViewOpen(false);
    await this.render();
  }

  private _renderBenchmarkTable(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    this._mountPoint.appendChild(
      this._createViewContainer(scenarios, highscores),
    );

    this._restoreScrollPosition();
    this._applyActiveFocus();
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
    return new BenchmarkSettingsController({
      visualSettingsService: this._visualSettingsService,
      sessionSettingsService: this._sessionSettingsService,
      focusService: this._focusService,
      benchmarkService: this._benchmarkService,
      audioService: this._audioService,
      cloudflareService: this._cloudflareService,
      identityService: this._identityService,
      rankEstimator: this._rankEstimator,
      cosmeticOverride: this._cosmeticOverrideService,
    });
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

    const aligner: HTMLDivElement = document.createElement("div");
    aligner.className = "header-aligner";

    aligner.appendChild(this._createDifficultyTabs());
    aligner.appendChild(this._createHolisticRankUI());

    header.appendChild(aligner);

    return header;
  }

  private _createHolisticRankUI(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "holistic-rank-container";

    const difficulty = this._activeDifficulty;
    const estimate = this._cosmeticOverrideService.isActiveFor(difficulty)
      ? this._cosmeticOverrideService.getFakeEstimatedRank(difficulty)
      : this._rankEstimator.calculateHolisticEstimateRank(difficulty);

    const isUnranked = estimate.rankName === "Unranked";
    const rankClass = isUnranked ? "rank-name unranked-text" : "rank-name";

    const isPeak = this._benchmarkService.isPeak(difficulty);
    const peakIcon = this._getPeakIconHtml(isPeak);

    container.innerHTML = `
        <div class="badge-content">
            <span class="${rankClass}" style="display: inline-flex; justify-content: flex-end; align-items: center; gap: 0.5rem;">
                ${peakIcon}
                <span class="rank-text-inner">${estimate.rankName}</span>
            </span>
            <span class="rank-progress">${estimate.continuousValue === 0 ? "" : `+${estimate.progressToNext}%`}</span>
        </div>
    `;

    this._attachHolisticRankListeners(container, estimate.rankName);

    return container;
  }

  private _attachHolisticRankListeners(container: HTMLElement, currentRankName: string): void {
    const rankInner = container.querySelector(".rank-text-inner") as HTMLElement;
    if (rankInner) {
      rankInner.style.cursor = "pointer";
      rankInner.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        const rankNames = this._benchmarkService.getRankNames(this._activeDifficulty);
        const popup = new RankPopupComponent(rankInner, currentRankName, rankNames);
        popup.render();
      });
    }

    const peakWarningIcon = container.querySelector(".peak-warning-icon") as HTMLElement;
    if (peakWarningIcon) {
      peakWarningIcon.style.cursor = "pointer";
      peakWarningIcon.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        const popup = new PeakWarningPopupComponent(this._audioService, this._cosmeticOverrideService);
        popup.subscribeToClose(() => {
          this._audioService.playHeavy(0.4);
        });
        popup.render();
      });
    }
  }

  private _getPeakIconHtml(isPeak: boolean): string {
    if (!isPeak) {
      return "";
    }

    return `
      <span class="peak-warning-icon" style="display: flex; align-items: center; color: var(--lower-band-3);">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
           <line x1="12" y1="9" x2="12" y2="13"></line>
           <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </span>`;
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

    const label: HTMLSpanElement = document.createElement("span");
    label.textContent = difficulty;
    tab.appendChild(label);



    tab.addEventListener("click", (): void => {
      if (!isActive) {
        this._handleDifficultyChange(difficulty);
      }
    });

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
      audioService: this._audioService,
      focusService: this._focusService,
      rankEstimator: this._rankEstimator,
      cosmeticOverride: this._cosmeticOverrideService,
    });

    return this._tableComponent.render(scenarios, highscores, this._activeDifficulty);
  }
}
