import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { DotCloudComponent } from "../visualizations/DotCloudComponent";
import { ScoreEntry } from "../visualizations/ScoreProcessor";

/**
 * Responsible for rendering a single row within the benchmark table.
 */
export class BenchmarkRowRenderer {
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _sessionService: SessionService;
  private _visualSettings: VisualSettings;
  private readonly _dotCloudRegistry: Map<string, DotCloudComponent> =
    new Map();
  private _loadCounter: number = 0;

  /**
   * Initializes the renderer with required services.
   *
   * @param historyService - Service for fetching score history.
   * @param rankService - Service for calculating ranks and progress.
   * @param sessionService - Service for session-specific highscores.
   * @param visualSettings - Current visual configuration.
   */
  public constructor(
    historyService: HistoryService,
    rankService: RankService,
    sessionService: SessionService,
    visualSettings: VisualSettings,
  ) {
    this._historyService = historyService;
    this._rankService = rankService;
    this._sessionService = sessionService;
    this._visualSettings = visualSettings;
  }

  /**
   * Renders a complete row element for a scenario.
   *
   * @param scenario - The benchmark scenario data.
   * @param highscore - The all-time highscore for this scenario.
   * @returns The constructed row HTMLElement.
   */
  public renderRow(
    scenario: BenchmarkScenario,
    highscore: number,
  ): HTMLElement {
    const rowElement: HTMLElement = document.createElement("div");
    rowElement.className = "scenario-row";
    rowElement.setAttribute("data-scenario-name", scenario.name);

    rowElement.appendChild(this._createNameCell(scenario.name));

    if (this._visualSettings.showDotCloud) {
      rowElement.appendChild(this._createDotCloudCell(scenario));
    }

    if (this._visualSettings.showAllTimeBest) {
      rowElement.appendChild(this._createRankBadge(scenario, highscore));
    }

    if (this._visualSettings.showSessionBest) {
      rowElement.appendChild(this._createSessionRankBadge(scenario));
    }

    rowElement.appendChild(this._createPlayButton(scenario.name));

    rowElement.addEventListener("click", (): void => {
      rowElement.classList.toggle("selected");
      this._dotCloudRegistry.get(scenario.name)?.requestUpdate();
    });

    return rowElement;
  }

  /**
   * Cleans up all active dot cloud components managed by this renderer.
   */
  public destroyAll(): void {
    this._dotCloudRegistry.forEach((component: DotCloudComponent): void => {
      component.destroy();
    });

    this._dotCloudRegistry.clear();
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
   * @param highscore - The current all-time highscore.
   */
  public updateRow(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
    highscore: number,
  ): void {
    this._updateRankBadges(rowElement, scenario, highscore);
    this._updateDotCloud(scenario);
  }

  private _updateRankBadges(
    rowElement: HTMLElement,
    scenario: BenchmarkScenario,
    highscore: number,
  ): void {
    const allTimeBadge: HTMLElement | null = rowElement.querySelector(
      ".rank-badge-container:not(.session-badge) .badge-content",
    );

    if (allTimeBadge) {
      this._fillBadgeContent(allTimeBadge, scenario, highscore);
    }

    this._updateSessionBadge(rowElement, scenario);
  }

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
    sessionBadge.style.visibility =
      bestScore === 0 || !isSessionActive ? "hidden" : "visible";
  }

  private _updateDotCloud(scenario: BenchmarkScenario): void {
    const component: DotCloudComponent | undefined = this._dotCloudRegistry.get(
      scenario.name,
    );
    if (component) {
      this._refreshComponentData(component, scenario);
    }
  }

  private _refreshComponentData(
    component: DotCloudComponent,
    scenario: BenchmarkScenario,
  ): void {
    this._historyService
      .getLastScores(scenario.name, 100)
      .then((entries: ScoreEntry[]): void => {
        const sessionStart: number | null =
          this._sessionService.sessionStartTimestamp;
        const isLatestInSession: boolean =
          sessionStart !== null &&
          entries.length > 0 &&
          entries[0].timestamp >= sessionStart;

        component.updateData(
          entries,
          scenario.thresholds,
          isLatestInSession,
          this._calculateAverageRankInterval(scenario),
        );
      });
  }

  private _createNameCell(scenarioName: string): HTMLElement {
    const nameSpan: HTMLSpanElement = document.createElement("span");
    nameSpan.className = "scenario-name";
    nameSpan.textContent = scenarioName;

    return nameSpan;
  }

  private _createDotCloudCell(scenario: BenchmarkScenario): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "dot-cloud-container";

    const loadId: number = ++this._loadCounter;
    container.dataset.loadId = loadId.toString();

    this._setupLazyLoading(container, scenario, loadId);

    return container;
  }

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
            this._loadDotCloudData(container, scenario, loadId);
          }
        });
      },
      { rootMargin: "200px" },
    );

    observer.observe(container);
  }

  private _loadDotCloudData(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    loadId: number,
  ): void {
    this._historyService
      .getLastScores(scenario.name, 100)
      .then((entries: ScoreEntry[]): void => {
        const currentId: string | undefined = container.dataset.loadId;

        if (entries.length > 0 && currentId === loadId.toString()) {
          this._injectDotCloudVisualization(container, scenario, entries);
        }
      });
  }

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
    if (bestScore === 0 || !isSessionActive) {
      badgeElement.style.visibility = "hidden";
    }

    badgeElement.classList.add("session-badge");

    return badgeElement;
  }

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

  private _fillBadgeContent(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    score: number,
  ): void {
    if (score === 0) {
      container.innerHTML = `
        <span class="rank-name unranked-text">Unranked</span>
        <span class="rank-progress"></span>
      `;

      return;
    }

    const calculatedRank = this._rankService.calculateRank(score, scenario);
    const isUnranked: boolean = calculatedRank.currentRank === "Unranked";
    const rankClass: string = isUnranked
      ? "rank-name unranked-text"
      : "rank-name";

    container.innerHTML = `
      <span class="${rankClass}">${calculatedRank.currentRank}</span>
      <span class="rank-progress">+${calculatedRank.progressPercentage}%</span>
    `;
  }

  private _createPlayButton(scenarioName: string): HTMLElement {
    const playButton: HTMLButtonElement = document.createElement("button");
    playButton.className = "play-scenario-button";
    playButton.title = `Launch ${scenarioName}`;

    playButton.addEventListener("click", (event: MouseEvent): void => {
      event.stopPropagation();
      this._launchKovaksScenario(scenarioName);
    });

    return playButton;
  }

  private _launchKovaksScenario(scenarioName: string): void {
    const encodedName: string = encodeURIComponent(scenarioName);
    const steamLaunchUrl: string = `steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`;

    window.location.href = steamLaunchUrl;
  }
}
