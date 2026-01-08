import { BenchmarkScenario } from "../../data/benchmarks";
import { HistoryService } from "../../services/HistoryService";
import { RankService } from "../../services/RankService";
import { SessionService } from "../../services/SessionService";
import { VisualSettings } from "../../services/VisualSettingsService";
import { DotCloudComponent } from "../visualizations/DotCloudComponent";

export class BenchmarkRowRenderer {
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _sessionService: SessionService;
  private readonly _visualSettings: VisualSettings;

  constructor(
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

  public render_row(scenario: BenchmarkScenario, highscore: number): HTMLElement {
    const row_element = document.createElement("div");

    const row_height_class = `row-height-${this._visualSettings.rowHeight.toLowerCase()}`;

    row_element.className = `scenario-row ${row_height_class}`;

    row_element.appendChild(this._create_name_cell(scenario.name));

    row_element.appendChild(this._create_right_content_wrapper(scenario, highscore));

    row_element.addEventListener("click", () => row_element.classList.toggle("selected"));

    return row_element;
  }

  private _create_name_cell(scenario_name: string): HTMLElement {
    const name_span = document.createElement("span");

    name_span.className = "scenario-name";

    name_span.textContent = scenario_name;

    return name_span;
  }

  private _create_right_content_wrapper(
    scenario: BenchmarkScenario,
    highscore: number,
  ): HTMLElement {
    const wrapper = document.createElement("div");

    wrapper.className = "row-right-content";

    if (this._visualSettings.showDotCloud) {
      wrapper.appendChild(this._create_dot_cloud_cell(scenario));
    }

    if (this._visualSettings.showRankBadges) {
      wrapper.appendChild(this._create_rank_badge(scenario, highscore));
    }

    if (this._visualSettings.showSessionBest) {
      wrapper.appendChild(this._create_session_rank_badge(scenario));
    }

    wrapper.appendChild(this._create_play_button(scenario.name));

    return wrapper;
  }

  private _create_dot_cloud_cell(scenario: BenchmarkScenario): HTMLElement {
    const container = document.createElement("div");

    container.className = "dot-cloud-container";

    this._historyService.getLastScores(scenario.name, 100).then((scores) => {
      if (scores.length > 0) {
        this._inject_dot_cloud_visualization(container, scenario, scores);
      }
    });

    return container;
  }

  private _inject_dot_cloud_visualization(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    scores: number[],
  ): void {
    const average_rank_interval = this._calculate_average_rank_interval(scenario);

    const dot_cloud = new DotCloudComponent(
      scores,
      scenario.thresholds,
      this._visualSettings,
      average_rank_interval,
    );

    container.replaceWith(dot_cloud.render());
  }

  private _calculate_average_rank_interval(scenario: BenchmarkScenario): number {
    const thresholds = Object.values(scenario.thresholds).sort((a, b) => a - b);

    if (thresholds.length < 2) {
      return 100;
    }

    let total_interval_sum = 0;

    for (let i = 1; i < thresholds.length; i++) {
      total_interval_sum += thresholds[i] - thresholds[i - 1];
    }

    return total_interval_sum / (thresholds.length - 1);
  }

  private _create_session_rank_badge(scenario: BenchmarkScenario): HTMLElement {
    const session_best = this._sessionService.getScenarioSessionBest(scenario.name);

    const best_score = session_best ? session_best.bestScore : 0;

    const badge_element = this._create_rank_badge(scenario, best_score);

    const is_session_active = this._sessionService.is_session_active();

    if (best_score === 0 || !is_session_active) {
      badge_element.style.visibility = "hidden";
    }

    badge_element.classList.add("session-badge");

    return badge_element;
  }

  private _create_rank_badge(scenario: BenchmarkScenario, score: number): HTMLElement {
    const badge_container = document.createElement("div");

    badge_container.className = "rank-badge-container";

    const badge_content = document.createElement("div");

    badge_content.className = "badge-content";

    this._fill_badge_content(badge_content, scenario, score);

    badge_container.appendChild(badge_content);

    return badge_container;
  }

  private _fill_badge_content(
    container: HTMLElement,
    scenario: BenchmarkScenario,
    score: number,
  ): void {
    if (score === 0) {
      container.innerHTML = `<span class="unranked-text">Unranked</span>`;

      return;
    }

    const calculated_rank = this._rankService.calculateRank(score, scenario);

    container.innerHTML = `
      <span class="rank-name">${calculated_rank.currentRank}</span>
      <span class="rank-progress">+${calculated_rank.progressPercentage}%</span>
    `;
  }

  private _create_play_button(scenario_name: string): HTMLElement {
    const play_button = document.createElement("button");

    play_button.className = "play-scenario-button";

    play_button.title = `Launch ${scenario_name}`;

    play_button.addEventListener("click", (event) => {
      event.stopPropagation();

      this._launch_kovaks_scenario(scenario_name);
    });

    return play_button;
  }

  private _launch_kovaks_scenario(scenario_name: string): void {
    const encoded_name = encodeURIComponent(scenario_name);

    const steam_launch_url = `steam://run/824270/?action=jump-to-scenario;name=${encoded_name};mode=challenge`;

    window.location.href = steam_launch_url;
  }
}
