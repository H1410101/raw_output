import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";

/**
 * Responsibility: Perform low-level Canvas drawing operations for the Dot Cloud.
 * Handles the rendering of rank notches, labels, and performance dots with specific styles.
 */
export class DotCloudCanvasRenderer {
  private readonly _context: CanvasRenderingContext2D;
  private readonly _settings: VisualSettings;
  private readonly _mapper: RankScaleMapper;
  private readonly _canvasWidth: number;
  private readonly _canvasHeight: number;
  private readonly _dotRadius: number;

  /**
   * Initializes the renderer with canvas context and visual configuration.
   *
   * @param context - The 2D rendering context.
   * @param settings - Visual settings for dots and grids.
   * @param mapper - Mapper for rank and coordinate calculations.
   * @param dimensions - Object containing canvas dimensions and dot radius.
   * @param dimensions.width - The width of the canvas.
   * @param dimensions.height - The height of the canvas.
   * @param dimensions.dotRadius - The radius of the performance dots.
   */
  public constructor(
    context: CanvasRenderingContext2D,
    settings: VisualSettings,
    mapper: RankScaleMapper,
    dimensions: { width: number; height: number; dotRadius: number },
  ) {
    this._context = context;
    this._settings = settings;
    this._mapper = mapper;
    this._canvasWidth = dimensions.width;
    this._canvasHeight = dimensions.height;
    this._dotRadius = dimensions.dotRadius;
  }

  /**
   * Draws the rank notches and labels on the canvas.
   *
   * @param sortedPairs - Array of rank names and their threshold values.
   * @param minRU - Minimum rank unit in the current view.
   * @param maxRU - Maximum rank unit in the current view.
   */
  public drawMetadata(
    sortedPairs: [string, number][],
    minRU: number,
    maxRU: number,
  ): void {
    const rootFontSize: number = this._getRootFontSize();
    const notchHeight: number = this._calculateNotchHeight(rootFontSize);

    this._setupLabelStyles(rootFontSize);

    const indices: number[] = this._mapper.identifyRelevantThresholds(
      minRU,
      maxRU,
    );

    indices.forEach((idx: number): void => {
      this._renderThresholdMetadata(
        idx,
        sortedPairs,
        { minRU, maxRU },
        notchHeight,
      );
    });
  }

  /**
   * Draws the performance dots representing historical scores.
   *
   * @param scores - Array of historical score values.
   * @param minRU - Minimum rank unit in the current view.
   * @param maxRU - Maximum rank unit in the current view.
   * @param isLatestFromSession - Whether the latest score is from the current session.
   */
  public drawPerformanceDots(
    scores: number[],
    minRU: number,
    maxRU: number,
    isLatestFromSession: boolean = false,
  ): void {
    const rootFontSize: number = this._getRootFontSize();
    const notchHeight: number = this._calculateNotchHeight(rootFontSize);
    const opacity: number = this._getNormalizedOpacity();

    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );
    const baseStyle: string = this._getBaseFillStyle(styles, opacity);
    const highlightStyle: string = this._getHighlightFillStyle(styles, opacity);

    this._setupStrokeStyles(styles, opacity);

