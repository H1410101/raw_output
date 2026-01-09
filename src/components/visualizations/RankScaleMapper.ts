/**
 * Responsibility: Map performance scores to a non-linear "Rank Unit" (RU) scale.
 * This ensures that the visual distance between any two adjacent rank thresholds is uniform.
 */
export class RankScaleMapper {
  private readonly _thresholds: number[];
  private readonly _averageRankInterval: number;

  /**
   * Initializes the mapper with rank thresholds and scaling context.
   *
   * @param thresholds - Numeric values for each rank threshold.
   * @param averageRankInterval - Expected gap between ranks for extrapolation.
   */
  public constructor(thresholds: number[], averageRankInterval: number = 100) {
    this._thresholds = thresholds;
    this._averageRankInterval = averageRankInterval;
  }

  /**
   * Converts a raw performance score into its equivalent position on the Rank Unit scale.
   *
   * @param score - The numeric performance score.
   * @returns The calculated Rank Unit position.
   */
  public calculateRankUnit(score: number): number {
    if (this._thresholds.length === 0) {
      return score / this._averageRankInterval;
    }

    if (score < this._thresholds[0]) {
      return this._calculateLowerBoundRU(score);
    }

    const lastIndex: number = this._thresholds.length - 1;

    if (score > this._thresholds[lastIndex]) {
      return this._calculateUpperBoundRU(score, lastIndex);
    }

    return this._calculateInternalRU(score);
  }

  /**
   * Determines the horizontal pixel position on a canvas for a given RU value.
   *
   * @param rankUnit - The value on the Rank Unit scale.
   * @param minRU - The minimum RU value in the view.
   * @param maxRU - The maximum RU value in the view.
   * @param canvasWidth - Total width of the drawing area.
   * @returns The horizontal pixel coordinate.
   */
  public getHorizontalPosition(
    rankUnit: number,
    minRU: number,
    maxRU: number,
    canvasWidth: number,
  ): number {
    const range: number = maxRU - minRU;

    if (range === 0) {
      return Math.round(canvasWidth / 2);
    }

    const normalizedPosition: number = (rankUnit - minRU) / range;

    return Math.round(normalizedPosition * canvasWidth);
  }

  /**
   * Identifies rank indices that are relevant (visible) within the current RU bounds.
   *
   * @param minRU - Current minimum Rank Unit bound.
   * @param maxRU - Current maximum Rank Unit bound.
   * @returns Array of indices pointing to visible thresholds.
   */
  public identifyRelevantThresholds(minRU: number, maxRU: number): number[] {
    const visibleIndices: number[] = Array.from(this._thresholds.keys()).filter(
      (index: number): boolean => index >= minRU && index <= maxRU,
    );

    const highestIndex: number = this._thresholds.length - 1;

    if (visibleIndices.length === 0 && highestIndex >= 0) {
      return [this._getClampedFallbackIndex(minRU, highestIndex)];
    }

    return this._ensureMinimumContext(
      visibleIndices,
      minRU,
      maxRU,
      highestIndex,
    );
  }

  /**
   * Retrieves the index of the highest defined rank threshold.
   *
   * @returns The highest rank index, or -1 if no thresholds exist.
   */
  public getHighestRankIndex(): number {
    return this._thresholds.length - 1;
  }

  /**
   * Calculates bounds aligned to whole rank units.
   *
   * @param minRUScore - Minimum score in RU.
   * @param maxRUScore - Maximum score in RU.
   * @returns Object containing the calculated bounds.
   */
  public calculateAlignedBounds(
    minRUScore: number,
    maxRUScore: number,
  ): { minRU: number; maxRU: number } {
    const minRU: number = Math.floor(minRUScore);
    const maxRU: number = Math.ceil(maxRUScore);

    return {
      minRU,
      maxRU: maxRU === minRU ? minRU + 1 : maxRU,
    };
  }

