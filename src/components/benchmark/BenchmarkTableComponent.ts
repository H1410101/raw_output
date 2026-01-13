import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { AppStateService } from "../../services/AppStateService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { FocusManagementService } from "../../services/FocusManagementService";
import { BenchmarkRowRenderer } from "./BenchmarkRowRenderer";
import { BenchmarkScrollController } from "./BenchmarkScrollController";
import { BenchmarkLabelPositioner } from "./BenchmarkLabelPositioner";
import { ScenarioNameWidthManager } from "./ScenarioNameWidthManager";
import { AudioService } from "../../services/AudioService";
import { SCALING_FACTORS } from "../../services/ScalingService";
import { RankEstimator } from "../../services/RankEstimator";

/**
 * Collection of services and settings required for BenchmarkTableComponent.
 */
export interface BenchmarkTableDependencies {
  readonly historyService: HistoryService;
  readonly rankService: RankService;
  readonly sessionService: SessionService;
  readonly appStateService: AppStateService;
  readonly visualSettings: VisualSettings;
  readonly audioService: AudioService;
  readonly focusService: FocusManagementService;
  readonly rankEstimator: RankEstimator;
}

/**
 * Orchestrates the rendering of the benchmark table, including categorization and custom scrolling.
 */
export class BenchmarkTableComponent {
  private _visualSettings: VisualSettings;
  private readonly _rowRenderer: BenchmarkRowRenderer;
  private readonly _appStateService: AppStateService;
  private readonly _rowElements: Map<string, HTMLElement> = new Map();
  private _labelPositioner: BenchmarkLabelPositioner | null = null;
  private readonly _nameWidthManager: ScenarioNameWidthManager;
  private readonly _audioService: AudioService;
  private _difficulty: string = "Advanced";

  /**
   * Initializes the table component with required services and settings.
   *
   * @param dependencies - Object containing required services and visual configuration.
   */
  public constructor(dependencies: BenchmarkTableDependencies) {
    this._visualSettings = dependencies.visualSettings;
    this._appStateService = dependencies.appStateService;
    this._audioService = dependencies.audioService;
    this._rowRenderer = new BenchmarkRowRenderer({
      historyService: dependencies.historyService,
      rankService: dependencies.rankService,
      sessionService: dependencies.sessionService,
      audioService: dependencies.audioService,
      visualSettings: dependencies.visualSettings,
      rankEstimator: dependencies.rankEstimator,
    });
    this._nameWidthManager = new ScenarioNameWidthManager();
  }

  /**
   * Renders the complete benchmark table structure.
   *
   * @param scenarios - The list of scenarios to display.
   * @param highscores - A map of all-time highscores.
   * @param difficulty
   * @returns The root container of the table.
   */
  public render(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
    difficulty: string = "Advanced",
  ): HTMLElement {
    this._difficulty = difficulty;
    const tableContainer: HTMLDivElement = document.createElement("div");
    const scrollArea: HTMLDivElement = document.createElement("div");
    const scrollThumb: HTMLDivElement = document.createElement("div");

    tableContainer.className = "benchmark-table-container pane-container";
    scrollArea.className = "benchmark-table";
    scrollThumb.className = "custom-scroll-thumb";

    this._clearExistingRows();
    this._updateNameColumnWidth(scenarios);
    this._appendCategorizedContent(scrollArea, scenarios, highscores);
    this._initializeControllers(tableContainer, scrollArea, scrollThumb);
    this._restoreScrollPosition(scrollArea);

    tableContainer.appendChild(scrollArea);
    tableContainer.appendChild(scrollThumb);

    return tableContainer;
  }

  /**
   * Cleans up resources, including row references and any active controllers.
   */
  public destroy(): void {
    this._rowRenderer.destroyAll();
    this._labelPositioner?.destroy();
    this._clearExistingRows();
  }

  /**
   * Removes all row references to allow for garbage collection.
   */
  private _clearExistingRows(): void {
    this._rowElements.clear();
  }

