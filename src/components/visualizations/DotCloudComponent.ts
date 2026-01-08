import { VisualSettings } from "../../services/VisualSettingsService";
import { ScoreProcessor, ScoreEntry } from "./ScoreProcessor";
import { RankScaleMapper } from "./RankScaleMapper";
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
}

/**
 * Responsibility: Orchestrate the rendering of a "Dot Cloud" (Strip Plot) of recent performance data.
 * Coordinates data processing, coordinate mapping, and canvas rendering.
 */
export class DotCloudComponent {
  private _recentEntries: ScoreEntry[];
  private _rankThresholds: Record<string, number>;
  private _settings: VisualSettings;
  private _mapper: RankScaleMapper;
  private _isLatestInSession: boolean;
  private _canvasWidth: number = 160;
  private _canvasHeight: number = 24;
  private _microDotRadius: number = 1;
  private _totalScale: number = 1;
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
    this._initializeCanvasDimensions();

    if (this._canvas) {
      this._syncCanvasDimensions();
      this._initializeRenderer(this._canvas, this._totalScale);
    }

    this.requestUpdate();
  }

  /**
   * Updates the score data and rank thresholds, recalculating scales if necessary.
   *
   * @param entries - New set of score entries.
   * @param thresholds - Updated rank thresholds.
   * @param isLatestInSession - Whether the most recent run is from the active session.
   * @param rankInterval - Optional rank interval for scaling.
   */
  public updateData(
    entries: ScoreEntry[],
    thresholds: Record<string, number>,
    isLatestInSession: boolean,
    rankInterval?: number,
  ): void {
    this._recentEntries = ScoreProcessor.processTemporalScores(entries);
    this._rankThresholds = thresholds;
    this._isLatestInSession = isLatestInSession;

    const thresholdValues: number[] = Object.values(thresholds).sort(
      (a: number, b: number) => a - b,
    );

    this._mapper = new RankScaleMapper(thresholdValues, rankInterval ?? 100);

    if (this._canvas) {
      this._initializeRenderer(this._canvas, this._totalScale);
    } else if (this._container && this._recentEntries.length > 0) {
      this._canvas = this._createScaledCanvas();
      this._container.appendChild(this._canvas);
    }

    this.requestUpdate();
  }

  /**
   * Renders the component into a container element.
   *
   * @returns The constructed HTMLElement containing the visualization.
   */
  public render(): HTMLElement {
    if (!this._container) {
      this._container = document.createElement("div");
      this._container.className = "dot-cloud-container";
    }

    this._sanitizeContainer();

    if (this._recentEntries.length === 0) {
      return this._container;
    }

    this._canvas = this._createScaledCanvas();
    this._container.appendChild(this._canvas);

    this._performRenderCycle();

    return this._container;
  }

  /**
   * Disposes of animation frames and references to prevent memory leaks or stale renders.
   */
  public destroy(): void {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    this._canvas = null;
    this._renderer = null;

    if (this._container) {
      this._sanitizeContainer();
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

  private _createScaledCanvas(): HTMLCanvasElement {
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    this._canvas = canvas;

    this._initializeCanvasDimensions();

    const dpr: number = window.devicePixelRatio || 1;
    const superSamplingFactor: number = 2;
    this._totalScale = dpr * superSamplingFactor;

    this._syncCanvasDimensions();
    this._initializeRenderer(canvas, this._totalScale);

    return canvas;
  }

  private _initializeCanvasDimensions(): void {
    const rootFontSize: number = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    this._canvasWidth = Math.round(14 * rootFontSize);
    this._canvasHeight = Math.round(2 * rootFontSize);

    const sizeModifiers: Record<string, number> = {
      small: 0.08,
      medium: 0.11,
      large: 0.15,
    };

    const modifier: number =
      sizeModifiers[this._settings.dotSize.toLowerCase()] ?? 0.11;
    this._microDotRadius = rootFontSize * modifier;
  }

  private _initializeRenderer(canvas: HTMLCanvasElement, scale: number): void {
    const context: CanvasRenderingContext2D | null = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);

    this._renderer = new DotCloudCanvasRenderer(context, this._mapper);
  }

  private _syncCanvasDimensions(): void {
    if (!this._canvas) {
      return;
    }

    this._canvas.width = Math.round(this._canvasWidth * this._totalScale);
    this._canvas.height = Math.round(this._canvasHeight * this._totalScale);
    this._canvas.style.width = `${this._canvasWidth}px`;
    this._canvas.style.height = `${this._canvasHeight}px`;
  }

  private _sanitizeContainer(): void {
    if (!this._container) {
      return;
    }

    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  private _performRenderCycle(): void {
    if (!this._renderer) {
      return;
    }

    const context: RenderContext = this._createRenderContext();

    this._renderer.draw(context);
  }

  private _createRenderContext(): RenderContext {
    const sortedThresholds: [string, number][] = Object.entries(
      this._rankThresholds,
    ).sort((a: [string, number], b: [string, number]) => a[1] - b[1]);

    const bounds: { minRU: number; maxRU: number } =
      this._calculateViewBounds();

    const scores: number[] = this._recentEntries.map(
      (entry: ScoreEntry): number => entry.score,
    );

    const rootFontSize: number = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    return {
      scores,
      sortedThresholds,
      bounds,
      isLatestFromSession: this._isLatestInSession,
      settings: this._settings,
      dimensions: {
        width: this._canvasWidth,
        height: this._canvasHeight,
        dotRadius: this._microDotRadius,
        rootFontSize,
      },
    };
  }

  private _calculateViewBounds(): { minRU: number; maxRU: number } {
    const scores: number[] = this._recentEntries.map(
      (entry: ScoreEntry): number => entry.score,
    );

    const minRUScore: number = this._mapper.calculateRankUnit(
      Math.min(...scores),
    );
    const maxRUScore: number = this._mapper.calculateRankUnit(
      Math.max(...scores),
    );

    if (this._settings.scalingMode === "Aligned") {
      return this._mapper.calculateAlignedBounds(minRUScore, maxRUScore);
    }

    const indices: number[] = this._mapper.identifyRelevantThresholds(
      minRUScore,
      maxRUScore,
    );

    return this._mapper.calculateViewBounds(minRUScore, maxRUScore, indices);
  }
}
