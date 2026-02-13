import { BenchmarkScenario, DifficultyTier } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { AudioService } from "../../services/AudioService";
import { RankEstimator, EstimatedRank } from "../../services/RankEstimator";
import { CosmeticOverrideService } from "../../services/CosmeticOverrideService";
import { IdentityService } from "../../services/IdentityService";
import { DotCloudComponent } from "../visualizations/DotCloudComponent";
import { ScoreEntry } from "../visualizations/ScoreProcessor";

/**
 * Collection of services and settings required for BenchmarkRowRenderer.
 */
export interface BenchmarkRowDependencies {
  readonly historyService: HistoryService;
  readonly rankService: RankService;
  readonly sessionService: SessionService;
  readonly audioService: AudioService;
  readonly visualSettings: VisualSettings;
  readonly rankEstimator: RankEstimator;
  readonly cosmeticOverride: CosmeticOverrideService;
  readonly identityService: IdentityService;
  readonly onScenarioLaunch?: (scenarioName: string) => void;
}

/**
 * Responsible for rendering a single row within the benchmark table.
 */
export class BenchmarkRowRenderer {
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _sessionService: SessionService;
  private readonly _audioService: AudioService;
  private readonly _rankEstimator: RankEstimator;
  private readonly _cosmeticOverrideService: CosmeticOverrideService;
  private readonly _identityService: IdentityService;
  private _visualSettings: VisualSettings;
  private _currentDifficulty: DifficultyTier = "Advanced";
  private readonly _dotCloudRegistry: Map<string, DotCloudComponent> =
    new Map();
  private _loadCounter: number = 0;

  private readonly _pendingBackgroundLoads: {
    container: HTMLElement;
    scenario: BenchmarkScenario;
    loadId: number;
  }[] = [];
  private _isProcessingBackground: boolean = false;
  private readonly _onScenarioLaunch?: (scenarioName: string) => void;
  private static readonly _maxDotCloudBudget: number = 100;

  /**
   * Initializes the renderer with required services.
   *
   * @param dependencies - Object containing required services and visual configuration.
   */
  public constructor(dependencies: BenchmarkRowDependencies) {
    this._historyService = dependencies.historyService;
    this._rankService = dependencies.rankService;
    this._sessionService = dependencies.sessionService;
    this._audioService = dependencies.audioService;
    this._visualSettings = dependencies.visualSettings;
    this._rankEstimator = dependencies.rankEstimator;
    this._cosmeticOverrideService = dependencies.cosmeticOverride;
    this._identityService = dependencies.identityService;
    this._onScenarioLaunch = dependencies.onScenarioLaunch;
  }

  /**
   * Renders a complete row element for a scenario.
   *
   * @param scenario - The benchmark scenario data.
   * @param highscore - The all-time highscore for this scenario.
   * @param difficulty - The benchmark difficulty tier.
   * @param kovaaksHighscore - The global all-time highscore from Kovaaks API.
   * @returns The constructed row HTMLElement.
   */
  public renderRow(
    scenario: BenchmarkScenario,
    highscore: number,
    difficulty: DifficultyTier = "Advanced",
    kovaaksHighscore: number = 0,
  ): HTMLElement {
    this._currentDifficulty = difficulty;
    const rowElement: HTMLElement = this._createRowContainer(scenario);

    rowElement.appendChild(this._createNameCell(scenario.name));

    if (this._visualSettings.showDotCloud) {
      rowElement.appendChild(this._createDotCloudCell(scenario));
    }

    this._appendRankBadgesIfEnabled(rowElement, scenario, highscore, kovaaksHighscore);

    rowElement.appendChild(this._createPlayButton(scenario.name));
    this._addRowClickListeners(rowElement, scenario);

    return rowElement;
  }

  /**
   * Cleans up all active dot cloud components and popups managed by this renderer.
   */
  public destroyAll(): void {
    this._dotCloudRegistry.forEach((component: DotCloudComponent): void => {
      component.destroy();
    });

    this._dotCloudRegistry.clear();
    this._pendingBackgroundLoads.length = 0;
  }

  /**
   * Updates the visual settings for the renderer and all active dot clouds.
   *
   * @param settings - The new visual settings state.
   */
  public updateVisualSettings(settings: VisualSettings): void {
    this._visualSettings = settings;
    this._dotCloudRegistry.forEach((component: DotCloudComponent): void => {
      component.updateConfiguration(settings);
    });
  }

