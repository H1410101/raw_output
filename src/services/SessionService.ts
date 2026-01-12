import { BenchmarkScenario } from "../data/benchmarks";
import { RankResult, RankService } from "./RankService";
import {
  SessionSettings,
  SessionSettingsService,
} from "./SessionSettingsService";

/**
 * Listener callback for session state changes.
 */
export type SessionUpdateListener = (updatedScenarioNames?: string[]) => void;

/**
 * Represents the best performance achieved for a specific scenario within a session.
 */
export interface SessionRankRecord {
  /** The unique identifier of the scenario. */
  readonly scenarioName: string;
  /** The numeric highscore achieved this session. */
  readonly bestScore: number;
  /** The calculated rank and progress for that score. */
  readonly rankResult: RankResult;
}

/**
 * Tracks session boundaries and best ranks achieved within a single session.
 *
 * Supports "Reactive Expiration" via timers and "Session Re-acquisition" by preserving
 * data until a fresh run explicitly starts a new session window.
 */
export class SessionService {
  private _sessionTimeoutMilliseconds: number = 10 * 60 * 1000;

  private readonly _rankService: RankService;

  private readonly _sessionSettingsService: SessionSettingsService;

  private _lastRunTimestamp: number | null = null;

  private _sessionStartTimestamp: number | null = null;

  private _sessionId: string | null = null;

  private readonly _sessionBestRanks: Map<string, SessionRankRecord> =
    new Map();

  private readonly _sessionBestPerDifficulty: Map<string, RankResult> =
    new Map();

  private readonly _sessionUpdateListeners: SessionUpdateListener[] = [];

  private _expirationTimerId: number | null = null;

  /**
   * Initializes the SessionService with required rank and settings dependencies.
   *
   * @param rankService - Service for calculating ranks from scores.
   * @param sessionSettingsService - Service providing session timeout configuration.
   */
  public constructor(
    rankService: RankService,
    sessionSettingsService: SessionSettingsService,
  ) {
    this._rankService = rankService;

    this._sessionSettingsService = sessionSettingsService;

    this._subscribeToSettingsUpdates();
  }

  /**
   * Returns the current session timeout duration in milliseconds.
   *
   * @returns The timeout duration.
   */
  public get sessionTimeoutMilliseconds(): number {
    return this._sessionTimeoutMilliseconds;
  }

  /**
   * Registers a callback to be notified when the session data or status changes.
   *
   * @param listener - The callback function.
   */
  public onSessionUpdated(listener: SessionUpdateListener): void {
    this._sessionUpdateListeners.push(listener);
  }

  /**
   * Registers a single run result into the session tracking system.
   *
   * @param run - The details of the training run.
   * @param run.scenarioName - The name of the scenario.
   * @param run.score - The score achieved.
   * @param run.scenario - The benchmark scenario data.
   * @param run.difficulty - The difficulty tier.
   * @param run.timestamp - Optional completion timestamp.
   */
  public registerRun(run: {
    scenarioName: string;
    score: number;
    scenario: BenchmarkScenario | null;
    difficulty: string | null;
    timestamp?: Date;
  }): void {
    const timestamp: Date = run.timestamp ?? new Date();

    this.registerMultipleRuns([{ ...run, timestamp }]);
  }

  /**
   * Registers multiple run results, ensuring session boundaries are respected.
   *
   * @param runs - Array of run data objects.
   */
  public registerMultipleRuns(
    runs: {
      scenarioName: string;
      score: number;
      scenario: BenchmarkScenario | null;
      difficulty: string | null;
      timestamp: Date;
    }[],
  ): void {
    const updatedScenarioNames: string[] = [];

    runs.forEach((run): void => {
      this._startNewSessionIfExpired(run.timestamp.getTime());

      this._updateLastRunTimestamp(run.timestamp.getTime());

      this._processRunData(run);

      if (run.scenario) {
        updatedScenarioNames.push(run.scenarioName);
      }
    });

    this._scheduleExpirationCheck();

    const uniqueUpdatedNames: string[] = [...new Set(updatedScenarioNames)];

    this._notifySessionUpdate(uniqueUpdatedNames);
  }

  /**
   * Retrieves the best score and rank achieved for a scenario in this session.
   *
   * @param scenarioName - The name of the scenario.
   * @returns The rank record or null if not played this session.
   */
  public getScenarioSessionBest(
    scenarioName: string,
  ): SessionRankRecord | null {
    return this._sessionBestRanks.get(scenarioName) || null;
  }

  /**
   * Retrieves the highest rank achieved within a specific difficulty tier this session.
   *
   * @param difficulty - The difficulty tier name.
   * @returns The rank result or null if no qualifying runs.
   */
  public getDifficultySessionBest(difficulty: string): RankResult | null {
    return this._sessionBestPerDifficulty.get(difficulty) || null;
  }