  /**
   * Updates all rows with new visual settings without re-rendering the entire table.
   *
   * @param settings - The new visual settings.
   * @returns True if a full re-render is required due to structural changes.
   */
  public updateVisualSettings(settings: VisualSettings): boolean {
    const structuralChange: boolean =
      this._visualSettings.showDotCloud !== settings.showDotCloud ||
      this._visualSettings.showSessionBest !== settings.showSessionBest ||
      this._visualSettings.showAllTimeBest !== settings.showAllTimeBest ||
      this._visualSettings.scenarioFontSize !== settings.scenarioFontSize ||
      this._visualSettings.uiScaling !== settings.uiScaling ||
      this._visualSettings.categorySpacing !== settings.categorySpacing;

    if (structuralChange) {
      return true;
    }

    this._visualSettings = settings;
    this._rowRenderer.updateVisualSettings(settings);

    return false;
  }

  /**
   * Updates a specific scenario row with new data.
   *
   * @param scenario - The scenario data.
   * @param highscore - The current highscore.
   */
  public updateScenarioRow(
    scenario: BenchmarkScenario,
    highscore: number,
  ): void {
    const row: HTMLElement | undefined = this._rowElements.get(scenario.name);
    if (row) {
      this._rowRenderer.updateRow(row, scenario, highscore, this._difficulty);
    }
  }

  /**
   * Focuses and scrolls to a specific scenario row.
   *
   * @param scenarioName - The name of the scenario to focus.
   * @param behavior - The scroll behavior (smooth or instant).
   */
  public focusScenario(
    scenarioName: string,
    behavior: ScrollBehavior = "smooth",
  ): void {
    const row: HTMLElement | undefined = this._rowElements.get(scenarioName);
    if (row) {
      row.scrollIntoView({ behavior, block: "center" });
      this._applyFocusHighlight(row);
    }
  }

  private _updateNameColumnWidth(scenarios: BenchmarkScenario[]): void {
    const multiplier: number =
      SCALING_FACTORS[this._visualSettings.scenarioFontSize] || 1.0;
    const widthRem: number = this._nameWidthManager.calculateRequiredWidth(
      scenarios,
      multiplier,
    );
    this._nameWidthManager.applyWidth(widthRem);
  }

  private _applyFocusHighlight(row: HTMLElement): void {
    row.classList.add("focused-scenario");
    setTimeout((): void => {
      row.classList.remove("focused-scenario");
    }, 2000);
  }

  private _initializeControllers(
    container: HTMLElement,
    scrollArea: HTMLElement,
    thumb: HTMLElement,
  ): void {
    const controller: BenchmarkScrollController =
      new BenchmarkScrollController({
        scrollContainer: scrollArea,
        scrollThumb: thumb,
        hoverContainer: container,
        appStateService: this._appStateService,
        audioService: this._audioService,
      });

    controller.initialize();
    this._labelPositioner = new BenchmarkLabelPositioner(scrollArea);
    this._labelPositioner.initialize();
  }

  private _restoreScrollPosition(scrollArea: HTMLElement): void {
    const savedScrollTop: number =
      this._appStateService.getBenchmarkScrollTop();
    requestAnimationFrame((): void => {
      scrollArea.scrollTop = savedScrollTop;
    });
  }

  private _appendCategorizedContent(
    container: HTMLElement,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    const scenarioGroups: Map<
      string,
      Map<string, BenchmarkScenario[]>
    > = this._groupScenariosByCategory(scenarios);

    scenarioGroups.forEach(
      (
        subcategories: Map<string, BenchmarkScenario[]>,
        categoryName: string,
      ): void => {
        const categoryElement: HTMLElement = this._createCategoryGroup(
          categoryName,
          subcategories,
          highscores,
        );
        container.appendChild(categoryElement);
      },
    );
  }

