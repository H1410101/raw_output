import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";
import { ScalingLevel, SCALING_FACTORS } from "../../services/ScalingService";

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
    if (!this.areStylesReady()) {
      return;
    }

    this.clear(context.dimensions.width, context.dimensions.height);

    this.drawMetadata(context);

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
    const labelColor: string = this._getLabelColor(styles);

    this._renderThresholds(notchHeight, labelColor, context);
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
    const styles: CSSStyleDeclaration = getComputedStyle(this._context.canvas);
    const visuals: Omit<ScoreVisualContext, "localDensity" | "peakDensity"> =
      this._preparePerformanceVisuals(styles, context);

    this._renderAllScores(context, visuals, densities, peakDensity);
  }

  /**
   * Checks if all required CSS variables and fonts are loaded and resolved.
   *
   * @returns True if styles are ready for rendering.
   */
  public areStylesReady(): boolean {
    const rootStyles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );
    const canvasStyles: CSSStyleDeclaration = getComputedStyle(
      this._context.canvas,
    );

    return (
      !!rootStyles.getPropertyValue("--vis-label-color").trim() &&
      !!rootStyles.getPropertyValue("--vis-dot-rgb").trim() &&
      !!rootStyles.getPropertyValue("--vis-highlight-rgb").trim() &&
      !!rootStyles.getPropertyValue("--vis-latest-rgb").trim() &&
      !!canvasStyles.getPropertyValue("--vis-label-family").trim() &&
      !!canvasStyles.getPropertyValue("--vis-label-weight").trim() &&
      document.fonts.status === "loaded"
    );
  }

  private _getStyleValue(
    elementStyles: CSSStyleDeclaration,
    property: string,
  ): string {
    const value: string = elementStyles.getPropertyValue(property).trim();
    if (value) {
      return value;
    }

    const rootStyles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );

    return rootStyles.getPropertyValue(property).trim();
  }

  private _getLabelColor(styles: CSSStyleDeclaration): string {
    return this._getStyleValue(styles, "--vis-label-color");
  }

  private _renderThresholds(
    notchHeight: number,
    labelColor: string,
    context: RenderContext,
  ): void {
    const indices: number[] = this._mapper.identifyRelevantThresholds(
      context.bounds.minRU,
      context.bounds.maxRU,
    );

    indices.forEach((thresholdIndex: number): void => {
      this._renderThresholdMetadata(
        thresholdIndex,
        notchHeight,
        labelColor,
        context,
      );
    });
  }

  private _renderAllScores(
    context: RenderContext,
    visuals: Omit<ScoreVisualContext, "localDensity" | "peakDensity">,
    densities: number[],
    peakDensity: number,
  ): void {
    for (let i = context.scoresInRankUnits.length - 1; i >= 0; i--) {
      this._renderIndividualScore(context.scoresInRankUnits[i], i, context, {
        ...visuals,
        localDensity: densities[i] || 1,
        peakDensity,
      });
    }
  }

  private _preparePerformanceVisuals(
    styles: CSSStyleDeclaration,
    context: RenderContext,
  ): Omit<ScoreVisualContext, "localDensity" | "peakDensity"> {
    const opacity: number = this._getNormalizedOpacity(context.settings);
    const notchHeight: number = this._calculateNotchHeight(
      context.dimensions.rootFontSize,
      context.dimensions.height,
      context.settings,
    );
    const highlightRgb: string = this._getStyleValue(
      styles,
      "--vis-highlight-rgb",
    );

    this._setupStrokeStyles(styles, opacity, context.dimensions.dotRadius);

    return {
      notchHeight,
      baseStyle: this._getBaseFillStyle(styles, opacity),
      highlightStyle: this._getHighlightFillStyle(styles, opacity),
      latestStyle: this._getLatestFillStyle(styles, opacity),
      highlightRgb,
    };
  }

  private _renderThresholdMetadata(
    thresholdIndex: number,
    notchHeight: number,
    labelColor: string,
    context: RenderContext,
  ): void {
    const [rankName]: [string, number] =
      context.sortedThresholds[thresholdIndex];

    const x: number = this._mapper.getHorizontalPosition(
      thresholdIndex,
      context.bounds.minRU,
      context.bounds.maxRU,
      context.dimensions.width,
    );

    this._drawVerticalNotch(x, notchHeight, labelColor, context.settings);

    this._drawClampedRankLabel(
      rankName.toUpperCase(),
      x,
      labelColor,
      context.dimensions,
    );
  }

  private _renderIndividualScore(
    score: number,
    scoreIndex: number,
    context: RenderContext,
    visuals: ScoreVisualContext,
  ): void {
    const position = this._getScorePosition(
      score,
      scoreIndex,
      context,
      visuals,
    );
    const { style, isSessionHighlight } = this._determineDotStyle(
      scoreIndex,
      context,
      visuals,
    );

    this._drawDot(position, isSessionHighlight, {
      style,
      dotRadius: context.dimensions.dotRadius,
      highlightRgb: visuals.highlightRgb,
    });
  }

  private _getScorePosition(
    score: number,
    scoreIndex: number,
    context: RenderContext,
    visuals: ScoreVisualContext,
  ): { x: number; y: number } {
    return {
      x: this._calculateHorizontalPosition(
        score,
        context.bounds,
        context.dimensions.width,
      ),
      y: this._calculateFinalY(context, scoreIndex, visuals),
    };
  }

  private _determineDotStyle(
    scoreIndex: number,
    context: RenderContext,
    visuals: ScoreVisualContext,
  ): { style: string; isSessionHighlight: boolean } {
    const isLatest: boolean =
      scoreIndex === 0 && context.settings.highlightLatestRun;
    const isSessionHighlight: boolean = isLatest && context.isLatestFromSession;

    let style: string = visuals.baseStyle;
    if (isSessionHighlight) {
      style = visuals.highlightStyle;
    } else if (isLatest) {
      style = visuals.latestStyle;
    }

    return { style, isSessionHighlight };
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
    scoreIndex: number,
    visuals: ScoreVisualContext,
  ): number {
    const jitterOffset: number = this._calculateVerticalJitter(
      context,
      scoreIndex,
      visuals,
    );

    return visuals.notchHeight / 2 + jitterOffset;
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
    horizontalPosition: number,
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
    this._context.moveTo(horizontalPosition, 0);
    this._context.lineTo(horizontalPosition, height);
    this._context.stroke();

    this._context.globalAlpha = 1.0;
  }

  private _drawClampedRankLabel(
    text: string,
    horizontalPosition: number,
    labelColor: string,
    dimensions: { width: number; height: number },
  ): void {
    this._context.fillStyle = labelColor;
    const metrics: TextMetrics = this._context.measureText(text);
    const halfWidth: number = metrics.width / 2;

    const clampedX: number = Math.round(
      Math.max(
        halfWidth,
        Math.min(dimensions.width - halfWidth, horizontalPosition),
      ),
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

  private _seededRandom(seed: number): number {
    let hashValue: number = (seed += 0x9e3779b9);
    hashValue ^= hashValue >>> 16;
    hashValue = Math.imul(hashValue, 0x21f0aaad);
    hashValue ^= hashValue >>> 15;
    hashValue = Math.imul(hashValue, 0x735a2d97);
    hashValue ^= hashValue >>> 15;

    return ((hashValue >>> 0) / 0xffffffff) * 2 - 1;
  }

  private _calculateVerticalJitter(
    context: RenderContext,
    scoreIndex: number,
    visuals: ScoreVisualContext,
  ): number {
    const jitterMultiplier: number = this._getJitterMultiplier(
      context.settings.dotJitterIntensity,
    );
    if (jitterMultiplier === 0 || visuals.localDensity <= 1) {
      return 0;
    }

    const localMax: number = this._calculateMaxJitterAmount(
      visuals,
      context,
      jitterMultiplier,
    );

    const seed: number = context.timestamps[scoreIndex] ?? scoreIndex;

    return this._seededRandom(seed) * localMax;
  }

  private _calculateMaxJitterAmount(
    visuals: ScoreVisualContext,
    context: RenderContext,
    jitterMultiplier: number,
  ): number {
    const totalCount: number = context.scoresInRankUnits.length;
    const maxJitterRange: number =
      visuals.notchHeight / 2 - context.dimensions.dotRadius;

    const densityRatio: number = Math.pow(
      visuals.localDensity / visuals.peakDensity,
      3,
    );
    const populationRatio: number = 0.25 + (0.75 * totalCount) / 100;

    return maxJitterRange * jitterMultiplier * densityRatio * populationRatio;
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
    const factor: number =
      SCALING_FACTORS[settings.visRankFontSize] ?? SCALING_FACTORS.Normal;
    const rankFontSize: number = rootFontSize * 0.5 * factor;
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
    const factor: number =
      SCALING_FACTORS[settings.visRankFontSize] ?? SCALING_FACTORS.Normal;
    const fontSize: number = rootFontSize * 0.5 * factor;

    const styles: CSSStyleDeclaration = getComputedStyle(this._context.canvas);
    const weight: string = this._getStyleValue(styles, "--vis-label-weight");
    const family: string = this._getStyleValue(styles, "--vis-label-family");

    this._context.font = `${weight} ${fontSize}px ${family}`;

    this._context.textAlign = "center";

    this._context.textBaseline = "bottom";
  }

  private _getBaseFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string = this._getStyleValue(styles, "--vis-dot-rgb");

    return `rgba(${rgb}, ${opacity})`;
  }

  private _getHighlightFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string = this._getStyleValue(styles, "--vis-highlight-rgb");

    return `rgba(${rgb}, ${Math.min(1, opacity + 0.4)})`;
  }

  private _getLatestFillStyle(
    styles: CSSStyleDeclaration,
    opacity: number,
  ): string {
    const rgb: string = this._getStyleValue(styles, "--vis-latest-rgb");

    return `rgba(${rgb}, ${Math.min(1, opacity + 0.2)})`;
  }

  private _setupStrokeStyles(
    styles: CSSStyleDeclaration,
    opacity: number,
    dotRadius: number,
  ): void {
    const rgb: string = this._getStyleValue(styles, "--vis-dot-rgb");

    this._context.strokeStyle = `rgba(${rgb}, ${Math.min(0.2, opacity)})`;

    this._context.lineWidth = dotRadius * 0.5;
  }

  private _applyHighlightShadow(dotRadius: number, highlightRgb: string): void {
    this._context.shadowColor = `rgba(${highlightRgb}, 0.8)`;

    this._context.shadowBlur = dotRadius * 2;
  }
}