  /**
   * Returns the timestamp when the current session first started.
   *
   * @returns The start timestamp or null if no session.
   */
  public get sessionStartTimestamp(): number | null {
    return this._sessionStartTimestamp;
  }

  /**
   * Returns the unique identifier for the current session.
   *
   * @returns The session ID or null if no session is active.
   */
  public get sessionId(): string | null {
    return this._sessionId;
  }

  /**
   * Returns all best scenario records recorded in the current session.
   *
   * @returns An array of session rank records.
   */
  public getAllScenarioSessionBests(): SessionRankRecord[] {
    return Array.from(this._sessionBestRanks.values());
  }

  /**
   * Determines if a session is currently considered active based on the timeout.
   *
   * @param currentTimestamp - Optional timestamp to check against.
   * @returns True if the session is active.
   */
  public isSessionActive(currentTimestamp: number = Date.now()): boolean {
    if (this._lastRunTimestamp === null) {
      return false;
    }

    const elapsed: number = currentTimestamp - this._lastRunTimestamp;

    return elapsed <= this._sessionTimeoutMilliseconds;
  }

  /**
   * Clears all session data and resets the active state.
   *
   * @param silent - If true, listeners will not be notified of the reset.
   */
  public resetSession(silent: boolean = false): void {
    this._sessionBestRanks.clear();

    this._sessionBestPerDifficulty.clear();

    this._lastRunTimestamp = null;

    this._sessionStartTimestamp = null;

    this._sessionId = null;

    this._clearExpirationTimer();

    if (!silent) {
      this._notifySessionUpdate();
    }
  }

  private _subscribeToSettingsUpdates(): void {
    this._sessionSettingsService.subscribe(
      (settings: SessionSettings): void => {
        this._sessionTimeoutMilliseconds =
          settings.sessionTimeoutMinutes * 60 * 1000;

        this._scheduleExpirationCheck();

        this._notifySessionUpdate();
      },
    );
  }

  private _startNewSessionIfExpired(currentTimestamp: number): void {
    const lastRun: number = this._lastRunTimestamp || 0;

    const elapsed: number = currentTimestamp - lastRun;

    const isBeyondTimeout: boolean = elapsed > this._sessionTimeoutMilliseconds;

    if (this._lastRunTimestamp !== null && isBeyondTimeout) {
      this.resetSession();
    }

    if (this._sessionStartTimestamp === null) {
      this._sessionStartTimestamp = currentTimestamp;
      this._sessionId = `session_${currentTimestamp}`;
    }
  }

  private _updateLastRunTimestamp(timestamp: number): void {
    this._lastRunTimestamp = timestamp;
  }

  private _processRunData(run: {
    scenarioName: string;
    score: number;
    scenario: BenchmarkScenario | null;
    difficulty: string | null;
  }): void {
    if (!run.scenario) {
      return;
    }

    const rankResult: RankResult = this._updateScenarioSessionBest(
      run.scenarioName,
      run.score,
      run.scenario,
    );

    if (run.difficulty) {
      this._updateDifficultySessionBest(run.difficulty, rankResult);
    }
  }

  private _scheduleExpirationCheck(): void {
    this._clearExpirationTimer();

    if (this._lastRunTimestamp === null) {
      return;
    }

    const expirationTime: number =
      this._lastRunTimestamp + this._sessionTimeoutMilliseconds;

    const delay: number = expirationTime - Date.now();

    this._setReactiveTimerOrNotify(delay);
  }

  private _setReactiveTimerOrNotify(delay: number): void {
    if (delay <= 0) {
      this._notifySessionUpdate();

      return;
    }

    this._expirationTimerId = window.setTimeout((): void => {
      this.resetSession();
    }, delay);
  }

  private _clearExpirationTimer(): void {
    if (this._expirationTimerId !== null) {
      window.clearTimeout(this._expirationTimerId);

      this._expirationTimerId = null;
    }
  }

  private _notifySessionUpdate(updatedScenarioNames?: string[]): void {
    this._sessionUpdateListeners.forEach(
      (listener: SessionUpdateListener): void => {
        listener(updatedScenarioNames);
      },
    );
  }

  private _updateScenarioSessionBest(
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario,
  ): RankResult {
    const currentBest: SessionRankRecord | undefined =
      this._sessionBestRanks.get(scenarioName);

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
    const rankResult: RankResult = this._rankService.calculateRank(
      score,
      scenario,
    );

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
    const currentBest: RankResult | undefined =
      this._sessionBestPerDifficulty.get(difficulty);

    const isNewBest: boolean =
      !currentBest ||
      rankResult.rankLevel > currentBest.rankLevel ||
      (rankResult.rankLevel === currentBest.rankLevel &&
        rankResult.progressPercentage > currentBest.progressPercentage);

    if (isNewBest) {
      this._sessionBestPerDifficulty.set(difficulty, rankResult);
    }
  }
}
