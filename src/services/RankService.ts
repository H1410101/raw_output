import { BenchmarkScenario } from "../data/benchmarks";

export interface RankResult {
  currentRank: string;
  nextRank: string | null;
  progressPercentage: number;
  rankLevel: number;
}

/**
 * Responsibility: Calculate rank attainment and progress based on benchmark thresholds.
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
    const thresholdEntries = Object.entries(scenario.thresholds);

    if (thresholdEntries.length === 0) {
      return this._createEmptyRankResult();
    }

    const sortedThresholds = [...thresholdEntries].sort((a, b) => a[1] - b[1]);

    return this._evaluateRankProgress(score, sortedThresholds);
  }

  private _evaluateRankProgress(
    score: number,
    thresholds: [string, number][],
  ): RankResult {
    let currentRankIndex = -1;

    for (let i = 0; i < thresholds.length; i++) {
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
    const currentRank = index === -1 ? "Unranked" : thresholds[index][0];

    const nextRankEntry = thresholds[index + 1];

    if (!nextRankEntry) {
      return {
        currentRank,
        nextRank: null,
        progressPercentage: 100,
        rankLevel: index,
      };
    }

    const progress = this._calculateProgressBetweenRanks(
      score,
      index === -1 ? 0 : thresholds[index][1],
      nextRankEntry[1],
    );

    return {
      currentRank,
      nextRank: nextRankEntry[0],
      progressPercentage: progress,
      rankLevel: index,
    };
  }

  private _calculateProgressBetweenRanks(
    score: number,
    lowerThreshold: number,
    upperThreshold: number,
  ): number {
    const range = upperThreshold - lowerThreshold;

    if (range <= 0) {
      return 0;
    }

    const clampedScore = Math.max(
      lowerThreshold,
      Math.min(upperThreshold, score),
    );

    const percentage = ((clampedScore - lowerThreshold) / range) * 100;

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
