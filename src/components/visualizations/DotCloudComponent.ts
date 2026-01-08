import { VisualSettings } from "../../services/VisualSettingsService";
import { ScoreProcessor, ScoreEntry } from "./ScoreProcessor";
import { RankScaleMapper } from "./RankScaleMapper";
import { DotCloudCanvasRenderer } from "./DotCloudCanvasRenderer";

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
  private readonly _recentEntries: ScoreEntry[];
  private readonly _rankThresholds: Record<string, number>;
  private readonly _settings: VisualSettings;
  private readonly _mapper: RankScaleMapper;
  private readonly _isLatestInSession: boolean;
  private _canvasWidth: number = 160;
  private _canvasHeight: number = 24;
  private _microDotRadius: number = 1;

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
   * Renders the component into a container element.
   *
   * @returns The constructed HTMLElement containing the visualization.
   */
  public render(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "dot-cloud-container";

    if (this._recentEntries.length === 0) {
      return container;
    }

    container.appendChild(this._createScaledCanvas());

    return container;
  }

  private _createScaledCanvas(): HTMLCanvasElement {
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    this._initializeCanvasDimensions();

    const dpr: number = window.devicePixelRatio || 1;
    const superSamplingFactor: number = 2;
    const totalScale: number = dpr * superSamplingFactor;

    canvas.width = Math.round(this._canvasWidth * totalScale);
    canvas.height = Math.round(this._canvasHeight * totalScale);
    canvas.style.width = `${this._canvasWidth}px`;
    canvas.style.height = `${this._canvasHeight}px`;

    this._renderToCanvasContext(canvas, totalScale);

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

  private _renderToCanvasContext(
    canvas: HTMLCanvasElement,
    scale: number,
  ): void {
    const context: CanvasRenderingContext2D | null = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.scale(scale, scale);

    const renderer: DotCloudCanvasRenderer = new DotCloudCanvasRenderer(
      context,
      this._settings,
      this._mapper,
      {
        width: this._canvasWidth,
        height: this._canvasHeight,
        dotRadius: this._microDotRadius,
      },
    );

    this._performRenderCycle(renderer);
  }

  private _performRenderCycle(renderer: DotCloudCanvasRenderer): void {
    const sortedPairs: [string, number][] = Object.entries(
      this._rankThresholds,
    ).sort((a: [string, number], b: [string, number]) => a[1] - b[1]);

    const { minRU, maxRU } = this._calculateViewBounds();

    renderer.drawMetadata(sortedPairs, minRU, maxRU);

    const scores: number[] = this._recentEntries.map(
      (entry: ScoreEntry): number => entry.score,
    );

    renderer.drawPerformanceDots(scores, minRU, maxRU, this._isLatestInSession);
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
