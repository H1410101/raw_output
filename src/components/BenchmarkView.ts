import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";
import { SessionService } from "../services/SessionService";
import { AppStateService } from "../services/AppStateService";
import { VisualSettingsService } from "../services/VisualSettingsService";
import { SessionSettingsService } from "../services/SessionSettingsService";
import {
  FocusManagementService,
  FocusState,
} from "../services/FocusManagementService";
import { BenchmarkTableComponent } from "./benchmark/BenchmarkTableComponent";
import { BenchmarkSettingsController } from "./benchmark/BenchmarkSettingsController";
import { BenchmarkScenario, DifficultyTier } from "../data/benchmarks";

/**
 * Orchestrates the benchmark table view, handling difficulty tabs and settings.
 */
export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;

  private readonly _benchmarkService: BenchmarkService;

  private readonly _historyService: HistoryService;

  private readonly _rankService: RankService;

  private readonly _sessionService: SessionService;

  private readonly _appStateService: AppStateService;

  private readonly _visualSettingsService: VisualSettingsService;

  private readonly _sessionSettingsService: SessionSettingsService;

  private readonly _focusService: FocusManagementService;

  private readonly _settingsController: BenchmarkSettingsController;

  private _tableComponent: BenchmarkTableComponent | null = null;

  private _activeDifficulty: DifficultyTier;

  /**
   * Initializes the view with required dependencies and sub-controllers.
   *
   * @param mountPoint - The DOM element where the view is rendered.
   * @param services - Object containing core application services.
   * @param services.benchmark
   * @param services.history
   * @param services.rank
   * @param services.session
   * @param services.sessionSettings
   * @param services.focus - Service for managing focused scenarios.
   * @param appStateService - Service for persisting UI state.
   */
  public constructor(
    mountPoint: HTMLElement,
    services: {
      benchmark: BenchmarkService;
      history: HistoryService;
      rank: RankService;
      session: SessionService;
      sessionSettings: SessionSettingsService;
      focus: FocusManagementService;
    },
    appStateService: AppStateService,
  ) {
    this._mountPoint = mountPoint;
    this._benchmarkService = services.benchmark;
    this._historyService = services.history;
    this._rankService = services.rank;
    this._sessionService = services.session;
    this._focusService = services.focus;
    this._appStateService = appStateService;
    this._visualSettingsService = new VisualSettingsService();
    this._sessionSettingsService = services.sessionSettings;

    this._activeDifficulty =
      this._appStateService.getBenchmarkDifficulty() as DifficultyTier;

    this._settingsController = new BenchmarkSettingsController(
      this._visualSettingsService,
      this._sessionSettingsService,
    );

    this._subscribeToServiceUpdates();
  }

  /**
   * Renders the benchmark view content based on current state.
   */
  public async render(): Promise<void> {
    const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );

    const highscores: Record<string, number> =
      await this._historyService.getBatchHighscores(
        scenarios.map((scenario: BenchmarkScenario): string => scenario.name),
      );

    this._mountPoint.innerHTML = "";

    this._mountPoint.appendChild(
      this._createViewContainer(scenarios, highscores),
    );

    this._applyActiveFocus();
  }

  private _subscribeToServiceUpdates(): void {
    this._visualSettingsService.subscribe((): void => this._refreshIfVisible());

    this._sessionSettingsService.subscribe((): void =>
      this._refreshIfVisible(),
    );

    this._subscribeToScoreUpdates();

    this._subscribeToFocusUpdates();

    window.addEventListener("resize", (): void => this._refreshIfVisible());
  }

  private _subscribeToScoreUpdates(): void {
    this._historyService.onHighscoreUpdated((scenarioName?: string): void => {
      if (scenarioName) {
        this._updateSingleScenario(scenarioName);
      } else {
        this._refreshIfVisible();
      }
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
      this._tableComponent.focusScenario(focusState.scenarioName);

      this._focusService.clearFocus();
    }
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

    this.render();
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

    header.appendChild(this._createSpacer());

    header.appendChild(this._createDifficultyTabs());

    header.appendChild(this._createRightControlGroup());

    return header;
  }

  private _createSpacer(): HTMLElement {
    const spacer: HTMLDivElement = document.createElement("div");

    spacer.style.flex = "1";

    return spacer;
  }

  private _createRightControlGroup(): HTMLElement {
    const group: HTMLDivElement = document.createElement("div");

    group.style.flex = "1";

    group.style.display = "flex";

    group.style.justifyContent = "flex-end";

    group.appendChild(this._createSettingsButton());

    return group;
  }

  private _createSettingsButton(): HTMLElement {
    const button: HTMLButtonElement = document.createElement("button");

    button.className = "visual-settings-button";

    button.title = "Visual Settings";

    button.innerHTML = this._getSettingsIconSvg();

    button.addEventListener("click", (): void =>
      this._settingsController.openSettingsMenu(),
    );

    return button;
  }

  private _getSettingsIconSvg(): string {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
  }

  private _createDifficultyTabs(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "difficulty-tabs";

    (["easier", "medium", "harder"] as DifficultyTier[]).forEach(
      (difficulty: DifficultyTier): void => {
        container.appendChild(this._createTab(difficulty));
      },
    );

    return container;
  }

  private _createTab(difficulty: DifficultyTier): HTMLButtonElement {
    const tab: HTMLButtonElement = document.createElement("button");

    const isActive: boolean = this._activeDifficulty === difficulty;

    tab.className = `tab-button ${isActive ? "active" : ""}`;

    tab.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

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
      visualSettings: this._visualSettingsService.getSettings(),
      focusService: this._focusService,
    });

    return this._tableComponent.render(scenarios, highscores);
  }
}
