import { VisualSettings } from "../../services/VisualSettingsService";
import { ScoreProcessor, ScoreEntry } from "./ScoreProcessor";
import { RankScaleMapper } from "./RankScaleMapper";
import { ScalingService } from "../../services/ScalingService";
import {
  DotCloudCanvasRenderer,
  RenderContext,
} from "./DotCloudCanvasRenderer";

/**
 * Configuration for initializing a DotCloudComponent.
 */
export interface DotCloudConfiguration {
  readonly entries: ScoreEntry[];
  readonly thresholds: Record<string, number>;
  readonly settings: VisualSettings;
  readonly isLatestInSession: boolean;
  readonly rankInterval?: number;
  readonly targetRU?: number;
  readonly achievedRU?: number;
}

/**
 * Payload for updating the component's data model.
 */
export interface UpdateDataOptions {
  readonly entries: ScoreEntry[];
  readonly thresholds: Record<string, number>;
  readonly isLatestInSession: boolean;
  readonly rankInterval?: number;
  readonly targetRU?: number;
  readonly achievedRU?: number;
}

/**
 * Responsibility: Orchestrate the rendering of a "Dot Cloud" (Strip Plot) of recent performance data.
 * Coordinates data processing, coordinate mapping, and canvas rendering.
 */
export class DotCloudComponent {
  public static readonly baseWidthRem: number = 14;
  public static readonly baseHeightRem: number = 2.2;
  private static readonly _baseDotRadiusRatio: number = 0.11;

  private _recentEntries: ScoreEntry[];
  private _rankThresholds: Record<string, number>;
  private _settings: VisualSettings;
  private _mapper: RankScaleMapper;
  private _isLatestInSession: boolean;
  private _targetRU?: number;
  private _achievedRU?: number;

  private _canvasWidth: number = 0;
  private _canvasHeight: number = 0;
  private _dotRadius: number = 0;
  private _uiScaling: number = 1;

  private _canvas: HTMLCanvasElement | null = null;
  private _renderer: DotCloudCanvasRenderer | null = null;
  private _animationFrameId: number | null = null;
  private _isDirty: boolean = false;
  private _container: HTMLElement | null = null;

  /**
   * Initializes the component with score data and visualization settings.
   *
   * @param configuration - The setup parameters for the visualization.
   */
  public constructor(configuration: DotCloudConfiguration) {
    this._rankThresholds = configuration.thresholds;
    this._settings = configuration.settings;
    this._isLatestInSession = configuration.isLatestInSession;
    this._targetRU = configuration.targetRU;
    this._achievedRU = configuration.achievedRU;

    this._recentEntries = ScoreProcessor.processTemporalScores(
      configuration.entries,
    );

    const thresholdValues: number[] = Object.values(
      configuration.thresholds,
    ).sort((a: number, b: number) => a - b);

    this._mapper = new RankScaleMapper(
      thresholdValues,
      configuration.rankInterval ?? 100,
    );
  }

  /**
   * Updates the visual configuration and schedules a redraw.
   *
   * @param settings - The new visual settings.
   */
  public updateConfiguration(settings: VisualSettings): void {
    this._settings = settings;

    this._initializeDimensions();

    if (this._canvas) {
      this._syncCanvasSize();
      this._rebuildRenderer();
    }

    this._syncContainerDimensions();

    this.requestUpdate();
  }

  /**
   * Updates the score data and rank thresholds, recalculating scales if necessary.
   *
   * @param options - The updated data and configuration options.
   */
  public updateData(options: UpdateDataOptions): void {
    this._recentEntries = ScoreProcessor.processTemporalScores(options.entries);
    this._rankThresholds = options.thresholds;
    this._isLatestInSession = options.isLatestInSession;
    this._targetRU = options.targetRU;
    this._achievedRU = options.achievedRU;

    const thresholdValues: number[] = Object.values(options.thresholds).sort(
      (a: number, b: number) => a - b,
    );

    this._mapper = new RankScaleMapper(thresholdValues, options.rankInterval ?? 100);

    this._handleDataUpdateSideEffects();
  }

