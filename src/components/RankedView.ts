import { RankedSessionService, RankedSessionState } from "../services/RankedSessionService";
import { SessionService, SessionRankRecord } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator } from "../services/RankEstimator";
import { AppStateService } from "../services/AppStateService";

export interface RankedViewDependencies {
  readonly rankedSession: RankedSessionService;
  readonly session: SessionService;
  readonly benchmark: BenchmarkService;
  readonly estimator: RankEstimator;
  readonly appState: AppStateService;
}

/**
 * Component responsible for managing the Ranked mode interface.
 */
export class RankedView {
  private readonly _container: HTMLElement;
  private readonly _deps: RankedViewDependencies;

  /**
   * Initializes the view with its mount point.
   *
   * @param container - The DOM element where this view is rendered.
   * @param deps - Service dependencies.
   */
  public constructor(container: HTMLElement, deps: RankedViewDependencies) {
    this._container = container;
    this._deps = deps;

    this._setupListeners();
  }

  /**
   * Renders the current state of the Ranked view.
   */
  public async render(): Promise<void> {
    const state: RankedSessionState = this._deps.rankedSession.state;

    if (state.status === "IDLE") {
      this._renderIdle();
    } else {
      this._renderActiveState(state);
    }
  }

  /**
   * Refreshes the view data.
   */
  public refresh(): void {
    this.render();
  }

  private _setupListeners(): void {
    this._deps.rankedSession.onStateChanged((): void => {
      this.refresh();
    });

    this._deps.session.onSessionUpdated((): void => {
      this._handleSessionUpdate();
    });
  }

  private _handleSessionUpdate(): void {
    const state: RankedSessionState = this._deps.rankedSession.state;
    if (state.status !== "ACTIVE") {
      this.refresh();

      return;
    }

    const current: string | null = this._deps.rankedSession.currentScenarioName;
    if (!current) {
      this.refresh();

      return;
    }

    const bests: SessionRankRecord[] = this._deps.session.getAllScenarioSessionBests();
    const record: SessionRankRecord | undefined = bests.find(
      (record: SessionRankRecord): boolean => record.scenarioName === current
    );

    if (record) {
      this._evolveIdentity(record.scenarioName, record.bestScore);
    }

    this.refresh();
  }

