import { BenchmarkService } from "../services/BenchmarkService";
import { HistoryService } from "../services/HistoryService";
import { RankService } from "../services/RankService";
import { SessionService } from "../services/SessionService";
import { AppStateService } from "../services/AppStateService";
import { VisualSettingsService } from "../services/VisualSettingsService";
import { SessionSettingsService } from "../services/SessionSettingsService";
import { BenchmarkTableComponent } from "./benchmark/BenchmarkTableComponent";
import { BenchmarkSettingsController } from "./benchmark/BenchmarkSettingsController";
import { BenchmarkScenario } from "../data/benchmarks";

export class BenchmarkView {
  private readonly _mountPoint: HTMLElement;
  private readonly _benchmarkService: BenchmarkService;
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _sessionService: SessionService;
  private readonly _appStateService: AppStateService;
  private readonly _visualSettingsService: VisualSettingsService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private readonly _settingsController: BenchmarkSettingsController;
  private _activeDifficulty: string;

  constructor(
    mountPoint: HTMLElement,
    benchmarkService: BenchmarkService,
    historyService: HistoryService,
    rankService: RankService,
    sessionService: SessionService,
    sessionSettingsService: SessionSettingsService,
    appStateService: AppStateService,
  ) {
    this._mountPoint = mountPoint;
    this._benchmarkService = benchmarkService;
    this._historyService = historyService;
    this._rankService = rankService;
    this._sessionService = sessionService;
    this._appStateService = appStateService;
    this._visualSettingsService = new VisualSettingsService();
    this._sessionSettingsService = sessionSettingsService;

    this._activeDifficulty = this._appStateService.get_benchmark_difficulty();

    this._settingsController = new BenchmarkSettingsController(
      this._visualSettingsService,
      this._sessionSettingsService,
    );

    this._subscribe_to_service_updates();
  }

  public async render(): Promise<void> {
    const scenarios = this._benchmarkService.getScenarios(
      this._activeDifficulty as any,
    );

    const highscores = await this._historyService.getBatchHighscores(
      scenarios.map((scenario) => scenario.name),
    );

    this._mountPoint.innerHTML = "";

    this._mountPoint.appendChild(
      this._create_view_container(scenarios, highscores),
    );
  }

  private _subscribe_to_service_updates(): void {
    this._visualSettingsService.subscribe(() => this._refresh_if_visible());

    this._sessionSettingsService.subscribe(() => this._refresh_if_visible());

    this._historyService.onHighscoreUpdated(() => this._refresh_if_visible());

    this._sessionService.onSessionUpdated(() => this._refresh_if_visible());

    window.addEventListener("resize", () => this._refresh_if_visible());
  }

  private _refresh_if_visible(): void {
    if (this._mountPoint.classList.contains("hidden-view")) {
      return;
    }

    this.render();
  }

  private _create_view_container(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const container = document.createElement("div");

    container.className = "benchmark-view-container";

    container.appendChild(this._create_header_controls());

    container.appendChild(this._create_table_element(scenarios, highscores));

    return container;
  }

  private _create_header_controls(): HTMLElement {
    const header = document.createElement("div");

    header.className = "benchmark-header-controls";

    header.appendChild(this._create_spacer());

    header.appendChild(this._create_difficulty_tabs());

    header.appendChild(this._create_right_control_group());

    return header;
  }

  private _create_spacer(): HTMLElement {
    const spacer = document.createElement("div");

    spacer.style.flex = "1";

    return spacer;
  }

  private _create_right_control_group(): HTMLElement {
    const group = document.createElement("div");

    group.style.flex = "1";

    group.style.display = "flex";

    group.style.justifyContent = "flex-end";

    group.appendChild(this._create_settings_button());

    return group;
  }

  private _create_settings_button(): HTMLElement {
    const button = document.createElement("button");

    button.className = "visual-settings-button";

    button.title = "Visual Settings";

    button.innerHTML = this._get_settings_icon_svg();

    button.addEventListener("click", () =>
      this._settingsController.open_settings_menu(),
    );

    return button;
  }

  private _get_settings_icon_svg(): string {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
  }

  private _create_difficulty_tabs(): HTMLElement {
    const container = document.createElement("div");

    container.className = "difficulty-tabs";

    ["Easier", "Medium", "Harder"].forEach((difficulty) => {
      container.appendChild(this._create_tab(difficulty));
    });

    return container;
  }

  private _create_tab(difficulty: string): HTMLButtonElement {
    const tab = document.createElement("button");

    const is_active = this._activeDifficulty === difficulty;

    tab.className = `tab-button ${is_active ? "active" : ""}`;

    tab.textContent = difficulty;

    tab.addEventListener("click", () =>
      this._handle_difficulty_change(difficulty),
    );

    return tab;
  }

  private async _handle_difficulty_change(difficulty: string): Promise<void> {
    this._activeDifficulty = difficulty;

    this._appStateService.set_benchmark_difficulty(difficulty as any);

    await this.render();
  }

  private _create_table_element(
    scenarios: BenchmarkScenario[],
    highscores: Record<string, number>,
  ): HTMLElement {
    const table_component = new BenchmarkTableComponent(
      this._historyService,
      this._rankService,
      this._sessionService,
      this._visualSettingsService.getSettings(),
    );

    return table_component.render(scenarios, highscores);
  }
}