  /**
   * Updates the content of an existing row element without recreating it.
   *
   * @param rowElement - The existing HTMLElement of the row.
   * @param scenario - The scenario data to apply.
   * @param updateData - The data to update the row with.
   * @param updateData.highscore - The scenario all-time highscore.
   * @param updateData.difficulty - The benchmark difficulty tier.
   * @param updateData.kovaaksHighscore - The global all-time highscore.
   */
  public updateRow(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
    updateData: {
      highscore: number;
      difficulty?: DifficultyTier;
      kovaaksHighscore?: number;
    },
  ): void {
    const {
      highscore,
      difficulty = "Advanced",
      kovaaksHighscore = 0,
    } = updateData;

    this._currentDifficulty = difficulty;
    if (this._visualSettings.showRanks) {
      this._updateRankBadges(rowElement, scenario, highscore, kovaaksHighscore);
      if (this._visualSettings.showRankEstimate) {
        this._updateRankEstimateBadge(rowElement, scenario);
      }
    }

    if (this._visualSettings.showDotCloud) {
      this._ensureDotCloudInjected(rowElement, scenario);
    }
  }

  private _ensureDotCloudInjected(rowElement: HTMLElement, scenario: BenchmarkScenario): void {
    if (this._dotCloudRegistry.has(scenario.name)) {
      this._updateDotCloud(scenario);
    } else {
      const container = rowElement.querySelector(".dot-cloud-container") as HTMLElement;
      if (container) {
        const loadId = parseInt(container.dataset.loadId || "0", 10);
        this._loadDotCloudData(container, scenario, loadId, true);
      }
    }
  }

  /**
   * Creates the main container for a scenario row.
   *
   * @param scenario - The benchmark scenario data.
   * @returns The created row container HTMLElement.
   */
  private _createRowContainer(scenario: BenchmarkScenario): HTMLElement {
    const rowElement: HTMLElement = document.createElement("div");
    rowElement.className = "scenario-row";
    rowElement.setAttribute("data-scenario-name", scenario.name);

    return rowElement;
  }

  /**
   * Appends rank badges to the row element if they are enabled in visual settings.
   *
   * @param rowElement - The row HTMLElement to append badges to.
   * @param scenario - The benchmark scenario data.
   * @param highscore - The all-time highscore for the scenario.
   * @param kovaaksHighscore - The global all-time highscore from Kovaaks API.
   */
  private _appendRankBadgesIfEnabled(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
    highscore: number,
    kovaaksHighscore: number,
  ): void {
    if (!this._visualSettings.showRanks) {
      return;
    }

    if (this._visualSettings.showAllTimeBest) {
      const bestScore = Math.max(highscore, kovaaksHighscore);
      rowElement.appendChild(this._createRankBadge(scenario, bestScore));
    }

    if (this._visualSettings.showSessionBest) {
      rowElement.appendChild(this._createSessionRankBadge(scenario));
    }

    if (this._visualSettings.showRankEstimate) {
      rowElement.appendChild(this._createRankEstimateBadge(scenario));
    }
  }

  /**
   * Adds click listeners to the row element.
   *
   * @param rowElement - The row HTMLElement.
   * @param scenario - The benchmark scenario data.
   */
  private _addRowClickListeners(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
  ): void {
    rowElement.addEventListener("click", (): void => {
      rowElement.classList.toggle("selected");
      this._audioService.playLight(0.6);
      this._dotCloudRegistry.get(scenario.name)?.requestUpdate();
    });
  }

  /**
   * Updates the rank badges on an existing row element.
   *
   * @param rowElement - The row HTMLElement.
   * @param scenario - The benchmark scenario data.
   * @param highscore - The current all-time highscore.
   * @param kovaaksHighscore - The global all-time highscore from Kovaaks API.
   */
  private _updateRankBadges(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
    highscore: number,
    kovaaksHighscore: number,
  ): void {
    const allTimeBadge: HTMLElement | null = rowElement.querySelector(
      ".rank-badge-container:not(.session-badge) .badge-content",
    );

    if (allTimeBadge) {
      const bestScore = Math.max(highscore, kovaaksHighscore);
      this._fillBadgeContent(allTimeBadge, scenario, bestScore);
    }

    this._updateSessionBadge(rowElement, scenario);
  }

