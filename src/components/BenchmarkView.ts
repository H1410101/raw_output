import { BenchmarkDifficulty, BenchmarkScenario } from "../data/benchmarks";
import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";

/**
 * Handles the rendering and interaction logic for the Benchmark scenarios list.
 * Responsibility: Display scenarios filtered by difficulty and manage tab switching.
 */
export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;

  private readonly _benchmarkService: BenchmarkService;

  private readonly _historyService: HistoryService;

  private readonly _rankService: RankService;

  private _activeDifficulty: BenchmarkDifficulty = "Easier";

  constructor(
    mountPoint: HTMLElement,
    benchmarkService: BenchmarkService,
    historyService: HistoryService,
    rankService: RankService,
  ) {
    this._mountPoint = mountPoint;

    this._benchmarkService = benchmarkService;

    this._historyService = historyService;

    this._rankService = rankService;
  }

  /**
   * Clears the mount point and renders the benchmark interface.
   */
  public async render(): Promise<void> {
    const scenarios = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );

    const highscores = await this._historyService.getBatchHighscores(
      scenarios.map((s) => s.name),
    );

    this._mountPoint.innerHTML = "";

    this._mountPoint.appendChild(
      this._createViewContainer(scenarios, highscores),
    );

    this._setupStickyCentering();
  }

  private _setupStickyCentering(): void {
    const table = this._mountPoint.querySelector(".benchmark-table");

    if (!table) return;

    table.addEventListener("scroll", () =>
      this._updateLabelPositions(table as HTMLElement),
    );

    this._updateLabelPositions(table as HTMLElement);
  }

  private _updateLabelPositions(scrollContainer: HTMLElement): void {
    const labels = this._mountPoint.querySelectorAll(
      ".category-label .vertical-text",
    ) as NodeListOf<HTMLElement>;

    const containerRect = scrollContainer.getBoundingClientRect();

    labels.forEach((label) => {
      this._updateSingleLabelPosition(label, containerRect);
    });
  }

  private _updateSingleLabelPosition(
    label: HTMLElement,
    containerRect: DOMRect,
  ): void {
    const track = label.parentElement;

    if (!track) return;

    const trackRect = track.getBoundingClientRect();

    if (this._isTrackSmallerThanLabel(trackRect, label)) {
      this._centerLabelInTrack(label);

      return;
    }

    this._stickLabelToVisibleCenter(label, trackRect, containerRect);
  }

  private _isTrackSmallerThanLabel(
    trackRect: DOMRect,
    label: HTMLElement,
  ): boolean {
    return trackRect.height <= label.offsetHeight;
  }

  private _centerLabelInTrack(label: HTMLElement): void {
    label.style.top = "50%";
  }

  private _stickLabelToVisibleCenter(
    label: HTMLElement,
    trackRect: DOMRect,
    containerRect: DOMRect,
  ): void {
    const visibleTop = Math.max(trackRect.top, containerRect.top);

    const visibleBottom = Math.min(trackRect.bottom, containerRect.bottom);

    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    const visibleCenterY = visibleTop + visibleHeight / 2;

    const relativeCenter = visibleCenterY - trackRect.top;

    this._applyClampedLabelPosition(label, relativeCenter, trackRect.height);
  }

  private _applyClampedLabelPosition(
    label: HTMLElement,
    targetY: number,
    trackHeight: number,
  ): void {
    const labelHalfHeight = label.offsetHeight / 2;

    const minTop = labelHalfHeight;

    const maxTop = trackHeight - labelHalfHeight;

    const clampedTop = Math.max(minTop, Math.min(maxTop, targetY));

    label.style.top = `${clampedTop}px`;
  }

  private _createViewContainer(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "benchmark-view-container";

    container.appendChild(this._createDifficultyTabs());

    container.appendChild(this._createScenarioTable(scenarios, highscores));

    return container;
  }

  private _createDifficultyTabs(): HTMLElement {
    const tabsContainer = document.createElement("div");

    tabsContainer.className = "difficulty-tabs";

    const difficulties: BenchmarkDifficulty[] = ["Easier", "Medium", "Hard"];

    difficulties.forEach((difficulty) => {
      tabsContainer.appendChild(this._createTab(difficulty));
    });

    return tabsContainer;
  }

  private _createTab(difficulty: BenchmarkDifficulty): HTMLButtonElement {
    const tab = document.createElement("button");

    const isActive = this._activeDifficulty === difficulty;

    tab.className = `tab-button ${isActive ? "active" : ""}`;

    tab.textContent = difficulty;

    tab.addEventListener("click", () => {
      this._handleDifficultyChange(difficulty);
    });

    return tab;
  }

  private async _handleDifficultyChange(
    difficulty: BenchmarkDifficulty,
  ): Promise<void> {
    this._activeDifficulty = difficulty;

    await this.render();
  }

  private _createScenarioTable(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const table = document.createElement("div");

    table.className = "benchmark-table";

    this._appendCategorizedScenarios(table, scenarios, highscores);

    return table;
  }

  private _appendCategorizedScenarios(
    table: HTMLElement,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    const groups = this._groupScenarios(scenarios);

    groups.forEach((subgroups, category) => {
      table.appendChild(
        this._createCategoryGroup(category, subgroups, highscores),
      );
    });
  }

  private _groupScenarios(
    scenarios: BenchmarkScenario[],
  ): Map<string, Map<string, BenchmarkScenario[]>> {
    const groups = new Map<string, Map<string, BenchmarkScenario[]>>();

    scenarios.forEach((scenario) => {
      if (!groups.has(scenario.category)) {
        groups.set(scenario.category, new Map());
      }

      const categoryMap = groups.get(scenario.category)!;

      if (!categoryMap.has(scenario.subcategory)) {
        categoryMap.set(scenario.subcategory, []);
      }

      categoryMap.get(scenario.subcategory)!.push(scenario);
    });

    return groups;
  }

  private _createCategoryGroup(
    category: string,
    subgroups: Map<string, BenchmarkScenario[]>,
    highscores: Record<string, number>,
  ): HTMLElement {
    const categoryGroup = document.createElement("div");

    categoryGroup.className = "benchmark-category-group";

    categoryGroup.appendChild(this._createVerticalLabel(category, "category"));

    const subcategoryContainer = document.createElement("div");

    subcategoryContainer.className = "subcategory-container";

    subgroups.forEach((scenarios, subcategory) => {
      subcategoryContainer.appendChild(
        this._createSubcategoryGroup(subcategory, scenarios, highscores),
      );
    });

    categoryGroup.appendChild(subcategoryContainer);

    return categoryGroup;
  }

  private _createSubcategoryGroup(
    subcategory: string,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const subcategoryGroup = document.createElement("div");

    subcategoryGroup.className = "benchmark-subcategory-group";

    subcategoryGroup.appendChild(
      this._createVerticalLabel(subcategory, "subcategory"),
    );

    const scenarioList = document.createElement("div");

    scenarioList.className = "scenario-list";

    scenarios.forEach((scenario) => {
      const highscore = highscores[scenario.name] || 0;

      scenarioList.appendChild(this._createScenarioRow(scenario, highscore));
    });

    subcategoryGroup.appendChild(scenarioList);

    return subcategoryGroup;
  }

  private _createVerticalLabel(
    text: string,
    type: "category" | "subcategory",
  ): HTMLElement {
    const labelContainer = document.createElement("div");

    labelContainer.className = `vertical-label-container ${type}-label`;

    const labelText = document.createElement("span");

    labelText.className = "vertical-text";

    labelText.textContent = text;

    labelContainer.appendChild(labelText);

    return labelContainer;
  }

  private _createScenarioRow(
    scenario: BenchmarkScenario,
    highscore: number,
  ): HTMLElement {
    const row = document.createElement("div");

    row.className = "benchmark-row";

    row.appendChild(this._createNameCell(scenario.name));

    row.appendChild(this._createRankBadge(scenario, highscore));

    row.addEventListener("click", () => {
      row.classList.toggle("selected");
    });

    return row;
  }

  private _createNameCell(scenarioName: string): HTMLElement {
    const nameSpan = document.createElement("span");

    nameSpan.className = "scenario-name";

    nameSpan.textContent = scenarioName;

    return nameSpan;
  }

  private _createRankBadge(
    scenario: BenchmarkScenario,
    score: number,
  ): HTMLElement {
    const badge = document.createElement("div");

    badge.className = "rank-badge-container";

    if (score === 0) {
      badge.innerHTML = `<span class="unranked-text">Unranked</span>`;

      return badge;
    }

    const rank = this._rankService.calculateRank(score, scenario);

    badge.innerHTML = `
      <span class="rank-name">${rank.currentRank}</span>
      <span class="rank-progress">+${rank.progressPercentage}%</span>
    `;

    return badge;
  }
}
