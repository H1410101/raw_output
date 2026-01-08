import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { DotCloudComponent } from "../visualizations/DotCloudComponent";

/**
 * Responsible for rendering a single row within the benchmark table.
 */
export class BenchmarkRowRenderer {
  private readonly _historyService: HistoryService;

  private readonly _rankService: RankService;

  private readonly _sessionService: SessionService;

  private readonly _visualSettings: VisualSettings;

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

    const rowHeightClass: string = `row-height-${this._visualSettings.rowHeight.toLowerCase()}`;

    rowElement.className = `scenario-row ${rowHeightClass}`;

    rowElement.appendChild(this._createNameCell(scenario.name));

    rowElement.appendChild(
      this._createRightContentWrapper(scenario, highscore),
    );

    rowElement.addEventListener("click", (): void => {
      rowElement.classList.toggle("selected");
    });

    return rowElement;
  }

  private _createNameCell(scenarioName: string): HTMLElement {
    const nameSpan: HTMLSpanElement = document.createElement("span");

    nameSpan.className = "scenario-name";

    nameSpan.textContent = scenarioName;

    return nameSpan;
  }

  private _createRightContentWrapper(
    scenario: BenchmarkScenario,
    highscore: number,
  ): HTMLElement {
    const wrapper: HTMLDivElement = document.createElement("div");

    wrapper.className = "row-right-content";

    this._appendVisualizationLayers(wrapper, scenario, highscore);

    wrapper.appendChild(this._createPlayButton(scenario.name));

    return wrapper;
  }

  private _appendVisualizationLayers(
    wrapper: HTMLElement,
    scenario: BenchmarkScenario,
    highscore: number,
  ): void {
    if (this._visualSettings.showDotCloud) {
      wrapper.appendChild(this._createDotCloudCell(scenario));
    }

    if (this._visualSettings.showRankBadges) {
      wrapper.appendChild(this._createRankBadge(scenario, highscore));
    }

    if (this._visualSettings.showSessionBest) {
      wrapper.appendChild(this._createSessionRankBadge(scenario));
    }
  }

  private _createDotCloudCell(scenario: BenchmarkScenario): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "dot-cloud-container";

    this._historyService
      .getLastScores(scenario.name, 100)
      .then((scores: number[]): void => {
        if (scores.length > 0) {
          this._injectDotCloudVisualization(container, scenario, scores);
        }
      });

    return container;
  }

  private _injectDotCloudVisualization(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    scores: number[],
  ): void {
    const averageRankInterval: number =
      this._calculateAverageRankInterval(scenario);

    const dotCloud: DotCloudComponent = new DotCloudComponent(
      scores,
      scenario.thresholds,
      this._visualSettings,
      averageRankInterval,
    );

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
      container.innerHTML = `<span class="unranked-text">Unranked</span>`;

      return;
    }

    const calculatedRank = this._rankService.calculateRank(score, scenario);

    container.innerHTML = `
      <span class="rank-name">${calculatedRank.currentRank}</span>
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
