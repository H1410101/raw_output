import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";
import { ScalingService, ScalingLevel } from "../../services/ScalingService";

/**
 * Context for visual styling of an individual score dot.
 */
export interface ScoreVisualContext {
  readonly notchHeight: number;
  readonly baseStyle: string;
  readonly highlightStyle: string;
  readonly latestStyle: string;
  readonly highlightRgb: string;
  readonly localDensity: number;
  readonly peakDensity: number;
}

/**
 * Immutable data snapshot required for a single render pass.
 */
export interface RenderContext {
  readonly scoresInRankUnits: number[];
  readonly timestamps: number[];
  readonly sortedThresholds: [string, number][];
  readonly bounds: { minRU: number; maxRU: number };
  readonly isLatestFromSession: boolean;
  readonly settings: VisualSettings;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
    readonly dotRadius: number;
    readonly rootFontSize: number;
  };
}

/**
 * Responsibility: Perform low-level Canvas drawing operations for the Dot Cloud.
 * Handles the rendering of rank notches, labels, and performance dots with specific styles.
 */
export class DotCloudCanvasRenderer {
  private readonly _context: CanvasRenderingContext2D;

  private readonly _mapper: RankScaleMapper;

  /**
   * Initializes the renderer with canvas context and visual configuration.
   *
   * @param context - The 2D rendering context.
   * @param mapper - Mapper for rank and coordinate calculations.
   */
  public constructor(
    context: CanvasRenderingContext2D,
    mapper: RankScaleMapper,
  ) {
    this._context = context;
    this._mapper = mapper;
  }

  /**
   * Clears the entire canvas area based on current dimensions.
   *
   * @param width - The width of the canvas.
   * @param height - The height of the canvas.
   */
  public clear(width: number, height: number): void {
    this._context.clearRect(0, 0, width, height);
  }

  /**
   * Orchestrates a complete draw cycle using a provided context.
   *
   * @param context - The render context to use.
   */
  public draw(context: RenderContext): void {
    this.clear(context.dimensions.width, context.dimensions.height);

    this.drawMetadata(context);

    // Calculate density context for jitter
    const densities: number[] = this._calculateLocalDensities(
      context.scoresInRankUnits,
    );
    const peakDensity: number =
      densities.length > 0 ? Math.max(...densities) : 1;

    this.drawPerformanceDots(context, densities, peakDensity);
  }

  /**
   * Draws the rank notches and labels on the canvas.
   *
   * @param context - The render context to use.
   */
  public drawMetadata(context: RenderContext): void {
    const rootFontSize: number = context.dimensions.rootFontSize;
    const notchHeight: number = this._calculateNotchHeight(
      rootFontSize,
      context.dimensions.height,
      context.settings,
    );

    this._setupLabelStyles(rootFontSize, context.settings);

    const styles: CSSStyleDeclaration = getComputedStyle(this._context.canvas);
    const labelColor: string =
      styles.getPropertyValue("--vis-label-color").trim() || "#3d527a";

    const indices: number[] = this._mapper.identifyRelevantThresholds(
      context.bounds.minRU,
      context.bounds.maxRU,
    );

    indices.forEach((idx: number): void => {
      this._renderThresholdMetadata(idx, notchHeight, labelColor, context);
    });
  }

  /**
   * Draws the performance dots representing historical scores.
   *
   * @param context - The render context to use.
   * @param densities - Array of local densities corresponding to context.scores.
   * @param peakDensity - Maximum density value in the current dataset.
   */
  public drawPerformanceDots(
    context: RenderContext,
    densities: number[],
    peakDensity: number,
  ): void {
    const rootFontSize: number = context.dimensions.rootFontSize;
    const notchHeight: number = this._calculateNotchHeight(
      rootFontSize,
      context.dimensions.height,
      context.settings,
    );

    const styles: CSSStyleDeclaration = getComputedStyle(this._context.canvas);
    const opacity: number = this._getNormalizedOpacity(context.settings);

    const baseStyle: string = this._getBaseFillStyle(styles, opacity);
    const highlightStyle: string = this._getHighlightFillStyle(styles, opacity);
    const latestStyle: string = this._getLatestFillStyle(styles, opacity);
    const highlightRgb: string =
      styles.getPropertyValue("--vis-highlight-rgb").trim() || "84, 133, 171";

    this._setupStrokeStyles(styles, opacity, context.dimensions.dotRadius);

    for (let i = context.scoresInRankUnits.length - 1; i >= 0; i--) {
      this._renderIndividualScore(context.scoresInRankUnits[i], i, context, {
        notchHeight,
        baseStyle,
        highlightStyle,
        latestStyle,
        highlightRgb,
        localDensity: densities[i] || 1,
        peakDensity,
      });
    }
  }

