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

interface PersistedSessionState {
  sessionId: string | null;
  sessionStartTimestamp: number | null;
  lastRunTimestamp: number | null;
  isRanked: boolean;
  bestRanks: [string, SessionRankRecord][] | null;
  bestPerDifficulty: [string, RankResult][] | null;
  allRuns: { scenarioName: string; score: number; timestamp: number }[] | null;
  // Ranked track persistence
  rankedStartTime: number | null;
  rankedBestRanks: [string, SessionRankRecord][] | null;
  rankedAllRuns: { scenarioName: string; score: number; timestamp: number }[] | null;
  rankedPlaylist: string[] | null;
}

/**
 * Tracks session boundaries and best ranks achieved within a single session.
 *
 * Supports "Reactive Expiration" via timers and "Session Re-acquisition" by preserving
 * data until a fresh run explicitly starts a new session window.
 */
export class SessionService {
  private _sessionTimeoutMilliseconds: number = 10 * 60 * 1000;

  /** Key for local storage persistence. */
  private readonly _storageKey: string = "session_service_state";

  private readonly _rankService: RankService;

  private readonly _sessionSettingsService: SessionSettingsService;

  private _lastRunTimestamp: number | null = null;

  private _sessionStartTimestamp: number | null = null;

  private _sessionId: string | null = null;

  private _isRanked: boolean = false;

  private readonly _sessionBestRanks: Map<string, SessionRankRecord> =
    new Map();

  private readonly _sessionBestPerDifficulty: Map<string, RankResult> =
    new Map();

  private readonly _allRuns: { scenarioName: string; score: number; timestamp: number }[] = [];

  private _rankedStartTime: number | null = null;

  private readonly _rankedBestRanks: Map<string, SessionRankRecord> = new Map();

  private readonly _rankedAllRuns: { scenarioName: string; score: number; timestamp: number }[] = [];