  private _evolveIdentity(scenarioName: string, score: number): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);
    const scenario = scenarios.find((scenario) => scenario.name === scenarioName);

    if (scenario) {
      const sessionValue: number = this._deps.estimator.getScenarioContinuousValue(score, scenario);
      this._deps.estimator.evolveScenarioIdentity(scenarioName, sessionValue);
    }
  }

  private _renderIdle(): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();

    this._container.innerHTML = `
            <div class="ranked-container idle">
                <div class="ranked-header">
                    <h2>Ranked Session</h2>
                    <div class="difficulty-tabs-container"></div>
                    <p class="subtitle">Directed evaluation for <span class="accent-text">${difficulty}</span></p>
                </div>
                <div class="ranked-body">
                    <div class="ranked-info-card">
                        <h3>Guided Progression</h3>
                        <p>Play 3 scenarios to refine your rank identity.</p>
                        <p class="minor">Sequence is unique to this run.</p>
                    </div>
                </div>
                <div class="ranked-footer">
                    <button id="start-ranked-btn" class="action-btn-large">START RANKED RUN</button>
                </div>
            </div>
        `;

    const tabsContainer = this._container.querySelector(".difficulty-tabs-container");
    if (tabsContainer) {
      tabsContainer.appendChild(this._renderDifficultyTabs());
    }

    const startBtn: HTMLButtonElement | null = this._container.querySelector("#start-ranked-btn");
    startBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.startSession(difficulty);
    });
  }

  private _renderDifficultyTabs(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "difficulty-tabs";
    container.style.marginBottom = "1.5rem";

    const difficulties: string[] = this._deps.benchmark.getAvailableDifficulties();
    const activeDifficulty = this._deps.appState.getBenchmarkDifficulty();

    difficulties.forEach((diff: string) => {
      const tab = document.createElement("button");
      tab.className = `tab-button ${activeDifficulty === diff ? "active" : ""}`;
      tab.textContent = diff;
      tab.addEventListener("click", () => {
        this._deps.appState.setBenchmarkDifficulty(diff);
        this.refresh();
      });
      container.appendChild(tab);
    });

    return container;
  }

  private _renderActiveState(state: RankedSessionState): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const currentScenario = this._deps.rankedSession.currentScenarioName;

    let scenarioEstimate = "Unranked";
    let isImproved = false;

    if (currentScenario) {
      const identity = this._deps.estimator.getScenarioIdentity(currentScenario);
      scenarioEstimate = this._deps.estimator.getEstimateForValue(identity.continuousValue, difficulty).rankName;
      isImproved = this._isImprovementDetected(identity.continuousValue, currentScenario);
    }

    this._container.innerHTML = `
            <div class="ranked-container active">
                <div class="ranked-stats-bar">
                    ${this._renderStatItem("PROGRESS", `${state.currentIndex + 1} of ${state.sequence.length}`)}
                    ${this._renderStatItem("TARGET RANK", scenarioEstimate, true)}
                </div>
                <div class="ranked-main">
                    ${this._renderMainContent(state)}
                    ${this._renderNavigation(state, isImproved)}
                </div>
                <div class="ranked-footer">
                    <button id="end-ranked-btn" class="secondary-btn">END RUN</button>
                    <button id="reset-ranked-btn" class="secondary-btn">RESET RUN</button>
                </div>
            </div>
        `;

    this._attachActiveListeners();
  }

  private _isImprovementDetected(identityValue: number, currentScenario: string): boolean {
    const bests = this._deps.session.getAllScenarioSessionBests();
    const record = bests.find((record) => record.scenarioName === currentScenario);
    if (!record) return false;

    const difficulty = this._deps.appState.getBenchmarkDifficulty();
    const scenario = this._deps.benchmark.getScenarios(difficulty).find((scenario) => scenario.name === currentScenario);
    if (!scenario) return false;

    const sessionValue = this._deps.estimator.getScenarioContinuousValue(record.bestScore, scenario);

    return sessionValue > identityValue;
  }

  private _renderStatItem(label: string, value: string, highlighted: boolean = false): string {
    return `
            <div class="stat-item ${highlighted ? "highlight" : ""}">
                <span class="label">${label}</span>
                <span class="value">${value}</span>
            </div>
        `;
  }

  private _renderMainContent(state: RankedSessionState): string {
    if (state.status === "COMPLETED") {
      const difficulty = this._deps.appState.getBenchmarkDifficulty();
      const sessionScores = this._convertToScoreMap(this._deps.session.getAllScenarioSessionBests());
      const overall = this._deps.estimator.calculateOverallRank(difficulty, sessionScores);

      return `
                <div class="ranked-result">
                    <h2 class="congrats">RUN COMPLETE</h2>
                    <p class="summary-rank">OVERALL EST. RANK: <span class="accent">${overall.rankName}</span></p>
                    <p>Initial evaluation finished.</p>
                    <button id="extend-ranked-btn" class="bonus-btn">+ CONTINUE UNINTERRUPTED</button>
                </div>
            `;
    }

    const scenarioName = state.sequence[state.currentIndex];

    return `
            <div class="ranked-target">
                <span class="now-playing">NOW PLAYING</span>
                <h2 class="ranked-scenario-name">${scenarioName}</h2>
                <p class="instruction">Hit your target rank to light up the path.</p>
            </div>
        `;
  }

  private _renderNavigation(state: RankedSessionState, isImproved: boolean): string {
    if (state.status === "COMPLETED") return "";

    const btnClass = isImproved ? "luminous" : "dull";

    return `
                <div class="ranked-actions">
                    <button id="next-ranked-btn" class="next-btn ${btnClass}">NEXT SCENARIO</button>
                </div>
            `;
  }

  private _attachActiveListeners(): void {
    const resetBtn: HTMLButtonElement | null = this._container.querySelector("#reset-ranked-btn");
    resetBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.reset();
    });

    const nextBtn: HTMLButtonElement | null = this._container.querySelector("#next-ranked-btn");
    nextBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.advance();
    });

    const extendBtn: HTMLButtonElement | null = this._container.querySelector("#extend-ranked-btn");
    extendBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.extendSession();
    });

    const endBtn: HTMLButtonElement | null = this._container.querySelector("#end-ranked-btn");
    endBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.endSession();
    });
  }

  /**
   * Converts the list of session bests into a map for the estimator.
   *
   * @param bests - The list of session rank records.
   * @returns A map of scenario names to their best scores.
   */
  private _convertToScoreMap(bests: SessionRankRecord[]): Map<string, number> {
    const scoreMap: Map<string, number> = new Map();

    bests.forEach((record: SessionRankRecord): void => {
      scoreMap.set(record.scenarioName, record.bestScore);
    });

    return scoreMap;
  }
}
