import { RankedSessionService, RankedSessionState } from "../services/RankedSessionService";
import { SessionService } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator, EstimatedRank, ScenarioEstimate } from "../services/RankEstimator";
import { BenchmarkScenario } from "../data/benchmarks";

import { AppStateService } from "../services/AppStateService";
import { HistoryService } from "../services/HistoryService";
import { VisualSettingsService } from "../services/VisualSettingsService";
import { AudioService } from "../services/AudioService";
import { RankTimelineComponent } from "./visualizations/RankTimelineComponent";
import { SummaryTimelineComponent } from "./visualizations/SummaryTimelineComponent";
import { FolderSettingsView, FolderActionHandlers } from "./ui/FolderSettingsView";
import { DirectoryAccessService } from "../services/DirectoryAccessService";
import { RankedHelpPopupComponent } from "./ui/RankedHelpPopupComponent";
import { RankPopupComponent } from "./ui/RankPopupComponent";
import { SessionSettingsService } from "../services/SessionSettingsService";

export interface RankedViewDependencies {
  readonly rankedSession: RankedSessionService;
  readonly session: SessionService;
  readonly benchmark: BenchmarkService;
  readonly estimator: RankEstimator;
  readonly appState: AppStateService;
  readonly history: HistoryService;
  readonly visualSettings: VisualSettingsService;
  readonly sessionSettings: SessionSettingsService;
  readonly audio: AudioService;
  readonly directory: DirectoryAccessService;
  readonly folderActions: {
    readonly onLinkFolder: () => Promise<void>;
    readonly onForceScan: () => Promise<void>;
    readonly onUnlinkFolder: () => void;
  };
}

/**
 * Component responsible for managing the Ranked mode interface.
 */
export class RankedView {
  private readonly _container: HTMLElement;
  private readonly _deps: RankedViewDependencies;
  private _folderSettingsView: FolderSettingsView | null = null;
  private _hudInterval: number | null = null;

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
   * Toggles the visibility of the advanced folder settings view.
   */
  public toggleFolderView(): void {
    const isCurrentlyOpen: boolean =
      this._deps.appState.getIsFolderViewOpen();

    this._deps.appState.setIsFolderViewOpen(!isCurrentlyOpen);

    this.render();
  }

  /**
   * Attempts to return to the ranked interface from the folder settings view.
   * This succeeds only if a folder is already linked and statistics have been found.
   *
   * @returns A promise that resolves to true if the folder view was dismissed.
   */
  public async tryReturnToTable(): Promise<boolean> {
    if (!this._deps.appState.getIsFolderViewOpen()) {
      return false;
    }

    const isStatsFolder: boolean = this._deps.directory.isStatsFolderSelected();
    const lastCheck: number =
      await this._deps.history.getLastCheckTimestamp();

    if (isStatsFolder && lastCheck > 0) {
      await this._dismissFolderView();

      return true;
    }

    return false;
  }

  /**
   * Renders the current state of the Ranked view.
   */
  public async render(): Promise<void> {
    // Check if we should show the folder settings view instead of the ranked view
    if (await this._shouldShowFolderSettings()) {
      await this._renderFolderView();

      return;
    }

    const state: RankedSessionState = this._deps.rankedSession.state;

    this._stopHudTicking();
    this._container.innerHTML = "";

    const viewContainer: HTMLDivElement = document.createElement("div");
    viewContainer.className = "benchmark-view-container";

    viewContainer.appendChild(this._createHeaderControls());
    this._updateHeaderButtonStates(false);

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

    this._deps.sessionSettings.subscribe((): void => {
      this.refresh();
    });
  }