  /**
   * Renders the component into a container element.
   *
   * @returns The constructed HTMLElement containing the visualization.
   */
  public render(): HTMLElement {
    this._ensureContainerExists();

    this._clearContainerContent();

    this._initializeDimensions();

    this._syncContainerDimensions();

    this._setupVisualLayers();
    this._performRenderCycle();

    return this._container!;
  }

  /**
   * Disposes of animation frames and references to prevent memory leaks or stale renders.
   */
  public destroy(): void {
    this._cancelPendingFrames();

    this._canvas = null;
    this._renderer = null;

    if (this._container) {
      this._clearContainerContent();
      this._container = null;
    }
  }

  /**
   * Schedules a redraw on the next animation frame.
   */
  public requestUpdate(): void {
    if (this._isDirty) {
      return;
    }

    this._isDirty = true;

    this._animationFrameId = requestAnimationFrame((): void => {
      this._isDirty = false;
      this._animationFrameId = null;
      this._performRenderCycle();
    });
  }

  private _handleDataUpdateSideEffects(): void {
    if (this._canvas) {
      this._rebuildRenderer();
    } else if (this._container) {
      this._setupVisualLayers();
    }

    this.requestUpdate();
  }

  private _setupVisualLayers(): void {
    this._canvas = this._createScaledCanvas();

    if (this._container) {
      this._container.appendChild(this._canvas);
    }
  }

  private _createScaledCanvas(): HTMLCanvasElement {
    const canvas: HTMLCanvasElement = document.createElement("canvas");

    this._initializeDimensions();

    const dpr: number = window.devicePixelRatio || 1;
    this._uiScaling = dpr * 2;

    this._canvas = canvas;

    this._syncCanvasSize();

    this._rebuildRenderer();

    return canvas;
  }

  private _initializeDimensions(): void {
    const rootFontSize: number = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    const baseWidth: number = DotCloudComponent.baseWidthRem * rootFontSize;
    const baseHeight: number = DotCloudComponent.baseHeightRem * rootFontSize;
    const baseDotRadius: number =
      DotCloudComponent._baseDotRadiusRatio * rootFontSize;

    this._canvasWidth = Math.round(
      ScalingService.getScaledValue(baseWidth, this._settings, "dotCloudWidth"),
    );

    this._canvasHeight = Math.round(
      ScalingService.getScaledValue(baseHeight, this._settings, "dotCloudSize"),
    );

    this._dotRadius = ScalingService.getScaledValue(
      baseDotRadius,
      this._settings,
      "visDotSize",
    );
  }

  private _rebuildRenderer(): void {
    if (!this._canvas) {
      return;
    }

    const context: CanvasRenderingContext2D | null =
      this._canvas.getContext("2d");

    if (context) {
      this._renderer = new DotCloudCanvasRenderer(context, this._mapper);
    }
  }

  private _syncCanvasSize(): void {
    if (!this._canvas) {
      return;
    }

    this._canvas.width = Math.round(this._canvasWidth * this._uiScaling);
    this._canvas.height = Math.round(this._canvasHeight * this._uiScaling);

    this._canvas.style.width = `${this._canvasWidth}px`;
    this._canvas.style.height = `${this._canvasHeight}px`;

    this._syncContainerDimensions();
  }

  private _syncContainerDimensions(): void {
    if (!this._container) {
      return;
    }

    this._container.style.width = `${this._canvasWidth}px`;
    this._container.style.height = `${this._canvasHeight}px`;
  }

  private _ensureContainerExists(): void {
    if (!this._container) {
      this._container = document.createElement("div");
      this._container.className = "dot-cloud-container";
    }
  }