  private _renderThresholdMetadata(
    index: number,
    notchHeight: number,
    labelColor: string,
    context: RenderContext,
  ): void {
    const [name]: [string, number] = context.sortedThresholds[index];

    const x: number = this._mapper.getHorizontalPosition(
      index,
      context.bounds.minRU,
      context.bounds.maxRU,
      context.dimensions.width,
    );

    this._drawVerticalNotch(x, notchHeight, labelColor, context.settings);

    this._drawClampedRankLabel(
      name.toUpperCase(),
      x,
      labelColor,
      context.dimensions,
    );
  }

  private _renderIndividualScore(
    score: number,
    index: number,
    context: RenderContext,
    visuals: ScoreVisualContext,
  ): void {
    const x: number = this._calculateHorizontalPosition(
      score,
      context.bounds,
      context.dimensions.width,
    );

    const finalY: number = this._calculateFinalY(context, index, visuals);

    const isLatest: boolean =
      index === 0 && context.settings.highlightLatestRun;
    const isSessionHighlight: boolean = isLatest && context.isLatestFromSession;

    let dotStyle: string = visuals.baseStyle;
    if (isSessionHighlight) {
      dotStyle = visuals.highlightStyle;
    } else if (isLatest) {
      dotStyle = visuals.latestStyle;
    }

    this._drawDot({ x, y: finalY }, isSessionHighlight, {
      style: dotStyle,
      dotRadius: context.dimensions.dotRadius,
      highlightRgb: visuals.highlightRgb,
    });
  }

  private _calculateHorizontalPosition(
    rankUnit: number,
    bounds: { minRU: number; maxRU: number },
    canvasWidth: number,
  ): number {
    return this._mapper.getHorizontalPosition(
      rankUnit,
      bounds.minRU,
      bounds.maxRU,
      canvasWidth,
    );
  }

  private _calculateFinalY(
    context: RenderContext,
    index: number,
    visuals: ScoreVisualContext,
  ): number {
    const jitterY: number = this._calculateVerticalJitter(
      context,
      index,
      visuals,
    );

    return visuals.notchHeight / 2 + jitterY;
  }

  private _drawDot(
    position: { x: number; y: number },
    useGlow: boolean,
    styles: { style: string; dotRadius: number; highlightRgb: string },
  ): void {
    this._context.fillStyle = styles.style;

    if (useGlow) {
      this._applyHighlightShadow(styles.dotRadius, styles.highlightRgb);
    }

    this._context.beginPath();

    this._context.arc(position.x, position.y, styles.dotRadius, 0, Math.PI * 2);

    this._context.fill();

    this._context.stroke();

    if (useGlow) {
      this._context.shadowBlur = 0;
    }
  }

  private _drawVerticalNotch(
    x: number,
    height: number,
    labelColor: string,
    settings: VisualSettings,
  ): void {
    if (!settings.showRankNotches) {
      return;
    }

    this._context.strokeStyle = labelColor;

    this._context.globalAlpha = 0.4;

    this._context.lineWidth = 1;

    this._context.beginPath();

    this._context.moveTo(x, 0);

    this._context.lineTo(x, height);

    this._context.stroke();

    this._context.globalAlpha = 1.0;
  }

  private _drawClampedRankLabel(
    text: string,
    x: number,
    labelColor: string,
    dimensions: { width: number; height: number },
  ): void {
    this._context.fillStyle = labelColor;

    const metrics: TextMetrics = this._context.measureText(text);

    const halfWidth: number = metrics.width / 2;

    const clampedX: number = Math.round(
      Math.max(halfWidth, Math.min(dimensions.width - halfWidth, x)),
    );

    this._context.fillText(text, clampedX, Math.floor(dimensions.height));
  }

  private _calculateLocalDensities(rankUnits: number[]): number[] {
    const windowSizeInRu: number = 0.5;

    return rankUnits.map((target: number): number => {
      return rankUnits
        .filter(
          (rankUnit: number): boolean =>
            Math.abs(rankUnit - target) <= windowSizeInRu,
        )
        .map((rankUnit: number): number =>
          Math.pow(Math.abs(rankUnit - target) / windowSizeInRu, 1),
        )
        .reduce((a: number, b: number): number => a + b, 0);
    });
  }

