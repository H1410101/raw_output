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

    const indices: number[] = this._mapper.identifyRelevantThresholds(
      context.bounds.minRU,
      context.bounds.maxRU,
    );

    indices.forEach((idx: number): void => {
      this._renderThresholdMetadata(idx, notchHeight, context);
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

    const opacity: number = this._getNormalizedOpacity(context.settings);

    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );

    const baseStyle: string = this._getBaseFillStyle(styles, opacity);

    const highlightStyle: string = this._getHighlightFillStyle(styles, opacity);

    this._setupStrokeStyles(styles, opacity, context.dimensions.dotRadius);

    for (let i = context.scoresInRankUnits.length - 1; i >= 0; i--) {
      const visuals: ScoreVisualContext = {
        notchHeight,
        baseStyle,
        highlightStyle,
        localDensity: densities[i] || 1,
        peakDensity,
      };

      this._renderIndividualScore(
        context.scoresInRankUnits[i],
        i,
        context,
        visuals,
      );
    }
  }

  private _renderThresholdMetadata(
    index: number,
    notchHeight: number,
    context: RenderContext,
  ): void {
    const [name]: [string, number] = context.sortedThresholds[index];

    const x: number = this._mapper.getHorizontalPosition(
      index,
      context.bounds.minRU,
      context.bounds.maxRU,
      context.dimensions.width,
    );

    this._drawVerticalNotch(x, notchHeight, context.settings);

    this._drawClampedRankLabel(
      name.toUpperCase(),
      x,
      context.dimensions.width,
      context.dimensions.height,
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

    const isRecent: boolean = this._isLatestSessionRun(
      index,
      context.isLatestFromSession,
      context.settings,
    );

    this._drawDot({ x, y: finalY }, isRecent, {
      base: visuals.baseStyle,
      highlight: visuals.highlightStyle,
      dotRadius: context.dimensions.dotRadius,
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

  private _isLatestSessionRun(
    index: number,
    isLatestFromSession: boolean,
    settings: VisualSettings,
  ): boolean {
    return index === 0 && settings.highlightLatestRun && isLatestFromSession;
  }

  private _drawDot(
    position: { x: number; y: number },
    isRecent: boolean,
    styles: { base: string; highlight: string; dotRadius: number },
  ): void {
    this._context.fillStyle = isRecent ? styles.highlight : styles.base;

    if (isRecent) {
      this._applyHighlightShadow(styles.dotRadius);
    }

    this._context.beginPath();

    this._context.arc(position.x, position.y, styles.dotRadius, 0, Math.PI * 2);

    this._context.fill();

    this._context.stroke();

    if (isRecent) {
      this._context.shadowBlur = 0;
    }
  }

  private _drawVerticalNotch(
    x: number,
    height: number,
    settings: VisualSettings,
  ): void {
    if (!settings.showRankNotches) {
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

  private _drawClampedRankLabel(
    text: string,
    x: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );

    this._context.fillStyle = styles.getPropertyValue("--lower-band-1").trim();

    const metrics: TextMetrics = this._context.measureText(text);

    const halfWidth: number = metrics.width / 2;

    const clampedX: number = Math.round(
      Math.max(halfWidth, Math.min(canvasWidth - halfWidth, x)),
    );

    this._context.fillText(text, clampedX, Math.floor(canvasHeight));
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
    dotRadius: number,
  ): void {
    const rgb: string =
      styles.getPropertyValue("--lower-band-1-rgb").trim() || "61, 82, 122";

    this._context.strokeStyle = `rgba(${rgb}, ${Math.min(0.2, opacity)})`;

    this._context.lineWidth = dotRadius * 0.5;
  }

  private _applyHighlightShadow(dotRadius: number): void {
    const styles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );

    const rgb: string =
      styles.getPropertyValue("--highlight-font-1-rgb").trim() ||
      "224, 217, 187";

    this._context.shadowColor = `rgba(${rgb}, 0.8)`;

    this._context.shadowBlur = dotRadius * 2;
  }
}
