import { BenchmarkDifficulty } from "../data/benchmarks";
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

    scenarios.forEach((scenarioName) => {
      table.appendChild(this._createScenarioRow(scenarioName));
    });

    return table;
  }

  private _createScenarioRow(scenarioName: string): HTMLElement {
    const row = document.createElement("div");

    row.className = "benchmark-row";

    row.appendChild(this._createNameCell(scenarioName));

    row.appendChild(this._createPlaceholderStatsCell());

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