  private _groupScenariosByCategory(
    scenarios: BenchmarkScenario[],
  ): Map<string, Map<string, BenchmarkScenario[]>> {
    const categoryMap: Map<
      string,
      Map<string, BenchmarkScenario[]>
    > = new Map();

    scenarios.forEach((scenario: BenchmarkScenario): void => {
      if (!categoryMap.has(scenario.category)) {
        categoryMap.set(scenario.category, new Map());
      }

      const subcategoryMap: Map<string, BenchmarkScenario[]> = categoryMap.get(
        scenario.category,
      )!;

      if (!subcategoryMap.has(scenario.subcategory)) {
        subcategoryMap.set(scenario.subcategory, []);
      }

      subcategoryMap.get(scenario.subcategory)!.push(scenario);
    });

    return categoryMap;
  }

  private _createCategoryGroup(
    name: string,
    subcategories: Map<string, BenchmarkScenario[]>,
    highscores: Record<string, number>,
  ): HTMLElement {
    const groupElement: HTMLDivElement = document.createElement("div");
    const subcategoryContainer: HTMLDivElement = document.createElement("div");

    groupElement.className = "benchmark-category-group";
    subcategoryContainer.className = "subcategory-container";

    groupElement.appendChild(this._createVerticalLabel(name, "category"));
    this._appendSubcategories(subcategoryContainer, subcategories, highscores);
    groupElement.appendChild(subcategoryContainer);

    return groupElement;
  }

  private _appendSubcategories(
    container: HTMLElement,
    subcategories: Map<string, BenchmarkScenario[]>,
    highscores: Record<string, number>,
  ): void {
    subcategories.forEach(
      (scenarios: BenchmarkScenario[], subName: string): void => {
        const subGroup: HTMLElement = this._createSubcategoryGroup(
          subName,
          scenarios,
          highscores,
        );
        container.appendChild(subGroup);
      },
    );
  }

  private _createSubcategoryGroup(
    name: string,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const subGroup: HTMLDivElement = document.createElement("div");
    const listElement: HTMLDivElement = document.createElement("div");

    subGroup.className = "benchmark-subcategory-group";
    listElement.className = "scenario-list";

    subGroup.appendChild(this._createVerticalLabel(name, "subcategory"));
    subGroup.appendChild(this._createSubcategoryHeader());
    this._appendScenarios(listElement, scenarios, highscores);
    subGroup.appendChild(listElement);

    return subGroup;
  }

  private _appendScenarios(
    container: HTMLElement,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    scenarios.forEach((scenario: BenchmarkScenario): void => {
      const score: number = highscores[scenario.name] || 0;
      const row: HTMLElement = this._rowRenderer.renderRow(scenario, score, this._difficulty);

      this._rowElements.set(scenario.name, row);
      container.appendChild(row);
    });
  }

  private _createSubcategoryHeader(): HTMLElement {
    const header: HTMLDivElement = document.createElement("div");
    header.className = "subcategory-header";

    header.appendChild(this._createSpacer("header-name-spacer"));

    if (this._visualSettings.showDotCloud) {
      header.appendChild(this._createSpacer("header-dot-spacer"));
    }

    if (this._visualSettings.showAllTimeBest) {
      header.appendChild(this._createColumnHeader("All-time"));
    }

    if (this._visualSettings.showSessionBest) {
      header.appendChild(this._createColumnHeader("Session"));
    }

    header.appendChild(this._createColumnHeader("Rank"));

    header.appendChild(this._createSpacer("header-action-spacer"));

    return header;
  }

  private _createColumnHeader(text: string): HTMLElement {
    const header: HTMLDivElement = document.createElement("div");
    header.className = "column-header";

    const textSpan: HTMLSpanElement = document.createElement("span");
    textSpan.textContent = text;
    header.appendChild(textSpan);

    return header;
  }

  private _createSpacer(className: string): HTMLElement {
    const spacer: HTMLDivElement = document.createElement("div");
    spacer.className = className;

    return spacer;
  }

  private _createVerticalLabel(
    text: string,
    type: "category" | "subcategory",
  ): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    const span: HTMLSpanElement = document.createElement("span");

    container.className = `vertical-label-container ${type}-label`;
    span.className = "vertical-text";
    span.textContent = text;

    container.appendChild(span);

    return container;
  }
}
