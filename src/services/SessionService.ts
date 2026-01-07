import { BenchmarkScenario } from "../data/benchmarks";
import { RankResult, RankService } from "./RankService";

export type SessionUpdateListener = () => void;

export interface SessionRankRecord {
  scenarioName: string;
  bestScore: number;
  rankResult: RankResult;
}

/**
 * Responsibility: Track session boundaries and best ranks achieved within a session.
 * A session is defined as a series of runs where consecutive runs are no longer than 10 minutes apart.
 */
export class SessionService {
  private readonly _sessionTimeoutMilliseconds: number = 10 * 60 * 1000;

  private readonly _rankService: RankService;

  private _lastRunTimestamp: number | null = null;

  private _sessionBestRanks: Map<string, SessionRankRecord> = new Map();

  private _sessionBestPerDifficulty: Map<string, RankResult> = new Map();

  private _sessionUpdateListeners: SessionUpdateListener[] = [];

  constructor(rankService: RankService) {
    this._rankService = rankService;
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
      this._refreshSessionIfExpired(run.timestamp.getTime());

      this._updateLastRunTimestamp(run.timestamp.getTime());

      if (run.scenario) {
        const rankResult = this._updateScenarioSessionBest(
          run.scenarioName,
          run.score,
          run.scenario,
        );

        if (run.difficulty) {
          this._updateDifficultySessionBest(run.difficulty, rankResult);
        }
      }
    });

    this._notifySessionUpdate();
  }

  private _notifySessionUpdate(): void {
    this._sessionUpdateListeners.forEach((listener) => listener());
  }

  public getScenarioSessionBest(
    scenarioName: string,
  ): SessionRankRecord | null {
    return this._sessionBestRanks.get(scenarioName) || null;
  }

  public getDifficultySessionBest(difficulty: string): RankResult | null {
    return this._sessionBestPerDifficulty.get(difficulty) || null;
  }

  public resetSession(): void {
    this._sessionBestRanks.clear();

    this._sessionBestPerDifficulty.clear();

    this._lastRunTimestamp = null;

    this._notifySessionUpdate();
  }

  private _refreshSessionIfExpired(currentTimestamp: number): void {
    if (this._isSessionExpired(currentTimestamp)) {
      this.resetSession();
    }
  }

  private _isSessionExpired(currentTimestamp: number): boolean {
    if (this._lastRunTimestamp === null) {
      return false;
    }

    const elapsed = currentTimestamp - this._lastRunTimestamp;

    return elapsed > this._sessionTimeoutMilliseconds;
  }

  private _updateLastRunTimestamp(timestamp: number): void {
    this._lastRunTimestamp = timestamp;
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

    if (
      !currentBest ||
      rankResult.rankLevel > currentBest.rankLevel ||
      (rankResult.rankLevel === currentBest.rankLevel &&
        rankResult.progressPercentage > currentBest.progressPercentage)
    ) {
      this._sessionBestPerDifficulty.set(difficulty, rankResult);
    }
  }
}
