import { BenchmarkScenario } from "../data/benchmarks";

export interface RankResult {
  readonly currentRank: string;
  readonly nextRank: string | null;
  readonly progressPercentage: number;
  readonly rankLevel: number;
}

/**
 * Responsibility: Calculate rank attainment and progress based on benchmark thresholds.
 *
 * This service supports progress percentages exceeding 100% for the highest rank
 * by scaling based on the gap between the two highest rank thresholds.
 */
export class RankService {
  /**
   * Calculates the rank and percentage progress toward the next rank.
   *
   * @param score - The user's achieved score.
   * @param scenario - The scenario metadata containing thresholds.
   * @returns A RankResult containing the current rank name, next rank name, and progress.
   */
  public calculateRank(score: number, scenario: BenchmarkScenario): RankResult {
    const thresholdEntries: [string, number][] = Object.entries(
      scenario.thresholds,
    );

    if (thresholdEntries.length === 0) {
      return this._createEmptyRankResult();
    }

    const sortedThresholds: [string, number][] = [...thresholdEntries].sort(
      (a: [string, number], b: [string, number]): number => a[1] - b[1],
    );

    return this._evaluateRankProgress(score, sortedThresholds);
  }

  private _evaluateRankProgress(
    score: number,
    thresholds: [string, number][],
  ): RankResult {
    let currentRankIndex: number = -1;

    for (let i: number = 0; i < thresholds.length; i++) {
      if (score >= thresholds[i][1]) {
        currentRankIndex = i;
      } else {
        break;
      }
    }

    return this._buildRankResult(score, currentRankIndex, thresholds);
  }

  private _buildRankResult(
    score: number,
    index: number,
    thresholds: [string, number][],
  ): RankResult {
    const nextRankEntry: [string, number] | undefined = thresholds[index + 1];

    if (!nextRankEntry) {
      return this._handleHighestRankReached(score, index, thresholds);
    }

    return this._handleNormalRankProgress(score, index, thresholds);
  }

  private _handleNormalRankProgress(
    score: number,
    index: number,
    thresholds: [string, number][],
  ): RankResult {
    const nextRankEntry: [string, number] = thresholds[index + 1];

    const progress: number = this._calculateProgressBetweenRanks(
      score,
      index === -1 ? 0 : thresholds[index][1],
      nextRankEntry[1],
    );

    return {
      currentRank: index === -1 ? "Unranked" : thresholds[index][0],
      nextRank: nextRankEntry[0],
      progressPercentage: progress,
      rankLevel: index,
    };
  }

  private _handleHighestRankReached(
    score: number,
    index: number,
    thresholds: [string, number][],
  ): RankResult {
    const progress: number = this._calculateBeyondMaxProgress(
      score,
      index,
      thresholds,
    );

    return {
      currentRank: index === -1 ? "Unranked" : thresholds[index][0],
      nextRank: null,
      progressPercentage: progress,
      rankLevel: index,
    };
  }

  private _calculateBeyondMaxProgress(
    score: number,
    index: number,
    thresholds: [string, number][],
  ): number {
    if (index === -1) {
      return 0;
    }

    const currentThreshold: number = thresholds[index][1];
    const prevThreshold: number = index > 0 ? thresholds[index - 1][1] : 0;
    const interval: number = currentThreshold - prevThreshold;
    const effectiveInterval: number = interval > 0 ? interval : 100;

    const extraScore: number = score - currentThreshold;
    const extraPercentage: number = (extraScore / effectiveInterval) * 100;

    return Math.floor(extraPercentage);
  }

  private _calculateProgressBetweenRanks(
    score: number,
    lower: number,
    upper: number,
  ): number {
    const range: number = upper - lower;
    if (range <= 0) {
      return 0;
    }

    const clamped: number = Math.max(lower, Math.min(upper, score));
    const percentage: number = ((clamped - lower) / range) * 100;

    return Math.floor(percentage);
  }

  private _createEmptyRankResult(): RankResult {
    return {
      currentRank: "Unranked",
      nextRank: null,
      progressPercentage: 0,
      rankLevel: -1,
    };
  }
}
