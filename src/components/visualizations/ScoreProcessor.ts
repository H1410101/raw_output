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
        Number.isFinite(entry.score) && Number.isFinite(entry.timestamp),
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

    const sampleSize: number = Math.min(entries.length, 20);
    let temporalMinBound: number = entries[0].score;

    for (let i: number = 1; i < sampleSize; i++) {
      temporalMinBound = Math.min(temporalMinBound, entries[i].score);
    }

    return entries.filter(
      (entry: ScoreEntry): boolean => entry.score >= temporalMinBound,
    );
  }
}
