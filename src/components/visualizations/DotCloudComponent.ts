/**
 * Responsibility: Render a "Dot Cloud" (Strip Plot) of recent performance data.
 * Uses a non-linear segmented scale where the visual distance between rank thresholds is uniform.
 * Anchors the visualization range to recent performance to reflect skill improvement.
 */
export class DotCloudComponent {
  private readonly _recentScores: number[];

  private readonly _rankThresholds: Record<string, number>;

  private readonly _averageRankInterval: number;

  private _canvasWidth: number = 160;

  private _canvasHeight: number = 24;

  private _microDotRadius: number = 1;

  constructor(
    scores: number[],
    thresholds: Record<string, number>,
    rankInterval: number = 100,
  ) {
    this._rankThresholds = thresholds;

    this._averageRankInterval = rankInterval;

    this._recentScores = this._processTemporalScores(scores);
  }

  public render(): HTMLElement {
    const container = document.createElement("div");

    container.className = "dot-cloud-container";

    if (this._recentScores.length === 0) {
      return container;
    }

    container.appendChild(this._createScaledCanvas());

    return container;
  }

  private _createScaledCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");

    const dpr = window.devicePixelRatio || 1;

    const root_font_size = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    this._canvasWidth = Math.round(14 * root_font_size);

    this._canvasHeight = Math.round(2 * root_font_size);

    this._microDotRadius = root_font_size * 0.1;

    const superSamplingFactor = 2;

    const totalScale = dpr * superSamplingFactor;

    canvas.width = Math.round(this._canvasWidth * totalScale);

    canvas.height = Math.round(this._canvasHeight * totalScale);

    canvas.style.width = `${this._canvasWidth}px`;

    canvas.style.height = `${this._canvasHeight}px`;

    const context = canvas.getContext("2d");

    if (context) {
      context.scale(totalScale, totalScale);

      this._renderVisualization(context);
    }