  /**
   * A seeded pseudorandom number generator function based on splitmix64.
   *
   * Found at https://gist.github.com/tommyettinger/46a874533244883189143505d203312c.
   * Credit to @tommyettinger for the algorithm, and deleted user @ghost for implementation in javascript.
   *
   * @param seed - The seed value to use for the random number generator.
   * @returns number between -1 and 1.
   */
  private _seededRandom(seed: number): number {
    let z: number = (seed += 0x9e3779b9);
    z ^= z >>> 16;
    z = Math.imul(z, 0x21f0aaad);
    z ^= z >>> 15;
    z = Math.imul(z, 0x735a2d97);
    z ^= z >>> 15;

    return ((z >>> 0) / 0xffffffff) * 2 - 1;
  }

  private _calculateVerticalJitter(
    context: RenderContext,
    index: number,
    visuals: ScoreVisualContext,
  ): number {
    const jitterMultiplier: number = this._getJitterMultiplier(
      context.settings.dotJitterIntensity,
    );

    if (jitterMultiplier === 0 || visuals.localDensity <= 1) {
      return 0;
    }

    const totalCount: number = context.scoresInRankUnits.length;
    const maxJitter: number =
      visuals.notchHeight / 2 - context.dimensions.dotRadius;

    const densityRatio: number = Math.pow(
      visuals.localDensity / visuals.peakDensity,
      3,
    );
    const popRatio: number = 0.25 + (0.75 * totalCount) / 100;

    const localMax: number =
      maxJitter * jitterMultiplier * densityRatio * popRatio;

    const seed: number = context.timestamps[index] ?? index;

    return this._seededRandom(seed) * localMax;
  }

  private _getJitterMultiplier(level: ScalingLevel): number {
    const JITTER_MAP: Record<string, number> = {
      min: 0,
      small: 0.25,
      normal: 0.5,
      large: 0.75,
      max: 1,
    };

    return JITTER_MAP[level.toLowerCase()] ?? 0;
  }

  private _calculateNotchHeight(
    rootFontSize: number,
    canvasHeight: number,
    settings: VisualSettings,
  ): number {
    const multiplier: number = ScalingService.calculateMultiplier(
      settings.masterScaling,
      settings.visRankFontSize,
    );
    const rankFontSize: number = rootFontSize * 0.5 * multiplier;
    const gap: number = rankFontSize * 0.2;
    const labelBuffer: number = rankFontSize + gap;

    return canvasHeight - labelBuffer;
  }

  private _getNormalizedOpacity(settings: VisualSettings): number {
    return Math.max(0, Math.min(1, settings.dotOpacity / 100));
  }

  private _setupLabelStyles(
    rootFontSize: number,
    settings: VisualSettings,
  ): void {
    const multiplier: number = ScalingService.calculateMultiplier(
      settings.masterScaling,
      settings.visRankFontSize,
    );
    const fontSize: number = rootFontSize * 0.5 * multiplier;

    this._context.font = `600 ${fontSize}px Outfit, sans-serif`;

    this._context.textAlign = "center";

    this._context.textBaseline = "bottom";
  }

  private _getBaseFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string =
      styles.getPropertyValue("--vis-dot-rgb").trim() || "61, 82, 122";

    return `rgba(${rgb}, ${opacity})`;
  }

  private _getHighlightFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string =
      styles.getPropertyValue("--vis-highlight-rgb").trim() || "84, 133, 171";

    return `rgba(${rgb}, ${Math.min(1, opacity + 0.4)})`;
  }

  private _getLatestFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string =
      styles.getPropertyValue("--vis-latest-rgb").trim() || "73, 108, 147";

    return `rgba(${rgb}, ${Math.min(1, opacity + 0.2)})`;
  }

  private _setupStrokeStyles(
    styles: CSSStyleDeclaration,
    opacity: number,
    dotRadius: number,
  ): void {
    const rgb: string =
      styles.getPropertyValue("--vis-dot-rgb").trim() || "61, 82, 122";

    this._context.strokeStyle = `rgba(${rgb}, ${Math.min(0.2, opacity)})`;

    this._context.lineWidth = dotRadius * 0.5;
  }

  private _applyHighlightShadow(dotRadius: number, highlightRgb: string): void {
    this._context.shadowColor = `rgba(${highlightRgb}, 0.8)`;

    this._context.shadowBlur = dotRadius * 2;
  }
}
