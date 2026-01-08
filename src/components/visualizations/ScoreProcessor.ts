/**
 * Responsibility: Filter and sample raw performance scores for visualization.
 * Handles outlier detection and temporal selection to ensure the chart reflects relevant skill.
 */
export class ScoreProcessor {
  /**
   * Processes raw scores by removing outliers and selecting recent temporal samples.
   */
  public static processTemporalScores(scores: number[]): number[] {
    const validScores: number[] = scores.filter(
      (score: number) => typeof score === "number" && !isNaN(score),
    );

    if (validScores.length === 0) {
      return [];
    }

    const nonOutliers: number[] = this._filterBottomOutliers(validScores);

    if (nonOutliers.length === 0) {
      return [];
    }

    const recentSample: number[] = nonOutliers.slice(0, 20);
    const temporalMinBound: number = Math.min(...recentSample);
    const maxHistorical: number = Math.max(...nonOutliers);

    return nonOutliers.filter(
      (score: number) => score >= temporalMinBound && score <= maxHistorical,
    );
  }

  private static _filterBottomOutliers(scores: number[]): number[] {
    const sorted: number[] = [...scores].sort((a: number, b: number) => a - b);
    const dropCount: number =
      scores.length >= 10 ? Math.ceil(sorted.length * 0.05) : 0;
    const outlierThreshold: number = sorted[dropCount - 1] ?? -Infinity;

    return scores.filter((score: number) => score > outlierThreshold);
  }
}
