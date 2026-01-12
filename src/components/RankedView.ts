import { RankedSessionService, RankedSessionState } from "../services/RankedSessionService";
import { SessionService, SessionRankRecord } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator } from "../services/RankEstimator";
import { AppStateService } from "../services/AppStateService";
import { HUDTimer } from "./ui/HUDTimer";
import { HUDProgressBar } from "./ui/HUDProgressBar";

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
  private readonly _timer: HUDTimer;
  private readonly _progressBar: HUDProgressBar;

  /**
   * Initializes the view with its mount point.
   *
   * @param container - The DOM element where this view is rendered.
   * @param deps - Service dependencies.
   */
  public constructor(container: HTMLElement, deps: RankedViewDependencies) {
    this._container = container;
    this._deps = deps;
    this._timer = new HUDTimer();
    this._progressBar = new HUDProgressBar();

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
      this._timer.stop();
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

    const estimate = this._calculateHolisticIdentityRank();

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

    container.innerHTML = `
                <div class="ranked-header">
                    <h2>Ranked Session</h2>
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
        `;

    parent.appendChild(container);

    const startBtn: HTMLButtonElement | null = container.querySelector("#start-ranked-btn");
    startBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.startSession(difficulty);
    });
  }

  private _renderActiveState(state: RankedSessionState, parent: HTMLElement): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const currentScenario = this._deps.rankedSession.currentScenarioName;

    let scenarioEstimate = "Unranked";
    let isImproved = false;

    if (currentScenario) {
      const identity = this._deps.estimator.getScenarioIdentity(currentScenario);
      scenarioEstimate = this._deps.estimator.getEstimateForValue(identity.continuousValue, difficulty).rankName;
      isImproved = this._isImprovementDetected(identity.continuousValue, currentScenario);
    }

    const container: HTMLDivElement = document.createElement("div");
    container.className = "ranked-container active";

    container.innerHTML = `
                <div class="ranked-stats-bar" id="hud-mount-point">
                    <!-- HUD Elements will be injected here -->
                    ${this._renderStatItem("TARGET RANK", scenarioEstimate, true)}
                </div>
                <div class="ranked-main">
                    ${this._renderMainContent(state, isImproved)}
                    ${this._renderNavigation(state, isImproved)}
                </div>
                <div class="ranked-footer">
                    <button id="end-ranked-btn" class="secondary-btn">END RUN</button>
                    <button id="reset-ranked-btn" class="secondary-btn">RESET RUN</button>
                </div>
        `;

    const hudMount = container.querySelector("#hud-mount-point");
    if (hudMount) {
      hudMount.prepend(this._timer.element);
      hudMount.insertBefore(this._progressBar.element, hudMount.children[1]);

      this._timer.start(state.startTime!);
      this._progressBar.update(state.currentIndex, state.sequence.length, !state.initialGauntletComplete);
    }

    parent.appendChild(container);

    this._attachActiveListeners(container);
  }

  private _isImproved(identityValue: number, currentScenario: string): boolean {
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

  private _renderMainContent(state: RankedSessionState, isImproved: boolean): string {
    if (state.status === "COMPLETED") {
      const estimate = this._calculateHolisticIdentityRank();

      return `
                <div class="ranked-result">
                    <h2 class="congrats">RUN COMPLETE</h2>
                    <p class="summary-rank">IDENTITY RANK: <span class="accent">${estimate.rankName}</span></p>
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
                
                <div class="media-controls">
                    <button class="media-btn secondary" id="ranked-back-btn" title="Previous Scenario" ${state.currentIndex === 0 ? "disabled" : ""}>
                        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button class="media-btn primary" id="ranked-play-now" title="Play Now">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="media-btn secondary ${isImproved ? "luminous" : ""}" id="next-ranked-btn" title="Next Scenario">
                        <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                </div>
            </div>
        `;
  }

  private _renderNavigation(state: RankedSessionState, isImproved: boolean): string {
    return ""; // Navigation consolidated into media-controls in main content
  }

  private _attachActiveListeners(container: HTMLElement): void {
    const resetBtn: HTMLButtonElement | null = container.querySelector("#reset-ranked-btn");
    resetBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.reset();
    });

    const nextBtn: HTMLButtonElement | null = container.querySelector("#next-ranked-btn");
    nextBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.advance();
    });

    const extendBtn: HTMLButtonElement | null = container.querySelector("#extend-ranked-btn");
    extendBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.extendSession();
    });

    const endBtn: HTMLButtonElement | null = container.querySelector("#end-ranked-btn");
    endBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.endSession();
    });

    const playNowBtn: HTMLButtonElement | null = container.querySelector("#ranked-play-now");
    playNowBtn?.addEventListener("click", (): void => {
      const state = this._deps.rankedSession.state;
      const scenarioName = state.sequence[state.currentIndex];
      this._launchScenario(scenarioName);
    });

    const backBtn: HTMLButtonElement | null = container.querySelector("#ranked-back-btn");
    backBtn?.addEventListener("click", (): void => {
      this._deps.rankedSession.retreat();
    });
  }

  private _convertToScoreMap(bests: SessionRankRecord[]): Map<string, number> {
    const scoreMap: Map<string, number> = new Map();

    bests.forEach((record: SessionRankRecord): void => {
      scoreMap.set(record.scenarioName, record.bestScore);
    });

    return scoreMap;
  }

  private _isImprovementDetected(identityValue: number, currentScenario: string): boolean {
    return this._isImproved(identityValue, currentScenario);
  }

  private _launchScenario(scenarioName: string): void {
    const encodedName: string = encodeURIComponent(scenarioName);
    const steamUrl: string = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;
    window.location.href = steamUrl;
  }

  private _calculateHolisticIdentityRank(): { rankName: string; color: string; progressToNext: number } {
    const difficulty = this._deps.appState.getBenchmarkDifficulty();
    const identities = this._deps.estimator.getIdentityMap();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);

    let totalValue = 0;
    let count = 0;

    scenarios.forEach(s => {
      const identity = identities[s.name];
      if (identity && identity.continuousValue !== -1) {
        totalValue += identity.continuousValue;
        count++;
      }
    });

    const averageValue = count > 0 ? totalValue / count : -1;
    return this._deps.estimator.getEstimateForValue(averageValue, difficulty);
  }
}
