/**
 * Represents a single score entry with its associated timestamp.
 */
export interface ScoreEntry {
  readonly score: number;
  readonly timestamp: number;
}

/**
 * Responsibility: Filter and sample raw performance scores for visualization.
 * Handles outlier detection and temporal selection to ensure the chart reflects relevant skill.
 */
export class ScoreProcessor {
  /**
   * Processes raw scores by removing outliers and selecting recent temporal samples.
   *
   * @param entries - Array of raw performance score entries to process.
   * @returns Array of processed score entries reflecting recent performance.
   */
  public static processTemporalScores(entries: ScoreEntry[]): ScoreEntry[] {
    const validEntries: ScoreEntry[] = entries.filter(
      (entry: ScoreEntry): boolean =>
        typeof entry.score === "number" && !isNaN(entry.score),
    );

    if (validEntries.length === 0) {
      return [];
    }

    const nonOutliers: ScoreEntry[] = this._filterBottomOutliers(validEntries);

    return this._filterTemporalRange(nonOutliers);
  }

  private static _filterBottomOutliers(entries: ScoreEntry[]): ScoreEntry[] {
    const sorted: ScoreEntry[] = [...entries].sort(
      (a: ScoreEntry, b: ScoreEntry): number => a.score - b.score,
    );

    const dropCount: number =
      entries.length >= 10 ? Math.ceil(sorted.length * 0.05) : 0;

    const outlierThreshold: number = sorted[dropCount - 1]?.score ?? -Infinity;

    return entries.filter(
      (entry: ScoreEntry): boolean => entry.score > outlierThreshold,
    );
  }

  private static _filterTemporalRange(entries: ScoreEntry[]): ScoreEntry[] {
    if (entries.length === 0) {
      return [];
    }

    const recentSample: number[] = entries
      .slice(0, 20)
      .map((entry: ScoreEntry): number => entry.score);

    const temporalMinBound: number = Math.min(...recentSample);

    const maxHistorical: number = Math.max(
      ...entries.map((entry: ScoreEntry): number => entry.score),
    );

    return entries.filter(
      (entry: ScoreEntry): boolean =>
        entry.score >= temporalMinBound && entry.score <= maxHistorical,
    );
  }
}
