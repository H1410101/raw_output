import { BenchmarkDifficulty, BenchmarkScenario } from "../data/benchmarks";
import { BenchmarkService } from "../services/BenchmarkService";

/**
 * Handles the rendering and interaction logic for the Benchmark scenarios list.
 * Responsibility: Display scenarios filtered by difficulty and manage tab switching.
 */
export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;

  private readonly _benchmarkService: BenchmarkService;

  private _activeDifficulty: BenchmarkDifficulty = "Easier";

  constructor(mountPoint: HTMLElement, benchmarkService: BenchmarkService) {
    this._mountPoint = mountPoint;

    this._benchmarkService = benchmarkService;
  }

  /**
   * Clears the mount point and renders the benchmark interface.
   */
  public render(): void {
    this._mountPoint.innerHTML = "";

    this._mountPoint.appendChild(this._createViewContainer());

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
      const track = label.parentElement;

      if (!track) return;

      const trackRect = track.getBoundingClientRect();

      const visibleTop = Math.max(trackRect.top, containerRect.top);

      const visibleBottom = Math.min(trackRect.bottom, containerRect.bottom);

      const visibleHeight = visibleBottom - visibleTop;

      if (visibleHeight <= 0) return;

      const visibleCenterY = visibleTop + visibleHeight / 2;

      const relativeCenter = visibleCenterY - trackRect.top;

      const labelHalfHeight = label.offsetHeight / 2;

      const minTop = labelHalfHeight;

      const maxTop = trackRect.height - labelHalfHeight;

      const clampedTop = Math.max(minTop, Math.min(maxTop, relativeCenter));

      label.style.top = `${clampedTop}px`;
    });
  }

  private _createViewContainer(): HTMLElement {
    const container = document.createElement("div");

    container.className = "benchmark-view-container";

    container.appendChild(this._createDifficultyTabs());

    container.appendChild(this._createScenarioTable());

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

  private _handleDifficultyChange(difficulty: BenchmarkDifficulty): void {
    this._activeDifficulty = difficulty;

    this.render();
  }

  private _createScenarioTable(): HTMLElement {
    const table = document.createElement("div");

    table.className = "benchmark-table";

    const scenarios = this._benchmarkService.getScenarios(
      this._activeDifficulty,
    );

    this._appendCategorizedScenarios(table, scenarios);

    return table;
  }

  private _appendCategorizedScenarios(
    table: HTMLElement,
    scenarios: BenchmarkScenario[],
  ): void {
    const groups = this._groupScenarios(scenarios);

    groups.forEach((subgroups, category) => {
      table.appendChild(this._createCategoryGroup(category, subgroups));
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
  ): HTMLElement {
    const categoryGroup = document.createElement("div");

    categoryGroup.className = "benchmark-category-group";

    categoryGroup.appendChild(this._createVerticalLabel(category, "category"));

    const subcategoryContainer = document.createElement("div");

    subcategoryContainer.className = "subcategory-container";

    subgroups.forEach((scenarios, subcategory) => {
      subcategoryContainer.appendChild(
        this._createSubcategoryGroup(subcategory, scenarios),
      );
    });

    categoryGroup.appendChild(subcategoryContainer);

    return categoryGroup;
  }

  private _createSubcategoryGroup(
    subcategory: string,
    scenarios: BenchmarkScenario[],
  ): HTMLElement {
    const subcategoryGroup = document.createElement("div");

    subcategoryGroup.className = "benchmark-subcategory-group";

    subcategoryGroup.appendChild(
      this._createVerticalLabel(subcategory, "subcategory"),
    );

    const scenarioList = document.createElement("div");

    scenarioList.className = "scenario-list";

    scenarios.forEach((scenario) => {
      scenarioList.appendChild(this._createScenarioRow(scenario));
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

  private _createScenarioRow(scenario: BenchmarkScenario): HTMLElement {
    const row = document.createElement("div");

    row.className = "benchmark-row";

    row.appendChild(this._createNameCell(scenario.name));

    row.appendChild(this._createPlaceholderStatsCell());

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

  private _createPlaceholderStatsCell(): HTMLElement {
    const statsSpan = document.createElement("span");

    statsSpan.className = "scenario-stats-placeholder";

    statsSpan.textContent = "--";

    return statsSpan;
  }
}