    return canvas;
  }

  private _renderVisualization(context: CanvasRenderingContext2D): void {
    const sortedPairs = Object.entries(this._rankThresholds).sort(
      (a, b) => a[1] - b[1],
    );

    const thresholdValues = sortedPairs.map((p) => p[1]);

    const minScore = Math.min(...this._recentScores);

    const maxScore = Math.max(...this._recentScores);

    const minRU_score = this._calculateRankUnit(minScore, thresholdValues);

    const maxRU_score = this._calculateRankUnit(maxScore, thresholdValues);

    const targetThresholdIndices = this._identifyRelevantThresholds(
      minRU_score,
      maxRU_score,
      thresholdValues,
    );

    const { minRU, maxRU } = this._calculateViewBounds(
      minRU_score,
      maxRU_score,
      targetThresholdIndices,
    );

    this._drawRankMetadata(context, sortedPairs, minRU, maxRU, thresholdValues);

    this._drawPerformanceDots(context, minRU, maxRU, thresholdValues);
  }

  private _processTemporalScores(scores: number[]): number[] {
    const validScores = scores.filter(
      (score) => typeof score === "number" && !isNaN(score),
    );

    if (validScores.length === 0) return [];

    const nonOutliers = this._filterBottomOutliers(validScores);

    if (nonOutliers.length === 0) return [];

    const recentSample = nonOutliers.slice(0, 20);

    const temporalMinBound = Math.min(...recentSample);

    const maxHistorical = Math.max(...nonOutliers);

    return nonOutliers.filter(
      (score) => score >= temporalMinBound && score <= maxHistorical,
    );
  }

  private _filterBottomOutliers(scores: number[]): number[] {
    const sorted = [...scores].sort((a, b) => a - b);

    const dropCount = scores.length >= 10 ? Math.ceil(sorted.length * 0.05) : 0;

    const outlierThreshold = sorted[dropCount - 1] ?? -Infinity;

    return scores.filter((score) => score > outlierThreshold);
  }

  private _identifyRelevantThresholds(
    minRU: number,
    maxRU: number,
    thresholds: number[],
  ): number[] {
    const visibleIndices = thresholds
      .map((_, index) => index)
      .filter((index) => index >= minRU && index <= maxRU);

    const highestIndex = thresholds.length - 1;

    if (visibleIndices.length === 0 && highestIndex >= 0) {
      const fallbackIndex = Math.max(
        0,
        Math.min(highestIndex, Math.floor(minRU)),
      );

      visibleIndices.push(fallbackIndex);
    }

    return this._ensureTwoRanks(visibleIndices, minRU, maxRU, highestIndex);
  }

  private _ensureTwoRanks(
    indices: number[],
    minRU: number,
    maxRU: number,
    highestIndex: number,
  ): number[] {
    if (indices.length >= 2 || highestIndex < 1) {
      return Array.from(new Set(indices)).sort((a, b) => a - b);
    }

    const isHighestRankOnLeft = this._isThresholdLeftOfCenter(
      highestIndex,
      minRU,
      maxRU,
    );

    if (!isHighestRankOnLeft) {
      this._expandThresholdContext(indices, indices[0], highestIndex);
    }

    return Array.from(new Set(indices)).sort((a, b) => a - b);
  }

  private _isThresholdLeftOfCenter(
    thresholdIndex: number,
    minRU: number,
    maxRU: number,
  ): boolean {
    const range = maxRU - minRU;

    if (range === 0) return false;

    const normalized = (thresholdIndex - minRU) / range;

    return normalized < 0.5;
  }

  private _expandThresholdContext(
    indices: number[],
    base: number,
    maxPossible: number,
  ): void {
    if (base < maxPossible) {
      indices.push(base + 1);
    } else if (base > 0) {
      indices.push(base - 1);
    }
  }

  private _calculateViewBounds(
    minRU_score: number,
    maxRU_score: number,
    thresholdIndices: number[],
  ): { minRU: number; maxRU: number } {
    let minRU = minRU_score;

    let maxRU = maxRU_score;

    if (thresholdIndices.length === 0) {
      return { minRU, maxRU: maxRU === minRU ? minRU + 1 : maxRU };
    }

    for (let i = 0; i < 5; i++) {
      const range = maxRU - minRU || 1;

      const firstT = thresholdIndices[0];

      const lastT = thresholdIndices[thresholdIndices.length - 1];

      const leftX = (firstT - minRU) / range;

      if (leftX < 0.1) {
        minRU = (firstT - 0.1 * maxRU) / 0.9;
      }

      const rightX = (lastT - minRU) / range;

      if (rightX > 0.9) {
        maxRU = (lastT - 0.1 * minRU) / 0.9;
      }
    }

    return { minRU, maxRU };
  }

  private _calculateNotchHeight(rootFontSize: number): number {
    const labelBuffer = rootFontSize * 0.7;

    return this._canvasHeight - labelBuffer;
  }

  private _calculateRankUnit(score: number, thresholds: number[]): number {
    if (thresholds.length === 0) {
      return score / this._averageRankInterval;
    }

    if (score < thresholds[0]) {
      const interval = thresholds[1]
        ? thresholds[1] - thresholds[0]
        : this._averageRankInterval;

      return (score - thresholds[0]) / (interval || 1);
    }

    const lastIdx = thresholds.length - 1;

    if (score > thresholds[lastIdx]) {
      const interval =
        lastIdx > 0
          ? thresholds[lastIdx] - thresholds[lastIdx - 1]
          : this._averageRankInterval;

      return lastIdx + (score - thresholds[lastIdx]) / (interval || 1);
    }

    for (let i = 0; i < lastIdx; i++) {
      if (score >= thresholds[i] && score <= thresholds[i + 1]) {
        const seg = thresholds[i + 1] - thresholds[i];

        return i + (seg === 0 ? 0 : (score - thresholds[i]) / seg);
      }
    }

    return lastIdx;
  }

  private _drawRankMetadata(
    context: CanvasRenderingContext2D,
    sortedPairs: [string, number][],
    minRU: number,
    maxRU: number,
    thresholds: number[],
  ): void {
    const root_font_size = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    const notchHeight = this._calculateNotchHeight(root_font_size);

    const font_size = root_font_size * 0.5;

    context.font = `600 ${font_size}px Outfit, sans-serif`;

    context.textAlign = "center";

    context.textBaseline = "bottom";

    const indices = this._identifyRelevantThresholds(minRU, maxRU, thresholds);

    indices.forEach((idx) => {
      const [name, _] = sortedPairs[idx];

      const x = this._getHorizontalPosition(idx, minRU, maxRU);

      this._drawVerticalNotch(context, x, notchHeight);

      this._drawClampedRankLabel(context, name.toUpperCase(), x);
    });
  }

  private _getHorizontalPosition(
    ru: number,
    minRU: number,
    maxRU: number,
  ): number {
    const range = maxRU - minRU;

    if (range === 0) return Math.round(this._canvasWidth / 2);

    return Math.round(((ru - minRU) / range) * this._canvasWidth);
  }

  private _drawVerticalNotch(
    context: CanvasRenderingContext2D,
    x: number,
    height: number,
  ): void {
    context.strokeStyle = "rgba(255, 255, 255, 0.1)";

    context.lineWidth = 1;

    context.beginPath();

    context.moveTo(x, 0);

    context.lineTo(x, height);

    context.stroke();
  }

  private _drawClampedRankLabel(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
  ): void {
    context.fillStyle = "rgba(255, 255, 255, 0.4)";

    const metrics = context.measureText(text);

    const half = metrics.width / 2;

    const clampedX = Math.round(
      Math.max(half, Math.min(this._canvasWidth - half, x)),
    );

    context.fillText(text, clampedX, Math.floor(this._canvasHeight));
  }

  private _drawPerformanceDots(
    context: CanvasRenderingContext2D,
    minRU: number,
    maxRU: number,
    thresholds: number[],
  ): void {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    const notchHeight = this._calculateNotchHeight(rootFontSize);

    context.fillStyle = "rgba(0, 242, 255, 0.6)";

    context.strokeStyle = "rgba(255, 255, 255, 0.2)";

    context.lineWidth = this._microDotRadius * 0.5;

    this._recentScores.forEach((score) => {
      const ru = this._calculateRankUnit(score, thresholds);

      const x = this._getHorizontalPosition(ru, minRU, maxRU);

      const density = this._calculateLocalDensity(score);

      const jitterY = this._calculateVerticalJitter(density, notchHeight);

      const finalY = notchHeight / 2 + jitterY;

      context.beginPath();

      context.arc(x, finalY, this._microDotRadius, 0, Math.PI * 2);

      context.fill();

      context.stroke();
    });
  }

  private _calculateLocalDensity(target: number): number {
    const win = this._averageRankInterval * 0.05;

    return this._recentScores.filter((s) => Math.abs(s - target) <= win).length;
  }

  private _calculateVerticalJitter(density: number, height: number): number {
    if (density <= 1) return 0;

    const intensity = Math.min((density - 1) / 14, 1);

    const range = height * 0.6 * intensity;

    return (Math.random() - 0.5) * range;
  }
}