  private _clearContainerContent(): void {
    if (!this._container) {
      return;
    }

    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  private _cancelPendingFrames(): void {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  private _performRenderCycle(): void {
    if (!this._renderer || !this._canvas) {
      return;
    }

    if (!this._renderer.areStylesReady()) {
      this._handleStylesNotReady();

      return;
    }

    const context: CanvasRenderingContext2D = this._canvas.getContext("2d")!;
    const padding: number = this._dotRadius * 3;
    const drawableWidth: number = Math.max(0, this._canvasWidth - padding * 2);

    this._prepareContextForDraw(context, padding);

    const renderContext: RenderContext =
      this._assembleRenderContext(drawableWidth);

    this._renderer.draw(renderContext);
  }

  private _handleStylesNotReady(): void {
    if (document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => this.requestUpdate());
    } else {
      requestAnimationFrame(() => this.requestUpdate());
    }
  }

  private _prepareContextForDraw(
    context: CanvasRenderingContext2D,
    padding: number,
  ): void {
    context.setTransform(this._uiScaling, 0, 0, this._uiScaling, 0, 0);

    context.clearRect(0, 0, this._canvasWidth, this._canvasHeight);

    context.translate(padding, 0);
  }

  private _assembleRenderContext(width: number): RenderContext {
    const rootFontSize: number = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    return {
      scoresInRankUnits: this._recentEntries.map((entry: ScoreEntry): number =>
        this._mapper.calculateRankUnit(entry.score),
      ),
      timestamps: this._recentEntries.map(
        (entry: ScoreEntry): number => entry.timestamp,
      ),
      sortedThresholds: Object.entries(this._rankThresholds).sort(
        (firstEntry: [string, number], secondEntry: [string, number]): number =>
          firstEntry[1] - secondEntry[1],
      ),
      bounds: this._calculateDynamicBounds(width),
      isLatestFromSession: this._isLatestInSession,
      settings: this._settings,
      targetRU: this._targetRU,
      achievedRU: this._achievedRU,
      dimensions: {
        width,
        height: this._canvasHeight,
        dotRadius: this._dotRadius,
        rootFontSize,
      },
    };
  }

  private _calculateDynamicBounds(width: number): {
    minRU: number;
    maxRU: number;
  } {
    const scores: number[] = this._recentEntries.map(
      (entry: ScoreEntry): number => entry.score,
    );

    if (scores.length === 0) {
      return this._calculateEmptyScoresBounds();
    }

    const minRU: number = this._mapper.calculateRankUnit(Math.min(...scores));
    const maxRU: number = this._mapper.calculateRankUnit(Math.max(...scores));

    if (this._settings.scalingMode === "Aligned") {
      return this._calculateExceededAlignedBounds(minRU, maxRU, width);
    }

    const indices: number[] = this._mapper.identifyRelevantThresholds(minRU, maxRU);

    return this._mapper.calculateViewBounds(minRU, maxRU, indices);
  }

  private _calculateEmptyScoresBounds(): { minRU: number; maxRU: number } {
    const target: number = this._targetRU ?? this._achievedRU ?? 0;

    return {
      minRU: Math.floor(Math.max(0, target - 0.5)),
      maxRU: Math.ceil(target + 0.5),
    };
  }

  private _calculateExceededAlignedBounds(
    minRUScore: number,
    maxRUScore: number,
    width: number,
  ): { minRU: number; maxRU: number } {
    const highestRankIndex: number = this._mapper.getHighestRankIndex();

    if (maxRUScore <= highestRankIndex || width <= this._dotRadius * 2) {
      return this._mapper.calculateAlignedBounds(minRUScore, maxRUScore);
    }

    const minRU: number = Math.floor(minRUScore);
    const edgeRatio: number = 1 - this._dotRadius / width;
    const maxRU: number = minRU + (maxRUScore - minRU) / edgeRatio;

    return {
      minRU,
      maxRU: maxRU <= minRU ? minRU + 1 : maxRU,
    };
  }
}