  private _rankedPlaylist: Set<string> | null = null;

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
    this._loadFromLocalStorage();
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
      this._processSingleRun(run, updatedScenarioNames);
    });

    this._scheduleExpirationCheck();

    const uniqueUpdatedNames: string[] = [...new Set(updatedScenarioNames)];

    this._saveToLocalStorage();
    this._notifySessionUpdate(uniqueUpdatedNames);
  }

  private _processSingleRun(
    run: {
      scenarioName: string;
      score: number;
      scenario: BenchmarkScenario | null;
      difficulty: string | null;
      timestamp: Date;
    },
    updatedScenarioNames: string[],
  ): void {
    const runTimestamp = run.timestamp.getTime();

    this._updateSessionState(runTimestamp);

    this._processRunData(run);

    this._recordRun(run, runTimestamp);

    this._routeToRankedTrack(run, runTimestamp);

    if (run.scenario) {
      updatedScenarioNames.push(run.scenarioName);
    }
  }

  private _updateSessionState(runTimestamp: number): void {
    this._startNewSessionIfExpired(runTimestamp);

    this._updateLastRunTimestamp(runTimestamp);
  }

  private _recordRun(
    run: { scenarioName: string; score: number },
    timestamp: number,
  ): void {
    this._allRuns.push({
      scenarioName: run.scenarioName,
      score: run.score,
      timestamp,
    });
  }

  private _routeToRankedTrack(
    run: {
      scenarioName: string;
      score: number;
      scenario: BenchmarkScenario | null;
      difficulty: string | null;
      timestamp: Date;
    },
    runTimestamp: number,
  ): void {
    const isExplicitlyInPlaylist = !this._rankedPlaylist || this._rankedPlaylist.has(run.scenarioName);

    if (
      this._rankedStartTime !== null &&
      runTimestamp >= this._rankedStartTime &&
      isExplicitlyInPlaylist
    ) {
      this._processRankedRunData(run);

      this._rankedAllRuns.push({
        scenarioName: run.scenarioName,
        score: run.score,
        timestamp: runTimestamp,
      });
    }
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
   * Returns the timestamp when the current ranked session started.
   *
   * @returns The ranked start timestamp or null.
   */
  public get rankedStartTime(): number | null {
    return this._rankedStartTime;
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
   * Returns whether the current session is a ranked session.
   *
   * @returns True if the session is ranked.
   */
  public get isRanked(): boolean {
    return this._isRanked;
  }

  /**
   * Signals the start of an explicit ranked session.
   *
   * @param startTime - The timestamp when the ranked session officially began.
   */
  public startRankedSession(startTime: number): void {
    // Round down to the nearest second to avoid sub-second rejection of CSV files
    this._rankedStartTime = Math.floor(startTime / 1000) * 1000;
    this._rankedBestRanks.clear();
    this._rankedAllRuns.length = 0;
    this._isRanked = true;
    this._saveToLocalStorage();
  }

  /**
   * Signals the end of a ranked session.
   */
  public stopRankedSession(): void {
    this._rankedStartTime = null;
    this._isRanked = false;
    this._rankedPlaylist = null;
    this._saveToLocalStorage();
  }

  /**
   * Sets the playlist of scenarios allowed in the ranked track.
   * 
   * @param names - The list of scenario names, or null to allow all benchmark scenarios.
   */
  public setRankedPlaylist(names: string[] | null): void {
    this._rankedPlaylist = names ? new Set(names) : null;
    this._saveToLocalStorage();
  }

  /**
   * Sets the ranked status for the current session.
   *
   * @param value - The ranked status.
   */
  public setIsRanked(value: boolean): void {
    this._isRanked = value;
    this._saveToLocalStorage();
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
   * Returns all runs recorded in the current session.
   *
   * @returns An array of run data.
   */
  public getAllSessionRuns(): {
    scenarioName: string;
    score: number;
    timestamp: number;
  }[] {
    return [...this._allRuns];
  }

  /**
   * Retrieves the best score and rank achieved for a scenario in the current RANKED track.
   *
   * @param scenarioName - The name of the scenario.
   * @returns The rank record or null if not played this ranked session.
   */
  public getRankedScenarioBest(
    scenarioName: string,
  ): SessionRankRecord | null {
    return this._rankedBestRanks.get(scenarioName) || null;
  }

  /**
   * Returns all best scenario records recorded in the current RANKED track.
   *
   * @returns An array of session rank records.
   */
  public getAllRankedScenarioBests(): SessionRankRecord[] {
    return Array.from(this._rankedBestRanks.values());
  }

  /**
   * Returns all runs recorded in the current RANKED track.
   *
   * @returns An array of run data.
   */
  public getAllRankedSessionRuns(): {
    scenarioName: string;
    score: number;
    timestamp: number;
  }[] {
    return [...this._rankedAllRuns];
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
   * @param preserveRanked - If true, the ranked track data will not be cleared.
   */
  public resetSession(silent: boolean = false, preserveRanked: boolean = false): void {
    this._sessionBestRanks.clear();

    this._sessionBestPerDifficulty.clear();

    this._lastRunTimestamp = null;

    this._sessionStartTimestamp = null;

    this._sessionId = null;

    this._allRuns.length = 0;

    if (!preserveRanked) {
      this._isRanked = false;
    }

    this._clearExpirationTimer();

    this._saveToLocalStorage();

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
      const isPartofActiveRankedSession = this._isRanked && currentTimestamp >= (this._rankedStartTime ?? 0);

      this.resetSession(false, isPartofActiveRankedSession);
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

    const rankResult: RankResult = this._updateTrackBest(
      this._sessionBestRanks,
      run.scenarioName,
      run.score,
      run.scenario,
    );

    if (run.difficulty) {
      this._updateDifficultySessionBest(run.difficulty, rankResult);
    }
  }

  private _processRankedRunData(run: {
    scenarioName: string;
    score: number;
    scenario: BenchmarkScenario | null;
    difficulty: string | null;
  }): void {
    if (!run.scenario) {
      return;
    }

    this._updateTrackBest(
      this._rankedBestRanks,
      run.scenarioName,
      run.score,
      run.scenario,
    );
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
      this._notifySessionUpdate();
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

  private _updateTrackBest(
    track: Map<string, SessionRankRecord>,
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario,
  ): RankResult {
    const currentBest: SessionRankRecord | undefined =
      track.get(scenarioName);

    if (!currentBest || score > currentBest.bestScore) {
      return this._setNewTrackBest(track, scenarioName, score, scenario);
    }

    return currentBest.rankResult;
  }

  private _setNewTrackBest(
    track: Map<string, SessionRankRecord>,
    scenarioName: string,
    score: number,
    scenario: BenchmarkScenario,
  ): RankResult {
    const rankResult: RankResult = this._rankService.calculateRank(
      score,
      scenario,
    );

    track.set(scenarioName, {
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

  private _saveToLocalStorage(): void {
    const state: PersistedSessionState = {
      sessionId: this._sessionId,
      sessionStartTimestamp: this._sessionStartTimestamp,
      lastRunTimestamp: this._lastRunTimestamp,
      isRanked: this._isRanked,
      bestRanks: Array.from(this._sessionBestRanks.entries()),
      bestPerDifficulty: Array.from(this._sessionBestPerDifficulty.entries()),
      allRuns: [...this._allRuns],
      rankedStartTime: this._rankedStartTime,
      rankedBestRanks: Array.from(this._rankedBestRanks.entries()),
      rankedAllRuns: [...this._rankedAllRuns],
      rankedPlaylist: this._rankedPlaylist ? Array.from(this._rankedPlaylist) : null,
    };

    localStorage.setItem(this._storageKey, JSON.stringify(state));
  }

  private _loadFromLocalStorage(): void {
    const raw: string | null = localStorage.getItem(this._storageKey);
    if (!raw) {
      return;
    }

    try {
      const state = JSON.parse(raw) as PersistedSessionState;
      this._sessionId = state.sessionId;
      this._sessionStartTimestamp = state.sessionStartTimestamp;
      this._lastRunTimestamp = state.lastRunTimestamp;
      this._isRanked = state.isRanked || false;

      this._loadBestRanks(this._sessionBestRanks, state.bestRanks);
      this._loadDifficultyBests(state.bestPerDifficulty);

      if (state.allRuns) {
        this._allRuns.push(...state.allRuns);
      }

      this._rankedStartTime = state.rankedStartTime || null;
      this._loadBestRanks(this._rankedBestRanks, state.rankedBestRanks);
      if (state.rankedAllRuns) {
        this._rankedAllRuns.push(...state.rankedAllRuns);
      }
      this._rankedPlaylist = state.rankedPlaylist ? new Set(state.rankedPlaylist) : null;

      this._scheduleExpirationCheck();
    } catch {
      localStorage.removeItem(this._storageKey);
    }
  }

  private _loadBestRanks(
    targetMap: Map<string, SessionRankRecord>,
    bestRanks: [string, SessionRankRecord][] | null,
  ): void {
    if (!bestRanks) return;

    bestRanks.forEach(([key, value]: [string, SessionRankRecord]) => {
      targetMap.set(key, value);
    });
  }

  private _loadDifficultyBests(
    bestPerDifficulty: [string, RankResult][] | null,
  ): void {
    if (!bestPerDifficulty) return;

    bestPerDifficulty.forEach(([key, value]: [string, RankResult]) => {
      this._sessionBestPerDifficulty.set(key, value);
    });
  }
}
