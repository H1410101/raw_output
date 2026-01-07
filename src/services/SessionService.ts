import { BenchmarkScenario } from "../data/benchmarks";
import { RankResult, RankService } from "./RankService";
import { SessionSettingsService } from "./SessionSettingsService";

export type SessionUpdateListener = () => void;

export interface SessionRankRecord {
  scenarioName: string;
  bestScore: number;
  rankResult: RankResult;
}

/**
 * Responsibility: Track session boundaries and best ranks achieved within a session.
 * Supports "Reactive Expiration" via timers and "Session Re-acquisition" by preserving
 * data until a fresh run explicitly starts a new session window.
 */
export class SessionService {
  private _sessionTimeoutMilliseconds: number = 10 * 60 * 1000;

  public get session_timeout_milliseconds(): number {
    return this._sessionTimeoutMilliseconds;
  }

  private readonly _rankService: RankService;

  private readonly _sessionSettingsService: SessionSettingsService;

  private _lastRunTimestamp: number | null = null;

  private _sessionBestRanks: Map<string, SessionRankRecord> = new Map();

  private _sessionBestPerDifficulty: Map<string, RankResult> = new Map();

  private _sessionUpdateListeners: SessionUpdateListener[] = [];

  private _expiration_timer_id: number | null = null;

  constructor(
    rankService: RankService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._rankService = rankService;

    this._sessionSettingsService = sessionSettingsService;

    this._subscribe_to_settings_updates();
  }

  public onSessionUpdated(listener: SessionUpdateListener): void {
    this._sessionUpdateListeners.push(listener);
  }

  public registerRun(
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario | null,
    difficulty: string | null,
    timestamp: Date = new Date(),
  ): void {
    this.registerMultipleRuns([
      { scenarioName, score, scenario, difficulty, timestamp },
    ]);
  }

  public registerMultipleRuns(
    runs: {
      scenarioName: string;
      score: number;
      scenario: BenchmarkScenario | null;
      difficulty: string | null;
      timestamp: Date;
    }[],
  ): void {
    runs.forEach((run) => {
      this._start_new_session_if_expired(run.timestamp.getTime());

      this._updateLastRunTimestamp(run.timestamp.getTime());

      this._process_run_data(run);
    });

    this._schedule_expiration_check();

    this._notifySessionUpdate();
  }

  public getScenarioSessionBest(
    scenarioName: string,
  ): SessionRankRecord | null {
    return this._sessionBestRanks.get(scenarioName) || null;
  }

  public getDifficultySessionBest(difficulty: string): RankResult | null {
    return this._sessionBestPerDifficulty.get(difficulty) || null;
  }

  public is_session_active(current_timestamp: number = Date.now()): boolean {
    if (this._lastRunTimestamp === null) {
      return false;
    }

    const elapsed = current_timestamp - this._lastRunTimestamp;

    return elapsed <= this._sessionTimeoutMilliseconds;
  }

  public resetSession(): void {
    this._sessionBestRanks.clear();

    this._sessionBestPerDifficulty.clear();

    this._lastRunTimestamp = null;

    this._clear_expiration_timer();

    this._notifySessionUpdate();
  }

  private _subscribe_to_settings_updates(): void {
    this._sessionSettingsService.subscribe((settings) => {
      this._sessionTimeoutMilliseconds =
        settings.sessionTimeoutMinutes * 60 * 1000;

      this._schedule_expiration_check();

      this._notifySessionUpdate();
    });
  }

  private _start_new_session_if_expired(currentTimestamp: number): void {
    const elapsed = this._lastRunTimestamp
      ? currentTimestamp - this._lastRunTimestamp
      : 0;

    const is_beyond_timeout = elapsed > this._sessionTimeoutMilliseconds;

    if (this._lastRunTimestamp !== null && is_beyond_timeout) {
      this.resetSession();
    }
  }

  private _updateLastRunTimestamp(timestamp: number): void {
    this._lastRunTimestamp = timestamp;
  }

  private _process_run_data(run: {
    scenarioName: string;
    score: number;
    scenario: BenchmarkScenario | null;
    difficulty: string | null;
  }): void {
    if (!run.scenario) {
      return;
    }

    const rankResult = this._updateScenarioSessionBest(
      run.scenarioName,
      run.score,
      run.scenario,
    );

    if (run.difficulty) {
      this._updateDifficultySessionBest(run.difficulty, rankResult);
    }
  }

  private _schedule_expiration_check(): void {
    this._clear_expiration_timer();

    if (this._lastRunTimestamp === null) {
      return;
    }

    const expiration_time =
      this._lastRunTimestamp + this._sessionTimeoutMilliseconds;

    const delay = expiration_time - Date.now();

    this._set_reactive_timer_or_notify(delay);
  }

  private _set_reactive_timer_or_notify(delay: number): void {
    if (delay <= 0) {
      this._notifySessionUpdate();

      return;
    }

    this._expiration_timer_id = window.setTimeout(() => {
      this._notifySessionUpdate();
    }, delay);
  }

  private _clear_expiration_timer(): void {
    if (this._expiration_timer_id !== null) {
      window.clearTimeout(this._expiration_timer_id);

      this._expiration_timer_id = null;
    }
  }

  private _notifySessionUpdate(): void {
    this._sessionUpdateListeners.forEach((listener) => listener());
  }

  private _updateScenarioSessionBest(
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario,
  ): RankResult {
    const currentBest = this._sessionBestRanks.get(scenarioName);

    if (!currentBest || score > currentBest.bestScore) {
      return this._setNewScenarioSessionBest(scenarioName, score, scenario);
    }

    return currentBest.rankResult;
  }

  private _setNewScenarioSessionBest(
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario,
  ): RankResult {
    const rankResult = this._rankService.calculateRank(score, scenario);

    this._sessionBestRanks.set(scenarioName, {
      scenarioName,
      bestScore: score,
      rankResult,
    });

    return rankResult;
  }

  private _updateDifficultySessionBest(
    difficulty: string,
    rankResult: RankResult,
  ): void {
    const currentBest = this._sessionBestPerDifficulty.get(difficulty);

    const is_new_best =
      !currentBest ||
      rankResult.rankLevel > currentBest.rankLevel ||
      (rankResult.rankLevel === currentBest.rankLevel &&
        rankResult.progressPercentage > currentBest.progressPercentage);

    if (is_new_best) {
      this._sessionBestPerDifficulty.set(difficulty, rankResult);
    }
  }
}
