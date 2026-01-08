import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { BenchmarkRowRenderer } from "./BenchmarkRowRenderer";
import { BenchmarkScrollController } from "./BenchmarkScrollController";
import { BenchmarkLabelPositioner } from "./BenchmarkLabelPositioner";

/**
 * Orchestrates the rendering of the benchmark table, including categorization and custom scrolling.
 */
export class BenchmarkTableComponent {
  private readonly _visualSettings: VisualSettings;

  private readonly _rowRenderer: BenchmarkRowRenderer;

  /**
   * Initializes the table component with required services and settings.
   *
   * @param historyService - Service for fetching historical score data.
   * @param rankService - Service for rank calculations.
   * @param sessionService - Service for tracking session progress.
   * @param visualSettings - The current visual configuration.
   */
  public constructor(
    historyService: HistoryService,
    rankService: RankService,
    sessionService: SessionService,
    visualSettings: VisualSettings,
  ) {
    this._visualSettings = visualSettings;

    this._rowRenderer = new BenchmarkRowRenderer(
      historyService,
      rankService,
      sessionService,
      visualSettings,
    );
  }

  /**
   * Renders the complete benchmark table structure.
   *
   * @param scenarios - The list of scenarios to display.
   * @param highscores - A map of all-time highscores.
   * @returns The root container of the table.
   */
  public render(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const tableContainer: HTMLDivElement = document.createElement("div");

    const scrollArea: HTMLDivElement = document.createElement("div");

    const scrollThumb: HTMLDivElement = document.createElement("div");

    tableContainer.className = "benchmark-table-container";

    scrollArea.className = "benchmark-table";

    scrollThumb.className = "custom-scroll-thumb";

    this._appendCategorizedContent(scrollArea, scenarios, highscores);

    this._initializeControllers(tableContainer, scrollArea, scrollThumb);

    tableContainer.appendChild(scrollArea);

    tableContainer.appendChild(scrollThumb);

    return tableContainer;
  }

  private _initializeControllers(
    container: HTMLElement,
    scrollArea: HTMLElement,
    thumb: HTMLElement,
  ): void {
    const scrollController: BenchmarkScrollController =
      new BenchmarkScrollController(scrollArea, thumb, container);

    scrollController.initialize();

    const labelPositioner: BenchmarkLabelPositioner =
      new BenchmarkLabelPositioner(scrollArea);

    labelPositioner.initialize();
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
    const categoryMap: Map<string, Map<string, BenchmarkScenario[]>> = new Map<
      string,
      Map<string, BenchmarkScenario[]>
    >();

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

    subcategories.forEach(
      (scenarios: BenchmarkScenario[], subName: string): void => {
        const subGroup: HTMLElement = this._createSubcategoryGroup(
          subName,
          scenarios,
          highscores,
        );

        subcategoryContainer.appendChild(subGroup);
      },
    );

    groupElement.appendChild(subcategoryContainer);

    return groupElement;
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

    scenarios.forEach((scenario: BenchmarkScenario): void => {
      const score: number = highscores[scenario.name] || 0;

      listElement.appendChild(this._rowRenderer.renderRow(scenario, score));
    });

    subGroup.appendChild(listElement);

    return subGroup;
  }

  private _createSubcategoryHeader(): HTMLElement {
    const header: HTMLDivElement = document.createElement("div");

    header.className = "subcategory-header";

    if (this._visualSettings.showDotCloud) {
      header.appendChild(this._createSpacer("header-dot-spacer"));
    }

    if (this._visualSettings.showRankBadges) {
      header.appendChild(this._createColumnHeader("All-time"));
    }

    if (this._visualSettings.showSessionBest) {
      header.appendChild(this._createColumnHeader("Session"));
    }

    header.appendChild(this._createSpacer("header-action-spacer"));

    return header;
  }

  private _createColumnHeader(text: string): HTMLElement {
    const header: HTMLDivElement = document.createElement("div");

    header.className = "column-header";

    header.textContent = text;

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