  /**
   * Updates the session rank badge on an existing row element.
   *
   * @param rowElement - The row HTMLElement.
   * @param scenario - The benchmark scenario data.
   */
  private _updateSessionBadge(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
  ): void {
    const sessionBadge: HTMLElement | null =
      rowElement.querySelector(".session-badge");
    if (!sessionBadge) {
      return;
    }

    const sessionBest = this._sessionService.getScenarioSessionBest(
      scenario.name,
    );
    const bestScore: number = sessionBest ? sessionBest.bestScore : 0;
    const content: HTMLElement | null =
      sessionBadge.querySelector(".badge-content");

    if (content) {
      this._fillBadgeContent(content, scenario, bestScore);
    }

    const isSessionActive: boolean = this._sessionService.isSessionActive();
    const isOverrideActive = this._cosmeticOverrideService.isActiveFor(this._currentDifficulty);
    sessionBadge.style.visibility =
      (bestScore === 0 || !isSessionActive) && !isOverrideActive ? "hidden" : "visible";
  }

  /**
   * Updates the rank estimate badge on an existing row element.
   *
   * @param rowElement - The row HTMLElement.
   * @param scenario - The benchmark scenario data.
   */
  private _updateRankEstimateBadge(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
  ): void {
    const rankEstimateBadge: HTMLElement | null =
      rowElement.querySelector(".rank-estimate-badge .badge-content");

    if (rankEstimateBadge) {
      let estimate: EstimatedRank;

      if (this._cosmeticOverrideService.isActiveFor(this._currentDifficulty)) {
        estimate = this._cosmeticOverrideService.getFakeEstimatedRank(this._currentDifficulty);
      } else {
        const scenarioEstimate = this._rankEstimator.getScenarioEstimate(scenario.name);
        estimate = this._rankEstimator.getEstimateForValue(
          scenarioEstimate.continuousValue,
          this._currentDifficulty,
        );
      }

      this._fillRankEstimateBadgeContent(
        rankEstimateBadge,
        estimate.rankName,
        estimate.progressToNext,
        estimate.continuousValue,
      );
    }
  }

  /**
   * Updates the dot cloud visualization for a given scenario.
   *
   * @param scenario - The benchmark scenario data.
   */
  private _updateDotCloud(scenario: BenchmarkScenario): void {
    const component: DotCloudComponent | undefined = this._dotCloudRegistry.get(
      scenario.name,
    );
    if (component) {
      this._refreshComponentData(component, scenario);
    }
  }

  /**
   * Refreshes the data for a dot cloud component.
   *
   * @param component - The DotCloudComponent instance.
   * @param scenario - The benchmark scenario data.
   */
  private _refreshComponentData(
    component: DotCloudComponent,
    scenario: BenchmarkScenario,
  ): void {
    const profile = this._identityService.getActiveProfile();
    const playerId = profile?.username || "";

    this._historyService
      .getLastScores(playerId, scenario.name, 100)
      .then((entries: ScoreEntry[]): void => {
        const sessionStart: number | null =
          this._sessionService.sessionStartTimestamp;
        const isLatestInSession: boolean =
          sessionStart !== null &&
          entries.length > 0 &&
          entries[0].timestamp >= sessionStart;

        component.updateData({
          entries,
          thresholds: scenario.thresholds,
          isLatestInSession,
          rankInterval: this._calculateAverageRankInterval(scenario),
        });
      });
  }

  /**
   * Creates a name cell for the scenario row.
   *
   * @param scenarioName - The name of the scenario.
   * @returns The created HTMLSpanElement for the name.
   */
  private _createNameCell(scenarioName: string): HTMLElement {
    const nameSpan: HTMLSpanElement = document.createElement("span");
    nameSpan.className = "scenario-name";
    nameSpan.textContent = scenarioName;

    return nameSpan;
  }

  /**
   * Creates a container for the dot cloud visualization.
   *
   * @param scenario - The benchmark scenario data.
   * @returns The created HTMLDivElement for the dot cloud container.
   */
  private _createDotCloudCell(scenario: BenchmarkScenario): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "dot-cloud-container";

    const loadId: number = ++this._loadCounter;
    container.dataset.loadId = loadId.toString();

    this._setupLazyLoading(container, scenario, loadId);

