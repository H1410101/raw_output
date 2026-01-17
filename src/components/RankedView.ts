import { RankedSessionService, RankedSessionState } from "../services/RankedSessionService";
import { SessionService, SessionRankRecord } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator, EstimatedRank, ScenarioEstimate } from "../services/RankEstimator";
import { BenchmarkScenario } from "../data/benchmarks";

import { AppStateService } from "../services/AppStateService";
import { HistoryService } from "../services/HistoryService";
import { VisualSettingsService } from "../services/VisualSettingsService";
import { AudioService } from "../services/AudioService";
import { RankTimelineComponent } from "./visualizations/RankTimelineComponent";
import { FolderSettingsView } from "./ui/FolderSettingsView";
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

    const isFolderLinked: boolean = !!this._deps.directory.currentFolderName;
    const lastCheck: number =
      await this._deps.history.getLastCheckTimestamp();

    if (isFolderLinked && lastCheck > 0) {
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
      this._evolveEstimate(record.scenarioName, record.bestScore);
    }

    this.refresh();
  }

  private _evolveEstimate(scenarioName: string, score: number): void {
    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);
    const scenario = scenarios.find((scenarioRef) => scenarioRef.name === scenarioName);

    if (scenario) {
      const sessionValue: number = this._deps.estimator.getScenarioContinuousValue(score, scenario);
      this._deps.estimator.evolveScenarioEstimate(scenarioName, sessionValue);
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
    const estimate = this._calculateHolisticEstimateRank();
    const isUnranked = estimate.rankName === "Unranked";
    const rankClass = isUnranked ? "rank-name unranked-text" : "rank-name";

    container.innerHTML = `
        <div class="badge-content">
            <span class="${rankClass}">
                <span class="rank-text-inner">${estimate.rankName}</span>
            </span>
            <span class="rank-progress">${isUnranked ? "" : `+${estimate.progressToNext}%`}</span>
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
      </div>
    `;
  }

  private _renderActiveState(state: RankedSessionState, parent: HTMLElement): void {
    const isImproved = this._checkIfCurrentImproved();

    const container: HTMLDivElement = document.createElement("div");
    container.className = "ranked-container active";

    container.innerHTML = this._renderMainContent(state, isImproved);

    parent.appendChild(container);
    this._attachActiveListeners(container);
  }


  private _checkIfCurrentImproved(): boolean {
    const current = this._deps.rankedSession.currentScenarioName;
    if (!current) return false;

    const estimate = this._deps.estimator.getScenarioEstimate(current);

    return this._isImproved(estimate.continuousValue, current);
  }

  private _isImproved(estimateValue: number, currentScenario: string): boolean {
    const bests = this._deps.session.getAllScenarioSessionBests();
    const record = bests.find((recordRef) => recordRef.scenarioName === currentScenario);
    if (!record) return false;

    const diff = this._deps.appState.getBenchmarkDifficulty();
    const scenario = this._deps.benchmark.getScenarios(diff).find((scenarioRef) => scenarioRef.name === currentScenario);
    if (!scenario) return false;

    return this._deps.estimator.getScenarioContinuousValue(record.bestScore, scenario) > estimateValue;
  }



  private _renderMainContent(state: RankedSessionState, isImproved: boolean): string {
    if (state.status === "COMPLETED") {
      return this._renderCompletedContent();
    }

    if (state.status === "SUMMARY") {
      return this._renderSummaryContent();
    }

    return this._renderScenarioContent(state, isImproved);
  }

  private _renderSummaryContent(): string {
    const estimate = this._calculateSessionAchievedRank();
    const bests = this._deps.session.getAllScenarioSessionBests();

    return `
      <div class="ranked-result summary-view">
          <h2 class="congrats">SESSION EXPIRED</h2>
          <div class="summary-card">
              <p class="summary-rank">FINAL RANK: <span class="accent">${estimate.rankName}</span></p>
              <p class="summary-subtitle">Run Overview</p>
              <div class="scenarios-list">
                  ${bests.length > 0 ? bests.map(record => `
                      <div class="scenario-summary-item">
                          <span class="scenario-name">${record.scenarioName}</span>
                          <span class="scenario-score">${record.bestScore.toFixed(1)}</span>
                          <span class="scenario-rank">${record.rankResult.currentRank}</span>
                      </div>
                  `).join('') : '<p class="no-scenarios">No scenarios played this session.</p>'}
              </div>
          </div>
          <button class="next-btn luminous" id="finish-ranked-btn">BACK TO HUB</button>
      </div>
    `;
  }

  private _renderCompletedContent(): string {
    const estimate = this._calculateSessionAchievedRank();

    return `
      <div class="ranked-result">
          <h2 class="congrats">RUN COMPLETE</h2>
          <div class="summary-card">
              <p class="summary-rank">ACHIEVED RANK: <span class="accent">${estimate.rankName}</span></p>
              <p class="summary-subtitle">Session Performance</p>
          </div>
          <button class="next-btn luminous" id="extend-ranked-btn">CONTINUE TO INFINITE RUN</button>
      </div>
    `;
  }

  private _calculateSessionAchievedRank(): EstimatedRank {
    const state = this._deps.rankedSession.state;
    const sequence = state.sequence;
    const difficulty = this._deps.appState.getBenchmarkDifficulty();

    if (sequence.length < 3) {
      // Should not happen in COMPLETED state normally
      return this._deps.estimator.getEstimateForValue(0, difficulty);
    }

    // 1st scenario (Strong) and 3rd scenario (Mid)
    const scenarioNames = [sequence[0], sequence[2]];
    let totalRankValue = 0;
    let count = 0;

    const bests = this._deps.session.getAllScenarioSessionBests();
    const scenarios = this._deps.benchmark.getScenarios(difficulty);

    for (const name of scenarioNames) {
      const record = bests.find((record: SessionRankRecord) => record.scenarioName === name);
      const scenario = scenarios.find((scenario: BenchmarkScenario) => scenario.name === name);

      if (record && scenario) {
        const val = this._deps.estimator.getScenarioContinuousValue(record.bestScore, scenario);
        totalRankValue += val;
        count++;
      }
    }

    const average = count > 0 ? totalRankValue / count : 0;

    return this._deps.estimator.getEstimateForValue(average, difficulty);
  }

  private _renderRankTimeline(scenarioName: string): string {
    const containerId: string = `rank-timeline-${scenarioName.replace(/\s+/g, "-")}`;

    setTimeout((): void => {
      this._updateRankTimeline(containerId, scenarioName);
    }, 0);

    return `<div id="${containerId}" class="rank-timeline-container"></div>`;
  }

  private _updateRankTimeline(
    containerId: string,
    scenarioName: string
  ): void {
    const container: HTMLElement | null = document.getElementById(containerId);
    if (!container) return;

    const difficulty: string = this._deps.appState.getBenchmarkDifficulty();
    const scenario: BenchmarkScenario | undefined = this._deps.benchmark.getScenarios(difficulty).find(
      (scenarioReference: BenchmarkScenario): boolean => scenarioReference.name === scenarioName
    );

    if (!scenario) return;

    const estimate: ScenarioEstimate = this._deps.estimator.getScenarioEstimate(scenarioName);
    const bests: SessionRankRecord[] = this._deps.session.getAllScenarioSessionBests();
    const record: SessionRankRecord | undefined = bests.find(
      (sessionRecord: SessionRankRecord): boolean => sessionRecord.scenarioName === scenarioName
    );

    const bestScore: number = record ? record.bestScore : 0;

    const achievedRU: number | undefined = bestScore > 0
      ? this._deps.estimator.getScenarioContinuousValue(bestScore, scenario)
      : undefined;

    const timeline: RankTimelineComponent = new RankTimelineComponent({
      thresholds: scenario.thresholds,
      settings: this._deps.visualSettings.getSettings(),
      targetRU: estimate.continuousValue !== -1 ? estimate.continuousValue : undefined,
      achievedRU
    });

    container.innerHTML = "";
    container.appendChild(timeline.render());
  }



  private _renderScenarioContent(state: RankedSessionState, isImproved: boolean): string {
    const scenarioName = state.sequence[state.currentIndex];

    return `
      <div class="ranked-info-top">
          <span class="now-playing">NOW PLAYING</span>
          <h2 class="ranked-scenario-name">${scenarioName}</h2>
      </div>
      
      ${this._renderRankTimeline(scenarioName)}
      ${this._renderMediaControls(state, isImproved)}
    `;
  }

  private _renderMediaControls(state: RankedSessionState, isImproved: boolean): string {
    return `
      <div class="media-controls">
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
              <button class="media-btn secondary ${isImproved ? "luminous" : "dull"}" id="next-ranked-btn">
                  <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
              <button class="media-btn secondary destructive" id="end-ranked-btn">
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
          </div>
      </div>
    `;
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
    if (!water) return;

    const elapsed = this._deps.rankedSession.elapsedSeconds;
    const totalMinutes = this._deps.sessionSettings.getSettings().rankedIntervalMinutes;
    const totalSeconds = totalMinutes * 60;

    // We animate the black rect from y=0 (obscuring nothing? Wait)
    // Goal: "Cut-out initially filled" (VISIBLE Circle) -> "Unfill" (INVISIBLE Circle).
    // White rect = Visible. Black rect = Invisible.
    // Initially: Mask should be White.
    // As time passes: Top becomes Black.
    // So Black rect moves DOWN from TOP?

    // Let's rely on translation.
    // Black rect at y=-24 (Above). Moves to y=0?
    // If Black rect is over the shape, it hides it.
    // We want to HIDE the top part.
    // So Black rect starts at y=-24 (Not covering).
    // Ends at y=0 (Covering).
    // Wait, if it covers from TOP, then as it moves DOWN, it covers more.

    // Let's check: Water drained.
    // Full Container (Visible).
    // Level Drops. Top becomes Empty (Invisible).
    // So yes, we need to hide the top part progressively.
    // So a Masking Shape (Black) enters from the Top?

    // Reset
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
    const isFolderLinked: boolean = !!this._deps.directory.currentFolderName;
    const isManualOpen: boolean = this._deps.appState.getIsFolderViewOpen();

    if (!isFolderLinked || isManualOpen) {
      return true;
    }

    const lastCheck: number =
      await this._deps.history.getLastCheckTimestamp();

    return lastCheck === 0;
  }

  private async _renderFolderView(): Promise<void> {
    const lastCheck: number =
      await this._deps.history.getLastCheckTimestamp();

    this._container.innerHTML = "";
    this._folderSettingsView?.destroy();

    this._updateHeaderButtonStates(true);

    const handlers = {
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

    this._folderSettingsView = new FolderSettingsView(
      handlers,
      this._deps.directory.originalSelectionName,
      lastCheck > 0,
    );

    // Ensure ranked mode classes are removed
    this._container.classList.remove("session-active");
    document.body.classList.remove("ranked-mode-active");

    this._container.appendChild(this._folderSettingsView.render());
  }

  private async _dismissFolderView(): Promise<void> {
    this._deps.appState.setIsFolderViewOpen(false);
    await this.render();
  }

  private _updateHeaderButtonStates(isFolderActive: boolean): void {
    const folderBtn: HTMLElement | null =
      document.getElementById("header-folder-btn");
    const settingsBtn: HTMLElement | null = document.getElementById(
      "header-settings-btn",
    );
    const rankedNavBtn: HTMLElement | null = document.getElementById("nav-ranked");

    if (folderBtn) {
      folderBtn.classList.toggle("active", isFolderActive);
    }

    if (settingsBtn) {
      settingsBtn.classList.toggle(
        "active",
        this._deps.appState.getIsSettingsMenuOpen(),
      );
    }

    if (rankedNavBtn) {
      const isRankedTabActive = this._deps.appState.getActiveTabId() === "nav-ranked";

      if (isRankedTabActive) {
        rankedNavBtn.classList.toggle("active", !isFolderActive);
      }
    }
  }
}
