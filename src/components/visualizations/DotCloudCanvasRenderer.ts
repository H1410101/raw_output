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

  constructor(
    context: CanvasRenderingContext2D,
    settings: VisualSettings,
    mapper: RankScaleMapper,
    width: number,
    height: number,
    dotRadius: number,
  ) {
    this._context = context;
    this._settings = settings;
    this._mapper = mapper;
    this._canvasWidth = width;
    this._canvasHeight = height;
    this._dotRadius = dotRadius;
  }

  /**
   * Draws the rank notches and labels on the canvas.
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

    indices.forEach((idx: number) => {
      this._renderThresholdMetadata(
        idx,
        sortedPairs,
        minRU,
        maxRU,
        notchHeight,
      );
    });
  }

  /**
   * Draws the performance dots representing historical scores.
   */
  public drawPerformanceDots(
    scores: number[],
    minRU: number,
    maxRU: number,
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

    scores.forEach((score: number, index: number) => {
      this._renderIndividualScore(
        score,
        index,
        scores,
        minRU,
        maxRU,
        notchHeight,
        baseStyle,
        highlightStyle,
      );
    });
  }

  private _renderThresholdMetadata(
    index: number,
    sortedPairs: [string, number][],
    minRU: number,
    maxRU: number,
    notchHeight: number,
  ): void {
    const [name]: [string, number] = sortedPairs[index];
    const x: number = this._mapper.getHorizontalPosition(
      index,
      minRU,
      maxRU,
      this._canvasWidth,
    );

    this._drawVerticalNotch(x, notchHeight);
    this._drawClampedRankLabel(name.toUpperCase(), x);
  }

  private _renderIndividualScore(
    score: number,
    index: number,
    allScores: number[],
    minRU: number,
    maxRU: number,
    notchHeight: number,
    baseStyle: string,
    highlightStyle: string,
  ): void {
    const ru: number = this._mapper.calculateRankUnit(score);
    const x: number = this._mapper.getHorizontalPosition(
      ru,
      minRU,
      maxRU,
      this._canvasWidth,
    );

    const density: number = this._calculateLocalDensity(score, allScores);
    const jitterY: number = this._calculateVerticalJitter(density, notchHeight);
    const finalY: number = notchHeight / 2 + jitterY;

    const isRecent: boolean = index === 0 && this._settings.highlightRecent;
    this._drawDot(x, finalY, isRecent, baseStyle, highlightStyle);
  }

  private _drawDot(
    x: number,
    y: number,
    isRecent: boolean,
    baseStyle: string,
    highlightStyle: string,
  ): void {
    this._context.fillStyle = isRecent ? highlightStyle : baseStyle;

    if (isRecent) {
      this._applyHighlightShadow();
    }

    this._context.beginPath();
    this._context.arc(x, y, this._dotRadius, 0, Math.PI * 2);
    this._context.fill();
    this._context.stroke();

    if (isRecent) {
      this._context.shadowBlur = 0;
    }
  }

  private _drawVerticalNotch(x: number, height: number): void {
    if (!this._settings.showGridLines) {
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
    this._context.fillStyle =
      styles.getPropertyValue("--lower-band-1").trim() || "#3d527a";

    const metrics: TextMetrics = this._context.measureText(text);
    const halfWidth: number = metrics.width / 2;

    const clampedX: number = Math.round(
      Math.max(halfWidth, Math.min(this._canvasWidth - halfWidth, x)),
    );

    this._context.fillText(text, clampedX, Math.floor(this._canvasHeight));
  }

  private _calculateLocalDensity(target: number, scores: number[]): number {
    const windowSize: number = 5; // Fixed context window for density
    return scores.filter((s: number) => Math.abs(s - target) <= windowSize)
      .length;
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
