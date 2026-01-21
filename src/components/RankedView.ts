import { RankedSessionService, RankedSessionState, RankedSessionStatus } from "../services/RankedSessionService";
import { SessionService } from "../services/SessionService";
import { BenchmarkService } from "../services/BenchmarkService";
import { RankEstimator, EstimatedRank, ScenarioEstimate } from "../services/RankEstimator";
import { BenchmarkScenario } from "../data/benchmarks";
import { AppStateService } from "../services/AppStateService";
import { HistoryService } from "../services/HistoryService";
import { VisualSettingsService } from "../services/VisualSettingsService";
import { AudioService } from "../services/AudioService";
import { RankTimelineComponent, RankTimelineConfiguration } from "./visualizations/RankTimelineComponent";
import { SummaryTimelineComponent } from "./visualizations/SummaryTimelineComponent";
import { FolderSettingsView, FolderActionHandlers } from "./ui/FolderSettingsView";
import { DirectoryAccessService } from "../services/DirectoryAccessService";
import { RankedHelpPopupComponent } from "./ui/RankedHelpPopupComponent";
import { RankPopupComponent } from "./ui/RankPopupComponent";
import { SessionSettingsService } from "../services/SessionSettingsService";
import { PeakWarningPopupComponent } from "./ui/PeakWarningPopupComponent";
import { CosmeticOverrideService } from "../services/CosmeticOverrideService";

export interface RankedViewDependencies {
  readonly rankedSession: RankedSessionService;
  readonly session: SessionService;
  readonly benchmark: BenchmarkService;
  readonly estimator: RankEstimator;
  readonly cosmeticOverride: CosmeticOverrideService;
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
  private _activeTimeline: RankTimelineComponent | null = null;
  private _activeTimelineScenario: string | null = null;
  private _lastStatus: RankedSessionState["status"] | null = null;
  private _lastScenarioName: string | null = null;
  private _summaryTimelines: SummaryTimelineComponent[] = [];
  private readonly _pendingSummaryScenarios: Set<string> = new Set();
  private readonly _onBrowserFocusBound: () => void;

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