  private _handleSessionUpdate(): void {
    // We simply refresh the view when the session updates.
    // Rank evolution is now deferred to RankedSessionService.endSession().
    this.refresh();
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
    const estimate = this._calculateHolisticEstimateRank();
    const isUnranked = estimate.rankName === "Unranked";
    const rankClass = isUnranked ? "rank-name unranked-text" : "rank-name";

    container.innerHTML = `
        <div class="badge-content">
            <span class="${rankClass}">
                <span class="rank-text-inner">${estimate.rankName}</span>
            </span>
            <span class="rank-progress">${estimate.continuousValue === 0 ? "" : `+${estimate.progressToNext}%`}</span>
        </div>
    `;

    const rankInner = container.querySelector(".rank-text-inner") as HTMLElement;
    if (rankInner) {
      rankInner.style.cursor = "pointer";
      rankInner.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        const difficulty = this._deps.appState.getBenchmarkDifficulty();
        const rankNames = this._deps.benchmark.getRankNames(difficulty);
        const popup = new RankPopupComponent(rankInner, estimate.rankName, rankNames);
        popup.render();
      });
    }

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
    return `
      <div class="ranked-info-top">
          <span class="now-playing" style="visibility: hidden;">NOW PLAYING</span>
          <h2 class="ranked-scenario-name" style="visibility: hidden;">Placeholder</h2>
      </div>
      <div class="dot-cloud-container ranked-dot-cloud" style="visibility: hidden;"></div>
      <div class="media-controls">
          <div class="hud-group left" style="visibility: hidden;"></div>
          <div class="controls-left" style="visibility: hidden;">
              <button class="media-btn secondary"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
          </div>
          <button class="media-btn primary" id="start-ranked-btn">
              <svg viewBox="0 0 24 24">
                  <g transform="matrix(0.6 0 0 0.6 4.8 4.8)">
                      <path d="M8 5v14l11-7z"/>
                  </g>
              </svg>
          </button>
          <div class="controls-right" style="visibility: hidden;">
              <button class="media-btn secondary"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
          </div>
          <div class="hud-group right" style="visibility: hidden;"></div>
      </div>
    `;
  }

  private _renderActiveState(state: RankedSessionState, parent: HTMLElement): void {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "ranked-container active";

    container.innerHTML = this._renderMainContent(state);

    parent.appendChild(container);

    if (state.status === "ACTIVE") {
      this._startHudTicking();
    }

    this._attachActiveListeners(container);
  }

  private _startHudTicking(): void {
    this._updateHudStats();
    this._hudInterval = window.setInterval(() => this._updateHudStats(), 1000);
  }

  private _stopHudTicking(): void {
    if (this._hudInterval !== null) {
      window.clearInterval(this._hudInterval);
      this._hudInterval = null;
    }
  }


  private _updateHudStats(): void {
    const scenarioStats = document.getElementById("hud-scenario-stats");
    const sessionStats = document.getElementById("hud-session-stats");

    if (!scenarioStats || !sessionStats) {
      return;
    }

    const state = this._deps.rankedSession.state;
    const currentScenario = state.sequence[state.currentIndex];
    const allRuns = this._deps.session.getAllRankedSessionRuns();

    // Scenario Stats: Time | Attempts
    const scenarioTime: number = this._deps.rankedSession.scenarioElapsedSeconds;
    const scenarioAttempts: number = allRuns.filter(run => run.scenarioName === currentScenario).length;

    scenarioStats.textContent = `${this._formatHudTime(scenarioTime)} | ${scenarioAttempts}`;

    // Session Stats: Attempts | Time
    const sessionStartTime: number | null = this._deps.session.rankedStartTime;
    const sessionTime: number = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
    const sessionAttempts: number = allRuns.length;

    sessionStats.textContent = `${sessionAttempts} | ${this._formatHudTime(sessionTime)}`;
  }

  private _formatHudTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }


  private _renderMainContent(state: RankedSessionState): string {
    if (state.status === "COMPLETED") {
      return this._renderCompletedContent();
    }

    if (state.status === "SUMMARY") {
      return this._renderSummaryContent();
    }

    return this._renderScenarioContent(state);
  }

  private _renderSummaryContent(): string {
    const summaryData = this._calculateSummaryData();

    return `
      <div class="ranked-info-top">
          <span class="now-playing">SUMMARY</span>
      </div>
      <div class="summary-content-wrapper">
          <div class="scenarios-list summary-scrollable">
              ${summaryData.length > 0 ? summaryData.map(data => `
                  <div class="scenario-summary-item summary-timeline-item">
                    ${this._renderSummaryTimeline(data)}
                  </div>
              `).join('') : '<p class="no-scenarios">No rank gains this session.</p>'}
          </div>
      </div>
      <div class="media-controls">
          <div class="hud-group left"></div>
          <div class="controls-left"></div>
          <div class="difficulty-tabs">
              <button class="tab-button active" id="finish-ranked-btn">Back to hub</button>
          </div>
          <div class="controls-right"></div>
          <div class="hud-group right"></div>
      </div>
    `;
  }

  private _calculateSummaryData(): { name: string; oldRU: number; newRU: number; gain: number }[] {
    const state = this._deps.rankedSession.state;
    const initialEstimates = state.initialEstimates;
    const results: { name: string; oldRU: number; newRU: number; gain: number }[] = [];

    for (const scenarioName of state.playedScenarios) {
      const oldRU = initialEstimates[scenarioName] ?? 0;
      const currentEstimate = this._deps.estimator.getScenarioEstimate(scenarioName);
      const newRU = currentEstimate.continuousValue;

      if (newRU > oldRU + 0.001) {
        results.push({
          name: scenarioName,
          oldRU,
          newRU,
          gain: Math.round((newRU - oldRU) * 100)
        });
      }
    }

    return results.sort((a, b) => b.gain - a.gain);
  }

  private _renderSummaryTimeline(data: { name: string; oldRU: number; newRU: number; gain: number }): string {
    const containerId: string = `rank-timeline-summary-${data.name.replace(/\s+/g, "-")}`;

    setTimeout((): void => {
      this._updateSummaryTimeline(containerId, data);
    }, 0);

    return `<div id="${containerId}"></div>`;
  }

  private _updateSummaryTimeline(containerId: string, data: { name: string; oldRU: number; newRU: number; gain: number }): void {
    const container: HTMLElement | null = document.getElementById(containerId);
    if (!container) return;

    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenario = this._deps.benchmark.getScenarios(difficulty).find(scenarioItem => scenarioItem.name === data.name);
    if (!scenario) return;

    const oldEstimate = this._deps.estimator.getEstimateForValue(data.oldRU, difficulty);
    const newEstimate = this._deps.estimator.getEstimateForValue(data.newRU, difficulty);

    const timeline: SummaryTimelineComponent = new SummaryTimelineComponent({
      scenarioName: data.name,
      thresholds: scenario.thresholds,
      settings: this._deps.visualSettings.getSettings(),
      oldRU: data.oldRU,
      newRU: data.newRU,
      gain: data.gain,
      oldRankName: oldEstimate.rankName,
      newRankName: newEstimate.rankName,
      oldProgress: oldEstimate.progressToNext,
      newProgress: newEstimate.progressToNext
    });

    container.innerHTML = "";
    container.appendChild(timeline.render());
    timeline.resolveCollisions();
  }


  private _renderCompletedContent(): string {
    return `
      <div class="ranked-result" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; text-align: center;">
          <h2 style="text-transform: none; margin: 0; color: var(--upper-band-3); font-weight: 700;">Daily Run Complete</h2>
          <p style="color: var(--text-dim); line-height: 1.4; margin: 0;">End run,<br>or Keep Going?</p>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; padding-bottom: 0.35rem;">
              <button class="media-btn secondary destructive" id="end-ranked-btn" title="End Run">
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <button class="media-btn secondary" id="extend-ranked-btn" title="Keep Going">
                  <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
          </div>
      </div>
    `;
  }


  private _renderRankTimeline(scenarioName: string): string {
    const containerId: string = `rank-timeline-${scenarioName.replace(/\s+/g, "-")}`;

    setTimeout((): void => {
      this._updateRankTimeline(containerId, scenarioName);
    }, 0);

    return `<div id="${containerId}" class="rank-timeline-container"></div>`;
  }

  private _updateRankTimeline(containerId: string, scenarioName: string): void {
    const container: HTMLElement | null = document.getElementById(containerId);

    if (!container) {
      return;
    }

    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenario: BenchmarkScenario | undefined = this._deps.benchmark.getScenarios(difficulty).find(
      (scenarioReference: BenchmarkScenario): boolean => scenarioReference.name === scenarioName
    );

    if (!scenario) {
      return;
    }

    const { estimate, initialRU, achievedRU, bestRU, attemptsRU } = this._getScenarioPerformanceData(scenarioName, scenario);
    const targetRU = initialRU !== undefined && initialRU !== -1 ? initialRU : undefined;

    const timeline: RankTimelineComponent = new RankTimelineComponent({
      thresholds: scenario.thresholds,
      settings: this._deps.visualSettings.getSettings(),
      targetRU,
      achievedRU,
      scrollAnchorRU: bestRU,
      expectedRU: this._calculateExpectedRU(estimate.continuousValue, targetRU ?? 0, achievedRU),
      attemptsRU
    });

    container.innerHTML = "";
    container.appendChild(timeline.render());
    timeline.resolveCollisions();
  }

  private _getScenarioPerformanceData(
    scenarioName: string,
    scenario: BenchmarkScenario
  ): { estimate: ScenarioEstimate, initialRU?: number, achievedRU?: number, bestRU?: number, attemptsRU?: number[] } {
    const estimate = this._deps.estimator.getScenarioEstimate(scenarioName);
    const initialRU = this._deps.rankedSession.state.initialEstimates[scenarioName];
    const record = this._deps.session.getRankedScenarioBest(scenarioName);

    const bestRU = record && record.bestScore > 0
      ? this._deps.estimator.getScenarioContinuousValue(record.bestScore, scenario)
      : undefined;

    const rankedRuns = this._deps.session.getAllRankedSessionRuns();
    const scenarioRuns = rankedRuns.filter(run => run.scenarioName === scenarioName);
    const attemptsRU = scenarioRuns.map(run => this._deps.estimator.getScenarioContinuousValue(run.score, scenario));

    let achievedRU = undefined;

    if (attemptsRU.length >= 3) {
      const sorted = [...attemptsRU].sort((a, b) => b - a);
      achievedRU = sorted[2];
    }

    return { estimate, initialRU, achievedRU, bestRU, attemptsRU };
  }

  private _calculateExpectedRU(currentRU: number, initialRU: number, achievedRU?: number): number | undefined {
    if (achievedRU === undefined) {
      return undefined;
    }

    const potentialRank = RankEstimator.calculateEvolvedValue(initialRU, achievedRU);

    return Math.max(currentRU, potentialRank);
  }

  private _renderScenarioContent(state: RankedSessionState): string {
    const scenarioName = state.sequence[state.currentIndex];

    return `
      <div class="ranked-info-top">
          <span class="now-playing">NOW PLAYING</span>
          <h2 class="ranked-scenario-name">${scenarioName}</h2>
      </div>
      
      ${this._renderRankTimeline(scenarioName)}
      ${this._renderMediaControls(state)}
    `;
  }

  private _renderMediaControls(state: RankedSessionState): string {
    const isScenarioActive: boolean = state.status === "ACTIVE";

    return `
      <div class="media-controls">
          <div class="hud-group left" id="hud-scenario-stats">
              ${isScenarioActive ? this._getScenarioHudString(state) : ""}
          </div>

          <div class="controls-left">
              <button class="media-btn secondary" id="ranked-help-btn" title="Ranked Mode Info">
                  <svg viewBox="0 0 24 24"><path d="M13 19h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
              </button>
              <button class="media-btn secondary" id="ranked-back-btn" ${state.currentIndex === 0 ? "disabled" : ""}>
                  <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
          </div>

          ${this._getPlayButtonHtml()}

          <div class="controls-right">
              <button class="media-btn secondary" id="next-ranked-btn">
                  <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
              <button class="media-btn secondary destructive" id="end-ranked-btn">
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
          </div>

          <div class="hud-group right" id="hud-session-stats">
              ${isScenarioActive ? this._getSessionHudString() : ""}
          </div>
      </div>
    `;
  }

  private _getScenarioHudString(state: RankedSessionState): string {
    const currentScenario = state.sequence[state.currentIndex];
    const allRuns = this._deps.session.getAllRankedSessionRuns();
    const scenarioTime: number = this._deps.rankedSession.scenarioElapsedSeconds;
    const scenarioAttempts: number = allRuns.filter(run => run.scenarioName === currentScenario).length;

    return `${this._formatHudTime(scenarioTime)} | ${scenarioAttempts}`;
  }

  private _getSessionHudString(): string {
    const allRuns = this._deps.session.getAllRankedSessionRuns();
    const sessionStartTime: number | null = this._deps.session.rankedStartTime;
    const sessionTime: number = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
    const sessionAttempts: number = allRuns.length;

    return `${sessionAttempts} | ${this._formatHudTime(sessionTime)}`;
  }

  private _getPlayButtonHtml(): string {
    return `
      <button class="media-btn primary" id="ranked-play-now">
          <svg viewBox="0 0 24 24">
              <mask id="play-drain-mask">
                  <rect x="0" y="0" width="24" height="24" fill="black" />
                  <rect id="play-drain-water" x="0" y="0" width="24" height="24" fill="white" />
              </mask>
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none" mask="url(#play-drain-mask)" />
              <g transform="matrix(0.6 0 0 0.6 4.8 4.8)">
                  <path d="M8 5v14l11-7z"/>
              </g>
          </svg>
      </button>
    `;
  }

  private _attachActiveListeners(container: HTMLElement): void {
    const nextBtn: HTMLButtonElement | null = container.querySelector("#next-ranked-btn");
    nextBtn?.addEventListener("click", () => this._deps.rankedSession.advance());

    const extendBtn: HTMLButtonElement | null = container.querySelector("#extend-ranked-btn");
    extendBtn?.addEventListener("click", () => this._deps.rankedSession.extendSession());

    const endBtn: HTMLButtonElement | null = container.querySelector("#end-ranked-btn");
    endBtn?.addEventListener("click", () => this._deps.rankedSession.endSession());

    const finishBtn: HTMLButtonElement | null = container.querySelector("#finish-ranked-btn");
    finishBtn?.addEventListener("click", () => this._deps.rankedSession.reset());

    const playNowBtn: HTMLButtonElement | null = container.querySelector("#ranked-play-now");
    playNowBtn?.addEventListener("click", () => {
      const scenarioName = this._deps.rankedSession.state.sequence[this._deps.rankedSession.state.currentIndex];
      this._launchScenario(scenarioName);
    });

    const backBtn: HTMLButtonElement | null = container.querySelector("#ranked-back-btn");
    backBtn?.addEventListener("click", () => this._deps.rankedSession.retreat());

    const helpBtn: HTMLButtonElement | null = container.querySelector("#ranked-help-btn");
    helpBtn?.addEventListener("click", (): void => {
      const popup: RankedHelpPopupComponent = new RankedHelpPopupComponent(this._deps.audio);
      popup.render();
    });

    this._updateDrainAnimation(container);
  }

  private _updateDrainAnimation(container: HTMLElement): void {
    const water: HTMLElement | null = container.querySelector("#play-drain-water");
    if (!water) {
      return;
    }

    const elapsed = this._deps.rankedSession.elapsedSeconds;
    const totalMinutes = this._deps.sessionSettings.getSettings().rankedIntervalMinutes;
    const totalSeconds = totalMinutes * 60;

    water.style.transition = "none";
    water.style.animation = `drain-vertical ${totalSeconds}s linear forwards`;
    water.style.animationDelay = `-${elapsed}s`;
  }

  private _launchScenario(scenarioName: string): void {
    const encodedName: string = encodeURIComponent(scenarioName);
    const steamUrl: string = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;
    window.location.href = steamUrl;
  }

  private _calculateHolisticEstimateRank(): EstimatedRank {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();

    return this._deps.estimator.calculateHolisticEstimateRank(difficulty);
  }

  private async _shouldShowFolderSettings(): Promise<boolean> {
    const isStatsFolder: boolean = this._deps.directory.isStatsFolderSelected();
    const isManualOpen: boolean = this._deps.appState.getIsFolderViewOpen();

    if (!isStatsFolder || isManualOpen) {
      return true;
    }

    const lastCheck: number = await this._deps.history.getLastCheckTimestamp();

    return lastCheck === 0;
  }

  private async _renderFolderView(): Promise<void> {
    const lastCheck: number = await this._deps.history.getLastCheckTimestamp();

    this._container.innerHTML = "";
    this._folderSettingsView?.destroy();

    this._updateHeaderButtonStates(true);

    const handlers = this._createFolderViewHandlers();
    const isInvalid = !!this._deps.directory.originalSelectionName && !this._deps.directory.isStatsFolderSelected();
    const isValid = this._deps.directory.isStatsFolderSelected();

    this._folderSettingsView = new FolderSettingsView({
      handlers,
      currentFolderName: this._deps.directory.originalSelectionName,
      hasStats: lastCheck > 0,
      isInvalid,
      isValid,
    });

    this._container.classList.remove("session-active");
    document.body.classList.remove("ranked-mode-active");
    this._container.appendChild(this._folderSettingsView.render());
  }

  private _createFolderViewHandlers(): FolderActionHandlers {
    return {
      onLinkFolder: async (): Promise<void> => {
        await this._deps.folderActions.onLinkFolder();
        await this._dismissFolderView();
      },
      onForceScan: async (): Promise<void> => {
        await this._deps.folderActions.onForceScan();
        await this._dismissFolderView();
      },
      onUnlinkFolder: async (): Promise<void> => {
        this._deps.folderActions.onUnlinkFolder();
        await this._dismissFolderView();
      },
    };
  }

  private async _dismissFolderView(): Promise<void> {
    this._deps.appState.setIsFolderViewOpen(false);
    await this.render();
  }

  private _updateHeaderButtonStates(isFolderActive: boolean): void {
    const folderBtn: HTMLElement | null = document.getElementById("header-folder-btn");
    const settingsBtn: HTMLElement | null = document.getElementById("header-settings-btn");
    const rankedNavBtn: HTMLElement | null = document.getElementById("nav-ranked");

    if (folderBtn) {
      folderBtn.classList.toggle("active", isFolderActive);
    }

    if (settingsBtn) {
      settingsBtn.classList.toggle("active", this._deps.appState.getIsSettingsMenuOpen());
    }

    if (rankedNavBtn) {
      const isRankedTabActive = this._deps.appState.getActiveTabId() === "nav-ranked";
      if (isRankedTabActive) {
        rankedNavBtn.classList.toggle("active", !isFolderActive);
      }
    }
  }
}