    return container;
  }

  /**
   * Sets up lazy loading for the dot cloud visualization using IntersectionObserver.
   *
   * @param container - The dot cloud container HTMLElement.
   * @param scenario - The benchmark scenario data.
   * @param loadId - A unique ID for the load operation.
   */
  private _setupLazyLoading(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    loadId: number,
  ): void {
    const observer: IntersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        entries.forEach((entry: IntersectionObserverEntry): void => {
          if (entry.isIntersecting) {
            observer.disconnect();
            this._loadDotCloudData(container, scenario, loadId, true);
          }
        });
      },
      { rootMargin: "1000px" },
    );

    observer.observe(container);

    this._pendingBackgroundLoads.push({ container, scenario, loadId });
    this._triggerBackgroundProcessing();
  }

  /**
   * Loads dot cloud data for a scenario.
   *
   * @param container - The dot cloud container HTMLElement.
   * @param scenario - The benchmark scenario data.
   * @param loadId - The unique ID for the load operation.
   * @param isPriority - Whether this is a high-priority load (intersecting).
   */
  private _loadDotCloudData(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    loadId: number,
    isPriority: boolean = false,
  ): void {
    const currentId: string | undefined = container.dataset.loadId;

    if (
      currentId !== loadId.toString() ||
      this._dotCloudRegistry.has(scenario.name)
    ) {
      this._removeFromPending(loadId);

      return;
    }

    if (
      !isPriority &&
      this._dotCloudRegistry.size >= BenchmarkRowRenderer._maxDotCloudBudget
    ) {
      return;
    }
    this._fetchAndRenderScores(container, scenario, loadId);
  }

  private _fetchAndRenderScores(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    loadId: number,
  ): void {
    const profile = this._identityService.getActiveProfile();
    const playerId = profile?.username || "";

    this._historyService
      .getLastScores(playerId, scenario.name, 100)
      .then((entries: ScoreEntry[]): void => {
        const stillCurrentId: string | undefined = container.dataset.loadId;

        if (entries.length > 0 && stillCurrentId === loadId.toString()) {
          this._injectDotCloudVisualization(container, scenario, entries);
          this._removeFromPending(loadId);
        }
      });
  }

  private _removeFromPending(loadId: number): void {
    const index: number = this._pendingBackgroundLoads.findIndex(
      (pendingLoad: { loadId: number }): boolean => pendingLoad.loadId === loadId,
    );

    if (index !== -1) {
      this._pendingBackgroundLoads.splice(index, 1);
    }
  }

  private _triggerBackgroundProcessing(): void {
    if (this._isProcessingBackground || this._pendingBackgroundLoads.length === 0) {
      return;
    }

    this._isProcessingBackground = true;

    const processNext = (): void => {
      if (
        this._pendingBackgroundLoads.length === 0 ||
        this._dotCloudRegistry.size >= BenchmarkRowRenderer._maxDotCloudBudget
      ) {
        this._isProcessingBackground = false;

        return;
      }

      const next = this._pendingBackgroundLoads.shift();

      if (next) {
        this._loadDotCloudData(next.container, next.scenario, next.loadId, false);
      }

      // Defer next load to keep main thread responsive
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback((): void => processNext());
      } else {
        setTimeout(processNext, 50);
      }
    };

    processNext();
  }

  /**
   * Injects the dot cloud visualization into the container.
   *
   * @param container - The dot cloud container HTMLElement.
   * @param scenario - The benchmark scenario data.
   * @param entries - The score entries for the dot cloud.
   */
  private _injectDotCloudVisualization(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    entries: ScoreEntry[],
  ): void {
    const averageRankInterval: number =
      this._calculateAverageRankInterval(scenario);

    const sessionStart: number | null =
      this._sessionService.sessionStartTimestamp;
    const isLatestInSession: boolean =
      sessionStart !== null && entries[0].timestamp >= sessionStart;

    const dotCloud: DotCloudComponent = new DotCloudComponent({
      entries,
      thresholds: scenario.thresholds,
      settings: this._visualSettings,
      isLatestInSession,
      rankInterval: averageRankInterval,
    });

    this._dotCloudRegistry.set(scenario.name, dotCloud);
    container.replaceWith(dotCloud.render());
  }

  /**
   * Calculates the average interval between rank thresholds for a scenario.
   *
   * @param scenario - The benchmark scenario data.
   * @returns The average rank interval.
   */
  private _calculateAverageRankInterval(scenario: BenchmarkScenario): number {
    const thresholds: number[] = Object.values(scenario.thresholds).sort(
      (a: number, b: number): number => a - b,
    );

    if (thresholds.length < 2) {
      return 100;
    }

    let totalIntervalSum: number = 0;
    for (let i: number = 1; i < thresholds.length; i++) {
      totalIntervalSum += thresholds[i] - thresholds[i - 1];
    }

    return totalIntervalSum / (thresholds.length - 1);
  }

  /**
   * Creates a session rank badge for a scenario.
   *
   * @param scenario - The benchmark scenario data.
   * @returns The created HTMLElement for the session rank badge.
   */
  private _createSessionRankBadge(scenario: BenchmarkScenario): HTMLElement {
    const sessionBest = this._sessionService.getScenarioSessionBest(
      scenario.name,
    );
    const bestScore: number = sessionBest ? sessionBest.bestScore : 0;
    const badgeElement: HTMLElement = this._createRankBadge(
      scenario,
      bestScore,
    );

    const isSessionActive: boolean = this._sessionService.isSessionActive();
    const isOverrideActive = this._cosmeticOverrideService.isActiveFor(this._currentDifficulty);
    if ((bestScore === 0 || !isSessionActive) && !isOverrideActive) {
      badgeElement.style.visibility = "hidden";
    }

    badgeElement.classList.add("session-badge");

    return badgeElement;
  }

  /**
   * Creates a rank estimate badge for a scenario.
   *
   * @param scenario - The benchmark scenario data.
   * @returns The created HTMLElement for the rank estimate badge.
   */
  private _createRankEstimateBadge(scenario: BenchmarkScenario): HTMLElement {
    const badgeContainer: HTMLDivElement = document.createElement("div");
    badgeContainer.className = "rank-badge-container rank-estimate-badge";

    const badgeContent: HTMLDivElement = document.createElement("div");
    badgeContent.className = "badge-content";

    let estimate: EstimatedRank;

    if (this._cosmeticOverrideService.isActiveFor(this._currentDifficulty)) {
      estimate = this._cosmeticOverrideService.getFakeEstimatedRank(this._currentDifficulty);
    } else {
      const scenarioEstimate = this._rankEstimator.getScenarioEstimate(scenario.name);
      estimate = this._rankEstimator.getEstimateForValue(
        scenarioEstimate.continuousValue,
        this._currentDifficulty,
      );
    }

    this._fillRankEstimateBadgeContent(badgeContent, estimate.rankName, estimate.progressToNext, estimate.continuousValue);
    badgeContainer.appendChild(badgeContent);

    return badgeContainer;
  }

  /**
   * Fills the content of a rank estimate badge.
   *
   * @param container - The HTMLElement to fill with content.
   * @param rankName - The name of the rank.
   * @param progress - The progress percentage to the next rank.
   * @param continuousValue - The continuous rank unit value.
   */
  private _fillRankEstimateBadgeContent(
    container: HTMLElement,
    rankName: string,
    progress: number,
    continuousValue: number,
  ): void {
    const isUnranked: boolean = rankName === "Unranked";
    const rankClass: string = isUnranked
      ? "rank-name unranked-text"
      : "rank-name";

    container.innerHTML = `
      <span class="${rankClass}">${rankName}</span>
      <span class="rank-progress">${continuousValue === 0 ? "" : `+${progress}%`}</span>
    `;
  }

  /**
   * Creates a rank badge for a scenario and score.
   *
   * @param scenario - The benchmark scenario data.
   * @param score - The score to calculate the rank for.
   * @returns The created HTMLElement for the rank badge.
   */
  private _createRankBadge(
    scenario: BenchmarkScenario,
    score: number,
  ): HTMLElement {
    const badgeContainer: HTMLDivElement = document.createElement("div");
    badgeContainer.className = "rank-badge-container";

    const badgeContent: HTMLDivElement = document.createElement("div");
    badgeContent.className = "badge-content";

    this._fillBadgeContent(badgeContent, scenario, score);
    badgeContainer.appendChild(badgeContent);

    return badgeContainer;
  }

  /**
   * Fills the content of a rank badge.
   *
   * @param container - The HTMLElement to fill with content.
   * @param scenario - The benchmark scenario data.
   * @param score - The score to calculate the rank for.
   */
  private _fillBadgeContent(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    score: number,
  ): void {
    const isOverrideActive = this._cosmeticOverrideService.isActiveFor(this._currentDifficulty);

    if (score === 0 && !isOverrideActive) {
      container.innerHTML = `
        <span class="rank-name unranked-text">Unranked</span>
        <span class="rank-progress"></span>
      `;

      return;
    }

    const calculatedRank = this._cosmeticOverrideService.isActiveFor(this._currentDifficulty)
      ? this._cosmeticOverrideService.getFakeRankResult(this._currentDifficulty)
      : this._rankService.calculateRank(score, scenario);

    const isUnranked: boolean = calculatedRank.currentRank === "Unranked";
    const rankClass: string = isUnranked
      ? "rank-name unranked-text"
      : "rank-name";

    container.innerHTML = `
      <span class="${rankClass}">${calculatedRank.currentRank}</span>
      <span class="rank-progress">+${calculatedRank.progressPercentage}%</span>
    `;
  }

  /**
   * Creates a play button for a scenario.
   *
   * @param scenarioName - The name of the scenario.
   * @returns The created HTMLButtonElement for the play button.
   */
  private _createPlayButton(scenarioName: string): HTMLElement {
    const playButton: HTMLButtonElement = document.createElement("button");
    playButton.className = "play-scenario-button";

    playButton.appendChild(this._createLaunchSocket());
    playButton.appendChild(this._createLaunchTriangle());
    playButton.appendChild(this._createLaunchDot());

    const { container: progressContainer, bar: progressBar } =
      this._createLaunchProgressBar();
    playButton.appendChild(progressContainer);

    this._setupHoldInteractions(playButton, progressBar, scenarioName);

    return playButton;
  }

  /**
   * Creates the socket part of the launch button animation.
   *
   * @returns The created HTMLDivElement for the launch socket.
   */
  private _createLaunchSocket(): HTMLElement {
    const socket: HTMLDivElement = document.createElement("div");
    socket.className = "launch-socket";

    return socket;
  }

  /**
   * Creates the triangle part of the launch button animation.
   *
   * @returns The created HTMLDivElement for the launch triangle.
   */
  private _createLaunchTriangle(): HTMLElement {
    const triangle: HTMLDivElement = document.createElement("div");
    triangle.className = "launch-triangle";

    return triangle;
  }

  /**
   * Creates the dot part of the launch button animation.
   *
   * @returns The created HTMLDivElement for the launch dot.
   */
  private _createLaunchDot(): HTMLElement {
    const dot: HTMLDivElement = document.createElement("div");
    dot.className = "launch-dot";

    return dot;
  }

  /**
   * Creates the progress bar for the launch button.
   *
   * @returns An object containing the container and the progress bar HTMLElement.
   */
  private _createLaunchProgressBar(): {
    container: HTMLElement;
    bar: HTMLElement;
  } {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "launch-progress-container";

    const bar: HTMLDivElement = document.createElement("div");
    bar.className = "launch-progress-bar";

    container.appendChild(bar);

    return { container, bar };
  }

  private static readonly _holdDuration: number = 600;

  private static readonly _tickRate: number = 20;

  private static readonly _depleteStep: number =
    100 / (BenchmarkRowRenderer._holdDuration / BenchmarkRowRenderer._tickRate);

  private static readonly _regenStep: number =
    BenchmarkRowRenderer._depleteStep * 2;

  /**
   * Sets up hold interaction listeners for the play button.
   *
   * @param button - The play button HTMLElement.
   * @param progressBar - The progress bar HTMLElement.
   * @param scenarioName - The name of the scenario.
   */
  private _setupHoldInteractions(
    button: HTMLElement,
    progressBar: HTMLElement,
    scenarioName: string,
  ): void {
    const state: LaunchHoldState = {
      progress: 100,
      holdInterval: null,
      regenInterval: null,
      fadeTimeout: null,
      button,
      progressBar,
      scenarioName,
      tickCount: 0,
    };

    button.addEventListener("mousedown", (event: MouseEvent): void => {
      this._startHold(event, state);
    });

    const onRelease = (event: MouseEvent): void => {
      this._stopHold(event, state);
    };

    button.addEventListener("mouseup", onRelease);
    button.addEventListener("mouseleave", onRelease);
    button.addEventListener("click", (event: MouseEvent): void => {
      event.stopPropagation();
    });
  }

  private _startHold(event: MouseEvent, state: LaunchHoldState): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    this._clearHoldTimers(state);

    state.button.classList.add("holding");
    state.holdInterval = window.setInterval((): void => {
      this._tickHold(state);
    }, BenchmarkRowRenderer._tickRate);
  }

  private _tickHold(state: LaunchHoldState): void {
    state.progress -= BenchmarkRowRenderer._depleteStep;

    if (state.progress <= 0) {
      state.progress = 0;
      this._finishHold(state);
    }

    this._playHoldSoundIfNecessary(state);
    this._updateHoldVisuals(state);
  }

  private _playHoldSoundIfNecessary(state: LaunchHoldState): void {
    if (state.progress <= 0) {
      return;
    }

    if (state.tickCount % 2 === 0) {
      this._audioService.playLight(0.7);
    }

    state.tickCount++;
  }

  private _stopHold(event: MouseEvent, state: LaunchHoldState): void {
    if (state.holdInterval === null) {
      return;
    }

    event.stopPropagation();
    clearInterval(state.holdInterval);
    state.holdInterval = null;

    if (state.progress < 100) {
      state.tickCount = 0;
      this._startRegen(state);
    } else {
      state.button.classList.remove("holding");
      this._updateHoldVisuals(state, true);
    }
  }

  private _startRegen(state: LaunchHoldState): void {
    if (state.regenInterval !== null) {
      return;
    }

    state.regenInterval = window.setInterval((): void => {
      this._tickRegen(state);
    }, BenchmarkRowRenderer._tickRate);
  }

  private _tickRegen(state: LaunchHoldState): void {
    state.progress += BenchmarkRowRenderer._regenStep;

    if (state.progress >= 100) {
      this._completeRegen(state);
    }

    this._updateHoldVisuals(state);
  }

  private _completeRegen(state: LaunchHoldState): void {
    state.progress = 100;

    if (state.regenInterval !== null) {
      clearInterval(state.regenInterval);
      state.regenInterval = null;
    }

    state.button.classList.remove("holding");
    this._scheduleFade(state);
  }

  private _finishHold(state: LaunchHoldState): void {
    this._clearHoldTimers(state);

    state.button.classList.remove("holding");
    state.button.classList.add("highlighted");

    this._audioService.playHeavy(1.0);
    this._launchKovaksScenario(state.scenarioName);

    if (this._onScenarioLaunch) {
      this._onScenarioLaunch(state.scenarioName);
    }

    window.setTimeout((): void => {
      this._resetAfterLaunch(state);
    }, 1000);
  }

  private _resetAfterLaunch(state: LaunchHoldState): void {
    state.button.classList.remove("highlighted");

    if (!state.button.classList.contains("holding")) {
      state.progress = 100;
      this._updateHoldVisuals(state);
      this._scheduleFade(state);
    }
  }

  private _updateHoldVisuals(
    state: LaunchHoldState,
    forceImmediateFade: boolean = false,
  ): void {
    const scale: number = state.progress / 100;
    state.progressBar.style.transform = `scaleX(${scale})`;

    if (state.progress < 100) {
      this._cancelFade(state);
      state.button.classList.add("not-full");
    } else if (forceImmediateFade) {
      this._cancelFade(state);
      state.button.classList.remove("not-full");
    }
  }

  private _scheduleFade(state: LaunchHoldState): void {
    this._cancelFade(state);

    state.fadeTimeout = window.setTimeout((): void => {
      state.button.classList.remove("not-full");
      state.fadeTimeout = null;
    }, 300);
  }

  private _cancelFade(state: LaunchHoldState): void {
    if (state.fadeTimeout !== null) {
      clearTimeout(state.fadeTimeout);
      state.fadeTimeout = null;
    }
  }

  private _clearHoldTimers(state: LaunchHoldState): void {
    this._cancelFade(state);

    if (state.holdInterval !== null) {
      clearInterval(state.holdInterval);
      state.holdInterval = null;
    }

    if (state.regenInterval !== null) {
      clearInterval(state.regenInterval);
      state.regenInterval = null;
    }
  }

  private _launchKovaksScenario(scenarioName: string): void {
    const encodedName: string = encodeURIComponent(scenarioName);
    const steamLaunchUrl: string = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;

    window.location.href = steamLaunchUrl;
  }
}

interface LaunchHoldState {
  progress: number;
  holdInterval: number | null;
  regenInterval: number | null;
  fadeTimeout: number | null;
  button: HTMLElement;
  progressBar: HTMLElement;
  scenarioName: string;
  tickCount: number;
}