  /**
   * Calculates view bounds that prioritize fitting relevant thresholds with padding.
   *
   * @param minRUScore - Minimum score in RU.
   * @param maxRUScore - Maximum score in RU.
   * @param thresholdIndices - Indices of thresholds to keep visible.
   * @returns Object containing the calculated bounds.
   */
  public calculateViewBounds(
    minRUScore: number,
    maxRUScore: number,
    thresholdIndices: number[],
  ): { minRU: number; maxRU: number } {
    const minRU: number = minRUScore;
    const maxRU: number = maxRUScore;

    if (thresholdIndices.length === 0) {
      return { minRU, maxRU: maxRU === minRU ? minRU + 1 : maxRU };
    }

    return this._iterativelyRefineBounds(minRU, maxRU, thresholdIndices);
  }

  private _iterativelyRefineBounds(
    initialMin: number,
    initialMax: number,
    thresholdIndices: number[],
  ): { minRU: number; maxRU: number } {
    let minRU: number = initialMin;
    let maxRU: number = initialMax;

    for (let i = 0; i < 5; i++) {
      const range: number = maxRU - minRU || 1;
      const firstT: number = thresholdIndices[0];
      const lastT: number = thresholdIndices[thresholdIndices.length - 1];

      if ((firstT - minRU) / range < 0.1) {
        minRU = (firstT - 0.1 * maxRU) / 0.9;
      }

      if ((lastT - minRU) / range > 0.9) {
        maxRU = (lastT - 0.1 * minRU) / 0.9;
      }
    }

    return { minRU, maxRU };
  }

  private _calculateLowerBoundRU(score: number): number {
    const firstInterval: number = this._thresholds[1]
      ? this._thresholds[1] - this._thresholds[0]
      : this._averageRankInterval;

    const denominator: number = firstInterval || 1;

    return (score - this._thresholds[0]) / denominator;
  }

  private _calculateUpperBoundRU(score: number, lastIndex: number): number {
    const lastInterval: number =
      lastIndex > 0
        ? this._thresholds[lastIndex] - this._thresholds[lastIndex - 1]
        : this._averageRankInterval;

    const denominator: number = lastInterval || 1;

    return lastIndex + (score - this._thresholds[lastIndex]) / denominator;
  }

  private _calculateInternalRU(score: number): number {
    for (let i = 0; i < this._thresholds.length - 1; i++) {
      if (score >= this._thresholds[i] && score <= this._thresholds[i + 1]) {
        const segmentSize: number =
          this._thresholds[i + 1] - this._thresholds[i];

        const progress: number =
          segmentSize === 0 ? 0 : (score - this._thresholds[i]) / segmentSize;

        return i + progress;
      }
    }

    return this._thresholds.length - 1;
  }

  private _getClampedFallbackIndex(minRU: number, highest: number): number {
    return Math.max(0, Math.min(highest, Math.floor(minRU)));
  }

  private _ensureMinimumContext(
    indices: number[],
    minRU: number,
    maxRU: number,
    highest: number,
  ): number[] {
    if (indices.length >= 2 || highest < 1) {
      return Array.from(new Set(indices)).sort((a: number, b: number) => a - b);
    }

    const expanded: number[] = [...indices];

    this._expandIndicesList(expanded, minRU, maxRU, highest);

    return Array.from(new Set(expanded)).sort((a: number, b: number) => a - b);
  }

  private _expandIndicesList(
    indices: number[],
    minRU: number,
    maxRU: number,
    highest: number,
  ): void {
    const isPrimaryThresholdLeft: boolean = this._isThresholdLeftOfCenter(
      highest,
      minRU,
      maxRU,
    );

    if (!isPrimaryThresholdLeft) {
      this._appendAdjacentIndex(indices, indices[0], highest);
    }
  }

  private _isThresholdLeftOfCenter(
    thresholdIndex: number,
    minRU: number,
    maxRU: number,
  ): boolean {
    const range: number = maxRU - minRU;

    if (range === 0) {
      return false;
    }

    const normalizedPosition: number = (thresholdIndex - minRU) / range;

    return normalizedPosition < 0.5;
  }

  private _appendAdjacentIndex(
    indices: number[],
    baseIndex: number,
    maxPossible: number,
  ): void {
    if (baseIndex < maxPossible) {
      indices.push(baseIndex + 1);

      return;
    }

    if (baseIndex > 0) {
      indices.push(baseIndex - 1);
    }
  }
}
