import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { BenchmarkRowRenderer } from "./BenchmarkRowRenderer";
import { BenchmarkScrollController } from "./BenchmarkScrollController";
import { BenchmarkLabelPositioner } from "./BenchmarkLabelPositioner";

export class BenchmarkTableComponent {
  private readonly _visualSettings: VisualSettings;
  private readonly _rowRenderer: BenchmarkRowRenderer;

  constructor(
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

  public render(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const table_container = document.createElement("div");
    table_container.className = "benchmark-table-container";

    const scroll_area = document.createElement("div");
    scroll_area.className = "benchmark-table";

    const scroll_thumb = document.createElement("div");
    scroll_thumb.className = "custom-scroll-thumb";

    this._append_categorized_content(scroll_area, scenarios, highscores);
    this._initialize_controllers(table_container, scroll_area, scroll_thumb);

    table_container.appendChild(scroll_area);
    table_container.appendChild(scroll_thumb);

    return table_container;
  }

  private _initialize_controllers(
    container: HTMLElement,
    scroll_area: HTMLElement,
    thumb: HTMLElement,
  ): void {
    const scroll_controller = new BenchmarkScrollController(
      scroll_area,
      thumb,
      container,
    );
    scroll_controller.initialize();

    const label_positioner = new BenchmarkLabelPositioner(scroll_area);
    label_positioner.initialize();
  }

  private _append_categorized_content(
    container: HTMLElement,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): void {
    const scenario_groups = this._group_scenarios_by_category(scenarios);

    scenario_groups.forEach((subcategories, category_name) => {
      const category_element = this._create_category_group(
        category_name,
        subcategories,
        highscores,
      );
      container.appendChild(category_element);
    });
  }

  private _group_scenarios_by_category(
    scenarios: BenchmarkScenario[],
  ): Map<string, Map<string, BenchmarkScenario[]>> {
    const category_map = new Map<string, Map<string, BenchmarkScenario[]>>();

    scenarios.forEach((scenario) => {
      if (!category_map.has(scenario.category)) {
        category_map.set(scenario.category, new Map());
      }

      const subcategory_map = category_map.get(scenario.category)!;

      if (!subcategory_map.has(scenario.subcategory)) {
        subcategory_map.set(scenario.subcategory, []);
      }

      subcategory_map.get(scenario.subcategory)!.push(scenario);
    });

    return category_map;
  }

  private _create_category_group(
    name: string,
    subcategories: Map<string, BenchmarkScenario[]>,
    highscores: Record<string, number>,
  ): HTMLElement {
    const group_element = document.createElement("div");
    group_element.className = "benchmark-category-group";

    group_element.appendChild(this._create_vertical_label(name, "category"));

    const subcategory_container = document.createElement("div");
    subcategory_container.className = "subcategory-container";

    subcategories.forEach((scenarios, sub_name) => {
      const sub_group = this._create_subcategory_group(
        sub_name,
        scenarios,
        highscores,
      );
      subcategory_container.appendChild(sub_group);
    });

    group_element.appendChild(subcategory_container);
    return group_element;
  }

  private _create_subcategory_group(
    name: string,
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const sub_group = document.createElement("div");
    sub_group.className = "benchmark-subcategory-group";

    sub_group.appendChild(this._create_vertical_label(name, "subcategory"));
    sub_group.appendChild(this._create_subcategory_header());

    const list_element = document.createElement("div");
    list_element.className = "scenario-list";

    scenarios.forEach((scenario) => {
      const score = highscores[scenario.name] || 0;
      list_element.appendChild(this._rowRenderer.render_row(scenario, score));
    });

    sub_group.appendChild(list_element);
    return sub_group;
  }

  private _create_subcategory_header(): HTMLElement {
    const header = document.createElement("div");
    header.className = "subcategory-header";

    if (this._visualSettings.showDotCloud) {
      header.appendChild(this._create_spacer("header-dot-spacer"));
    }

    if (this._visualSettings.showRankBadges) {
      header.appendChild(this._create_column_header("All-time"));
    }

    if (this._visualSettings.showSessionBest) {
      header.appendChild(this._create_column_header("Session"));
    }

    header.appendChild(this._create_spacer("header-action-spacer"));
    return header;
  }

  private _create_column_header(text: string): HTMLElement {
    const header = document.createElement("div");
    header.className = "column-header";
    header.textContent = text;
    return header;
  }

  private _create_spacer(class_name: string): HTMLElement {
    const spacer = document.createElement("div");
    spacer.className = class_name;
    return spacer;
  }

  private _create_vertical_label(
    text: string,
    type: "category" | "subcategory",
  ): HTMLElement {
    const container = document.createElement("div");
    container.className = `vertical-label-container ${type}-label`;

    const span = document.createElement("span");
    span.className = "vertical-text";
    span.textContent = text;

    container.appendChild(span);
    return container;
  }
}
