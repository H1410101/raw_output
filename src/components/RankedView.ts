import { RankedSessionService, RankedSessionState } from "../services/RankedSessionService";
import { SessionService, SessionRankRecord } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator, EstimatedRank } from "../services/RankEstimator";
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

    this._container.innerHTML = "";

    const viewContainer: HTMLDivElement = document.createElement("div");
    viewContainer.className = "benchmark-view-container";

    viewContainer.appendChild(this._createHeaderControls());

    const isSessionActive = state.status !== "IDLE";
    this._container.classList.toggle("session-active", isSessionActive);
    document.body.classList.toggle("ranked-mode-active", isSessionActive);

    if (state.status === "IDLE") {
      this._renderIdle(viewContainer);
    } else {
      this._renderActiveState(state, viewContainer);
    }

    this._container.appendChild(viewContainer);
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
      this._evolveRankEstimate(record.scenarioName, record.bestScore);
    }

    this.refresh();
  }

  private _evolveRankEstimate(scenarioName: string, score: number): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);
    const scenario = scenarios.find((scenarioRef) => scenarioRef.name === scenarioName);

    if (scenario) {
      const sessionValue: number = this._deps.estimator.getScenarioContinuousValue(score, scenario);
      this._deps.estimator.evolveScenarioRankEstimate(scenarioName, sessionValue);
    }
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

    const estimate = this._calculateHolisticRankEstimate();
    const isUnranked = estimate.rankName === "Unranked";
    const rankClass = isUnranked ? "rank-name unranked-text" : "rank-name";

    container.innerHTML = `
        <div class="badge-content">
            <span class="${rankClass}">${estimate.rankName}</span>
            <span class="rank-progress">${isUnranked ? "" : `+${estimate.progressToNext}%`}</span>
        </div>
    `;

    return container;
  }

  private _createDifficultyTabs(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "difficulty-tabs";

    const difficulties: string[] = this._deps.benchmark.getAvailableDifficulties();
    const activeDifficulty = this._deps.appState.getBenchmarkDifficulty();
    const isSessionActive = this._deps.rankedSession.state.status !== "IDLE";

    difficulties.forEach((diff: string) => {
      const tab = document.createElement("button");
      tab.className = `tab-button ${activeDifficulty === diff ? "active" : ""}`;
      tab.textContent = diff;

      if (isSessionActive) {
        tab.disabled = true;
        tab.style.opacity = "0.5";
        tab.style.cursor = "not-allowed";
      } else {
        tab.addEventListener("click", () => {
          this._deps.appState.setBenchmarkDifficulty(diff);
          this.refresh();
        });
      }

      container.appendChild(tab);
    });

    return container;
  }

  private _renderIdle(parent: HTMLElement): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const container: HTMLDivElement = document.createElement("div");
    container.className = "ranked-container idle";

    container.innerHTML = this._getIdleHtml();
    parent.appendChild(container);

    const startBtn: HTMLButtonElement | null = container.querySelector("#start-ranked-btn");
    startBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.startSession(difficulty);
    });
  }

  private _getIdleHtml(): string {
    const estimate = this._calculateHolisticRankEstimate();

    return `
      <div class="ranked-info-top">
          <span class="now-playing" style="visibility: hidden;">NOW PLAYING</span>
          <h2 class="ranked-scenario-name" style="visibility: hidden;">Placeholder</h2>
      </div>
      <div class="ranked-main">
          <div class="ranked-target">
              <div class="media-controls">
                  <div class="controls-left" style="visibility: hidden;">
                      <button class="media-btn secondary"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                  </div>
                  <button class="media-btn primary" id="start-ranked-btn" title="Start Run">
                      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="controls-right" style="visibility: hidden;">
                      <button class="media-btn secondary"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
                  </div>
              </div>
          </div>
      </div>
      <div class="ranked-stats-bar" style="visibility: hidden;">
          ${this._renderStatItem("TARGET RANK", estimate.rankName, true)}
      </div>
    `;
  }

  private _renderActiveState(state: RankedSessionState, parent: HTMLElement): void {
    const targetEstimate = this._calculateHolisticRankEstimate();
    const sessionEstimate = this._getSessionEstimate();
    const isImproved = this._checkIfCurrentImproved();

    const container: HTMLDivElement = document.createElement("div");
    container.className = "ranked-container active";

    container.innerHTML = `
      ${this._renderMainContent(state, isImproved)}
      
      <div class="ranked-stats-bar">
          ${this._renderStatItem("TARGET RANK", targetEstimate.rankName, true)}
          ${this._renderStatItem("SESSION RANK", sessionEstimate.rankName, false)}
      </div>
    `;

    parent.appendChild(container);
    this._attachActiveListeners(container);
  }

  private _getSessionEstimate(): EstimatedRank {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scores = this._deps.session.getAllScenarioSessionBests();

    return this._deps.estimator.calculateOverallRank(difficulty, this._convertToScoreMap(scores));
  }

  private _checkIfCurrentImproved(): boolean {
    const current = this._deps.rankedSession.currentScenarioName;
    if (!current) return false;

    const rankEstimate = this._deps.estimator.getScenarioRankEstimate(current);

    return this._isImproved(rankEstimate.continuousValue, current);
  }

  private _isImproved(identityValue: number, currentScenario: string): boolean {
    const bests = this._deps.session.getAllScenarioSessionBests();
    const record = bests.find((recordRef) => recordRef.scenarioName === currentScenario);
    if (!record) return false;

    const diff = this._deps.appState.getBenchmarkDifficulty();
    const scenario = this._deps.benchmark.getScenarios(diff).find((scenarioRef) => scenarioRef.name === currentScenario);
    if (!scenario) return false;

    return this._deps.estimator.getScenarioContinuousValue(record.bestScore, scenario) > identityValue;
  }

  private _renderStatItem(label: string, value: string, highlighted: boolean = false): string {
    return `
      <div class="stat-item ${highlighted ? "highlight" : ""}">
          <span class="label">${label}</span>
          <span class="value">${value}</span>
      </div>
    `;
  }

  private _renderMainContent(state: RankedSessionState, isImproved: boolean): string {
    if (state.status === "COMPLETED") {
      return this._renderCompletedContent();
    }

    return this._renderScenarioContent(state, isImproved);
  }

  private _renderCompletedContent(): string {
    const estimate = this._calculateHolisticRankEstimate();

    return `
      <div class="ranked-result">
          <h2 class="congrats">RUN COMPLETE</h2>
          <p class="summary-rank">RANK ESTIMATE: <span class="accent">${estimate.rankName}</span></p>
          <p>Initial evaluation finished.</p>
      </div>
    `;
  }

  private _renderScenarioContent(state: RankedSessionState, isImproved: boolean): string {
    const scenarioName = state.sequence[state.currentIndex];

    return `
      <div class="ranked-info-top">
          <span class="now-playing">NOW PLAYING</span>
          <h2 class="ranked-scenario-name">${scenarioName}</h2>
      </div>
      
      <div class="ranked-main">
          <div class="ranked-target">
              ${this._renderMediaControls(state, isImproved)}
          </div>
      </div>
    `;
  }

  private _renderMediaControls(state: RankedSessionState, isImproved: boolean): string {
    return `
      <div class="media-controls">
          <div class="controls-left">
              <button class="media-btn secondary" id="ranked-back-btn" title="Previous" ${state.currentIndex === 0 ? "disabled" : ""}>
                  <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
          </div>

          <button class="media-btn primary" id="ranked-play-now" title="Play Now">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>

          <div class="controls-right">
              <button class="media-btn secondary ${isImproved ? "luminous" : "dull"}" id="next-ranked-btn" title="Next">
                  <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
              <button class="media-btn secondary destructive" id="end-ranked-btn">
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
          </div>
      </div>
    `;
  }

  private _attachActiveListeners(container: HTMLElement): void {
    const nextBtn: HTMLButtonElement | null = container.querySelector("#next-ranked-btn");
    nextBtn?.addEventListener("click", () => this._deps.rankedSession.advance());

    const extendBtn: HTMLButtonElement | null = container.querySelector("#extend-ranked-btn");
    extendBtn?.addEventListener("click", () => this._deps.rankedSession.extendSession());

    const endBtn: HTMLButtonElement | null = container.querySelector("#end-ranked-btn");
    endBtn?.addEventListener("click", () => this._deps.rankedSession.endSession());

    const playNowBtn: HTMLButtonElement | null = container.querySelector("#ranked-play-now");
    playNowBtn?.addEventListener("click", () => {
      const scenarioName = this._deps.rankedSession.state.sequence[this._deps.rankedSession.state.currentIndex];
      this._launchScenario(scenarioName);
    });

    const backBtn: HTMLButtonElement | null = container.querySelector("#ranked-back-btn");
    backBtn?.addEventListener("click", () => this._deps.rankedSession.retreat());
  }

  private _convertToScoreMap(bests: SessionRankRecord[]): Map<string, number> {
    const scoreMap: Map<string, number> = new Map();

    bests.forEach((record: SessionRankRecord): void => {
      scoreMap.set(record.scenarioName, record.bestScore);
    });

    return scoreMap;
  }


  private _launchScenario(scenarioName: string): void {
    const encodedName: string = encodeURIComponent(scenarioName);
    const steamUrl: string = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;
    window.location.href = steamUrl;
  }

  private _calculateHolisticRankEstimate(): { rankName: string; color: string; progressToNext: number } {
    const difficulty = this._deps.appState.getBenchmarkDifficulty();
    const rankEstimateMap = this._deps.estimator.getRankEstimateMap();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);

    let totalValue = 0;
    let count = 0;

    scenarios.forEach(scen => {
      const rankEstimate = rankEstimateMap[scen.name];
      if (rankEstimate && rankEstimate.continuousValue !== -1) {
        totalValue += rankEstimate.continuousValue;
        count++;
      }
    });

    const averageValue = count > 0 ? totalValue / count : -1;

    return this._deps.estimator.getEstimateForValue(averageValue, difficulty);
  }
}