    this._onBrowserFocusBound = this._onBrowserFocus.bind(this);
    window.addEventListener("focus", this._onBrowserFocusBound);
    // Also update indicator on blur
    window.addEventListener("blur", this._onBrowserFocusBound);
  }

  /**
   * Cleans up resources and listeners.
   */
  public destroy(): void {
    window.removeEventListener("focus", this._onBrowserFocusBound);
    window.removeEventListener("blur", this._onBrowserFocusBound);
    this._stopHudTicking();
  }

  private _onBrowserFocus(): void {
    this._updateAnimationIndicator();

    if (document.hasFocus()) {
      if (this._activeTimeline) {
        this._activeTimeline.play();
      }
      this._playSummaryAnimations();
    }
  }

  private _playSummaryAnimations(): void {
    if (!document.hasFocus() || this._lastStatus !== "SUMMARY") return;

    const list = this._container.querySelector(".scenarios-list") as HTMLElement;
    if (!list) return;

    const summaryData = this._calculateSummaryData();

    summaryData.forEach((data, index): void => {
      const slug = this._slugify(data.name);
      const containerId = `rank-timeline-summary-${slug}`;
      const itemId = `item-${slug}`;
      const existingItem = list.querySelector(`#${CSS.escape(itemId)}`);

      if (existingItem || this._pendingSummaryScenarios.has(data.name)) {
        this._maybePlayExistingTimeline(data.name, index);

        return;
      }

      this._pendingSummaryScenarios.add(data.name);
      setTimeout((): void => {
        if (!document.hasFocus() || this._lastStatus !== "SUMMARY") {
          this._pendingSummaryScenarios.delete(data.name);

          return;
        }

        this._addSummaryItem(list, data, containerId, itemId);
      }, index * 1000);
    });
  }

  private _slugify(text: string): string {
    return text.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  }

  private _maybePlayExistingTimeline(scenarioName: string, index: number): void {
    const summaryTimeline = this._summaryTimelines.find((timeline): boolean => timeline.scenarioName === scenarioName);

    if (summaryTimeline && !summaryTimeline.hasStarted()) {
      setTimeout((): void => {
        if (document.hasFocus()) {
          summaryTimeline.play();
        }
      }, index * 1000);
    }
  }

  private _addSummaryItem(list: HTMLElement, data: { name: string; oldRU: number; newRU: number; gain: number; time: number; attempts: number }, containerId: string, itemId: string): void {
    const existing = list.querySelector(`#${CSS.escape(itemId)}`);

    if (existing) {
      this._pendingSummaryScenarios.delete(data.name);

      return;
    }

    const item = document.createElement("div");

    item.className = "scenario-summary-item summary-timeline-item entering";

    item.setAttribute("id", itemId);

    item.innerHTML = `<div id="${containerId}"></div>`;

    list.appendChild(item);

    // Force reflow to trigger transition
    void item.offsetHeight;

    requestAnimationFrame((): void => {
      item.classList.remove("entering");
      this._pendingSummaryScenarios.delete(data.name);

      this._updateSummaryTimeline(containerId, data);

      const timeline = this._summaryTimelines[this._summaryTimelines.length - 1];
      if (timeline) {
        timeline.play();
      }

      this._scrollToBottom(list);
    });
  }

  private _scrollToBottom(list: HTMLElement): void {
    const isScrollable = list.scrollHeight > list.clientHeight;
    if (isScrollable) {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: "smooth"
      });
    }
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
    if (await this._shouldShowFolderSettings()) {
      await this._renderFolderView();

      return;
    }

    const state: RankedSessionState = this._deps.rankedSession.state;
    const scenarioName = this._getActiveScenarioName(state);

    if (this._shouldPerformQuickUpdate(state, scenarioName)) {
      this._performQuickUpdate(scenarioName!);

      return;
    }

    this._updateLastKnownState(state.status, scenarioName);
    this._stopHudTicking();
    this._container.innerHTML = "";

    this._summaryTimelines.forEach((timeline) => timeline.destroy());
    this._summaryTimelines = [];
    this._pendingSummaryScenarios.clear();

    this._renderMainUI(state);

    if (state.status === "SUMMARY") {
      setTimeout(() => this._playSummaryAnimations(), 500);
    }
  }

  private _getActiveScenarioName(state: RankedSessionState): string | null {
    return (state.status === "ACTIVE" || state.status === "SUMMARY")
      ? state.sequence[state.currentIndex]
      : null;
  }

  private _shouldPerformQuickUpdate(state: RankedSessionState, scenarioName: string | null): boolean {
    const statusChanged = this._lastStatus !== state.status;
    const scenarioChanged = this._lastScenarioName !== scenarioName;

    return !statusChanged && !scenarioChanged && state.status === "ACTIVE";
  }

  private _performQuickUpdate(scenarioName: string): void {
    const containerId = `rank-timeline-${this._slugify(scenarioName)}`;

    this._updateRankTimeline(containerId, scenarioName);
    this._updateHolisticRankUI();
    this._updateHudStats();
    this._updateDrainAnimation(this._container);
    this._updateAnimationIndicator();
  }

  private _updateAnimationIndicator(): void {
    const indicator = this._container.querySelector(".now-playing") as HTMLElement;
    if (!indicator) return;

    const shouldPlay = this._shouldPlayAnimations();
    this._container.classList.toggle("animate-on-focus", shouldPlay);
  }

  private _shouldPlayAnimations(): boolean {
    const settings = this._deps.visualSettings.getSettings();
    const isFocused = document.hasFocus();

    return isFocused || settings.playAnimationsUnfocused;
  }


  private _updateLastKnownState(status: RankedSessionStatus, scenarioName: string | null): void {
    this._lastStatus = status;
    this._lastScenarioName = scenarioName;
  }

  private _renderMainUI(state: RankedSessionState): void {
    const viewContainer: HTMLDivElement = document.createElement("div");
    viewContainer.className = "benchmark-view-container";

    viewContainer.appendChild(this._createHeaderControls());
    this._updateHeaderButtonStates(false);

    const isSessionActive = state.status !== "IDLE";
    this._container.classList.toggle("session-active", isSessionActive);
    document.body.classList.toggle("ranked-mode-active", isSessionActive);

    this._container.appendChild(viewContainer);

    if (state.status === "IDLE") {
      this._renderIdle(viewContainer);
    } else {
      this._renderActiveState(state, viewContainer);
    }

    this._updateAnimationIndicator();
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
    container.setAttribute("id", "holistic-rank-ui");

    this._fillHolisticRankUI(container);

    return container;
  }

  private _updateHolisticRankUI(): void {
    const container = document.getElementById("holistic-rank-ui");
    if (container) {
      this._fillHolisticRankUI(container);
    }
  }

  private _fillHolisticRankUI(container: HTMLElement): void {
    const difficulty = this._deps.appState.getBenchmarkDifficulty();
    const estimate = this._deps.cosmeticOverride.isActiveFor(difficulty)
      ? this._deps.cosmeticOverride.getFakeEstimatedRank(difficulty)
      : this._calculateHolisticEstimateRank();

    const isUnranked = estimate.rankName === "Unranked";
    const rankClass = isUnranked ? "rank-name unranked-text" : "rank-name";

    const isPeak = this._deps.benchmark.isPeak(difficulty);
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

    this._attachRankPopupListener(container, estimate.rankName);
  }

  private _attachRankPopupListener(container: HTMLElement, rankName: string): void {
    const rankInner = container.querySelector(".rank-text-inner") as HTMLElement;
    if (rankInner) {
      rankInner.style.cursor = "pointer";
      rankInner.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        const difficulty = this._deps.appState.getBenchmarkDifficulty();
        const rankNames = this._deps.benchmark.getRankNames(difficulty);
        const popup = new RankPopupComponent(rankInner, rankName, rankNames);
        popup.render();
      });
    }

    const peakWarningIcon = container.querySelector(".peak-warning-icon") as HTMLElement;
    if (peakWarningIcon) {
      peakWarningIcon.style.cursor = "pointer";
      peakWarningIcon.addEventListener("click", (event: Event) => {
        event.stopPropagation();
        const popup = new PeakWarningPopupComponent(this._deps.audio, this._deps.cosmeticOverride);
        popup.subscribeToClose(() => {
          this._deps.audio.playHeavy(0.4);
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
    this._updateAnimationIndicator();
    this._hudInterval = window.setInterval(() => {
      this._updateHudStats();
      this._updateAnimationIndicator();
    }, 1000);
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

    const scenarioTime: number = this._deps.rankedSession.scenarioElapsedSeconds;
    const scenarioAttempts: number = allRuns.filter(run => run.scenarioName === currentScenario).length;

    scenarioStats.textContent = `${this._formatHudTime(scenarioTime)} | ${scenarioAttempts}`;

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
    const summaryData: { name: string; oldRU: number; newRU: number; gain: number; time: number; attempts: number }[] = this._calculateSummaryData();

    return `
      <div class="ranked-info-top">
          <span class="now-playing">SUMMARY</span>
      </div>
      <div class="summary-content-wrapper">
          <div class="scenarios-list summary-scrollable">
              ${summaryData.length === 0 ? '<p class="no-scenarios">No rank gains this session.</p>' : ""}
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

  private _calculateSummaryData(): { name: string; oldRU: number; newRU: number; gain: number; time: number; attempts: number }[] {
    const state = this._deps.rankedSession.state;
    const initialEstimates = state.initialEstimates;
    const allRuns = this._deps.session.getAllRankedSessionRuns();
    const results: { name: string; oldRU: number; newRU: number; gain: number; time: number; attempts: number }[] = [];

    for (const scenarioName of state.playedScenarios) {
      const oldRU = initialEstimates[scenarioName] ?? 0;
      const currentEstimate = this._deps.cosmeticOverride.isActiveFor(this._deps.appState.getBenchmarkDifficulty())
        ? this._deps.cosmeticOverride.getFakeEstimatedRank(this._deps.appState.getBenchmarkDifficulty())
        : this._deps.estimator.getScenarioEstimate(scenarioName);
      const newRU = currentEstimate.continuousValue;

      const attemptsCount = allRuns.filter(run => run.scenarioName === scenarioName).length;

      if (attemptsCount > 0 || state.status === "SUMMARY") {
        results.push({
          name: scenarioName,
          oldRU,
          newRU,
          gain: Math.max(0, Math.round((newRU - oldRU) * 100)),
          time: state.accumulatedScenarioSeconds[scenarioName] ?? 0,
          attempts: Math.max(attemptsCount, 1)
        });
      }
    }

    return results.sort((a, b) => b.gain - a.gain);
  }


  private _updateSummaryTimeline(containerId: string, data: { name: string; oldRU: number; newRU: number; gain: number; time: number; attempts: number }): void {
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
      newProgress: newEstimate.progressToNext,
      totalSecondsSpent: data.time,
      attempts: data.attempts
    });

    container.innerHTML = "";
    container.appendChild(timeline.render());
    timeline.resolveCollisions();

    this._summaryTimelines.push(timeline);
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
    const containerId: string = `rank-timeline-${this._slugify(scenarioName)}`;

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

    const config = this._prepareTimelineConfig(scenarioName, scenario);
    const isSameScenario = this._activeTimelineScenario === scenarioName;
    const shouldPlay = this._shouldPlayAnimations();
    const paused = !shouldPlay;
    const immediate = false;

    if (this._activeTimeline && isSameScenario) {
      this._updateExistingTimeline(container, config, immediate, paused);
    } else {
      this._createNewTimeline(container, config, scenarioName, { immediate, paused });
    }

    this._activeTimeline!.resolveCollisions();
  }

  private _prepareTimelineConfig(scenarioName: string, scenario: BenchmarkScenario): RankTimelineConfiguration {
    const { estimate, initialRU, achievedRU, bestRU, attemptsRU } = this._getScenarioPerformanceData(scenarioName, scenario);
    const targetRU = initialRU !== undefined && initialRU !== -1 ? initialRU : undefined;

    return {
      thresholds: scenario.thresholds,
      settings: this._deps.visualSettings.getSettings(),
      targetRU,
      achievedRU,
      scrollAnchorRU: bestRU,
      expectedRU: this._calculateExpectedRU(estimate.continuousValue, targetRU ?? 0, achievedRU),
      attemptsRU
    };
  }

  private _updateExistingTimeline(container: HTMLElement, config: RankTimelineConfiguration, immediate: boolean, paused: boolean): void {
    const timelineContainer = this._activeTimeline!.getContainer();

    if (container.firstChild !== timelineContainer) {
      container.innerHTML = "";
      container.appendChild(timelineContainer);
    }

    this._activeTimeline!.update(config, immediate, paused);
  }

  private _createNewTimeline(
    container: HTMLElement,
    config: RankTimelineConfiguration,
    scenarioName: string,
    options: { immediate: boolean; paused: boolean }
  ): void {
    this._activeTimeline = new RankTimelineComponent(config);
    this._activeTimelineScenario = scenarioName;

    this._activeTimeline.render(options.immediate, options.paused);

    const timelineContainer = this._activeTimeline.getContainer();
    container.innerHTML = "";
    container.appendChild(timelineContainer);
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

  /**
   * Synchronizes the play button's circular drain animation with the backend session timer.
   *
   * @param container - The parent container containing the water element.
   * @private
   */
  private _updateDrainAnimation(container: HTMLElement): void {
    const water: HTMLElement | null = container.querySelector("#play-drain-water");

    if (!water) {
      return;
    }

    const elapsed = this._deps.rankedSession.elapsedSeconds;
    const totalMinutes = this._deps.sessionSettings.getSettings().rankedIntervalMinutes;
    const totalSeconds = totalMinutes * 60;

    water.style.animationName = "none";
    water.style.transform = "translateY(-100%)";

    window.requestAnimationFrame((): void => {
      window.requestAnimationFrame((): void => {
        this._applyDrainStyles(water, totalSeconds, elapsed);
      });
    });
  }

  private _applyDrainStyles(water: HTMLElement, duration: number, delay: number): void {
    if (!water.parentElement) {
      return;
    }

    water.style.animationName = "drain-vertical";
    water.style.animationDuration = `${duration}s`;
    water.style.animationTimingFunction = "linear";
    water.style.animationFillMode = "forwards";
    water.style.animationDelay = `-${delay}s`;
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