    scores.forEach((score: number, index: number): void => {
      this._renderIndividualScore(
        score,
        index,
        { allScores: scores, minRU, maxRU, isLatestFromSession },
        { notchHeight, baseStyle, highlightStyle },
      );
    });
  }

  private _renderThresholdMetadata(
    index: number,
    sortedPairs: [string, number][],
    bounds: { minRU: number; maxRU: number },
    notchHeight: number,
  ): void {
    const [name]: [string, number] = sortedPairs[index];
    const x: number = this._mapper.getHorizontalPosition(
      index,
      bounds.minRU,
      bounds.maxRU,
      this._canvasWidth,
    );

    this._drawVerticalNotch(x, notchHeight);
    this._drawClampedRankLabel(name.toUpperCase(), x);
  }

  private _renderIndividualScore(
    score: number,
    index: number,
    performance: {
      allScores: number[];
      minRU: number;
      maxRU: number;
      isLatestFromSession: boolean;
    },
    visuals: { notchHeight: number; baseStyle: string; highlightStyle: string },
  ): void {
    const x: number = this._calculateHorizontalPosition(score, performance);

    const finalY: number = this._calculateFinalY(
      score,
      performance.allScores,
      visuals.notchHeight,
    );

    const isRecent: boolean = this._isLatestSessionRun(
      index,
      performance.isLatestFromSession,
    );

    this._drawDot({ x, y: finalY }, isRecent, {
      base: visuals.baseStyle,
      highlight: visuals.highlightStyle,
    });
  }

  private _calculateHorizontalPosition(
    score: number,
    performance: { minRU: number; maxRU: number },
  ): number {
    const rankUnit: number = this._mapper.calculateRankUnit(score);

    return this._mapper.getHorizontalPosition(
      rankUnit,
      performance.minRU,
      performance.maxRU,
      this._canvasWidth,
    );
  }

  private _calculateFinalY(
    score: number,
    allScores: number[],
    notchHeight: number,
  ): number {
    const density: number = this._calculateLocalDensity(score, allScores);

    const jitterY: number = this._calculateVerticalJitter(density, notchHeight);

    return notchHeight / 2 + jitterY;
  }

  private _isLatestSessionRun(
    index: number,
    isLatestFromSession: boolean,
  ): boolean {
    return (
      index === 0 && this._settings.highlightLatestRun && isLatestFromSession
    );
  }

  private _drawDot(
    position: { x: number; y: number },
    isRecent: boolean,
    styles: { base: string; highlight: string },
  ): void {
    this._context.fillStyle = isRecent ? styles.highlight : styles.base;

    if (isRecent) {
      this._applyHighlightShadow();
    }

    this._context.beginPath();
    this._context.arc(position.x, position.y, this._dotRadius, 0, Math.PI * 2);
    this._context.fill();
    this._context.stroke();

    if (isRecent) {
      this._context.shadowBlur = 0;
    }
  }

  private _drawVerticalNotch(x: number, height: number): void {
    if (!this._settings.showRankNotches) {
      return;
    }

    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );
    const rgb: string = styles.getPropertyValue("--lower-band-2-rgb").trim();

    this._context.strokeStyle = `rgba(${rgb || "73, 108, 147"}, 0.4)`;
    this._context.lineWidth = 1;

    this._context.beginPath();
    this._context.moveTo(x, 0);
    this._context.lineTo(x, height);
    this._context.stroke();
  }

  private _drawClampedRankLabel(text: string, x: number): void {
    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );
    this._context.fillStyle = styles.getPropertyValue("--lower-band-1").trim();

    const metrics: TextMetrics = this._context.measureText(text);
    const halfWidth: number = metrics.width / 2;

    const clampedX: number = Math.round(
      Math.max(halfWidth, Math.min(this._canvasWidth - halfWidth, x)),
    );

    this._context.fillText(text, clampedX, Math.floor(this._canvasHeight));
  }

  private _calculateLocalDensity(target: number, scores: number[]): number {
    const windowSize: number = 5;

    return scores.filter(
      (score: number): boolean => Math.abs(score - target) <= windowSize,
    ).length;
  }

  private _calculateVerticalJitter(density: number, height: number): number {
    if (!this._settings.dotJitter || density <= 1) {
      return 0;
    }

    const intensity: number = Math.min((density - 1) / 14, 1);
    const range: number = height * 0.6 * intensity;

    return (Math.random() - 0.5) * range;
  }

  private _getRootFontSize(): number {
    return parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  private _calculateNotchHeight(rootFontSize: number): number {
    const labelBuffer: number = rootFontSize * 0.7;

    return this._canvasHeight - labelBuffer;
  }

  private _getNormalizedOpacity(): number {
    return Math.max(0, Math.min(1, this._settings.dotOpacity / 100));
  }

  private _setupLabelStyles(rootFontSize: number): void {
    const fontSize: number = rootFontSize * 0.5;
    this._context.font = `600 ${fontSize}px Outfit, sans-serif`;
    this._context.textAlign = "center";
    this._context.textBaseline = "bottom";
  }

  private _getBaseFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string =
      styles.getPropertyValue("--lower-band-1-rgb").trim() || "61, 82, 122";

    return `rgba(${rgb}, ${opacity})`;
  }

  private _getHighlightFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string =
      styles.getPropertyValue("--highlight-font-1-rgb").trim() ||
      "224, 217, 187";

    return `rgba(${rgb}, ${Math.min(1, opacity + 0.3)})`;
  }

  private _setupStrokeStyles(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): void {
    const rgb: string =
      styles.getPropertyValue("--lower-band-1-rgb").trim() || "61, 82, 122";
    this._context.strokeStyle = `rgba(${rgb}, ${Math.min(0.2, opacity)})`;
    this._context.lineWidth = this._dotRadius * 0.5;
  }

  private _applyHighlightShadow(): void {
    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );
    const rgb: string =
      styles.getPropertyValue("--highlight-font-1-rgb").trim() ||
      "224, 217, 187";
    this._context.shadowColor = `rgba(${rgb}, 0.8)`;
    this._context.shadowBlur = this._dotRadius * 2;
  }
}
