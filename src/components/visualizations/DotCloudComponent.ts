import { VisualSettings } from "../../services/VisualSettingsService";
import { ScoreProcessor, ScoreEntry } from "./ScoreProcessor";
import { RankScaleMapper } from "./RankScaleMapper";
import { ScalingService } from "../../services/ScalingService";
import { DotCloudHtmlRenderer, RenderContext } from "./DotCloudHtmlRenderer";

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

interface CollectedScoreData {
  readonly scores: number[];
  readonly timestamps: number[];
  readonly minScore: number;
  readonly maxScore: number;
}

/**
 * Responsibility: Orchestrate the rendering of a "Dot Cloud" (Strip Plot) of recent performance data.
 * Coordinates data processing, coordinate mapping, and HTML rendering.
 */
export class DotCloudComponent {
  public static readonly baseWidthRem: number = 14;
  public static readonly baseHeightRem: number = 2.2;
  private static readonly _baseDotRadiusRatio: number = 0.1;

  private _recentEntries: ScoreEntry[];
  private _sortedThresholds: [string, number][];
  private _settings: VisualSettings;
  private _mapper: RankScaleMapper;
  private _isLatestInSession: boolean;
  private _targetRU?: number;
  private _achievedRU?: number;

  private _containerWidth: number = 0;
  private _containerHeight: number = 0;
  private _dotRadius: number = 0;

  private _renderer: DotCloudHtmlRenderer | null = null;
  private _animationFrameId: number | null = null;
  private _isDirty: boolean = false;
  private _container: HTMLElement | null = null;

  /**
   * Initializes the component with score data and visualization settings.
   *
   * @param configuration - The setup parameters for the visualization.
   */
  public constructor(configuration: DotCloudConfiguration) {
    this._sortedThresholds = this._getSortedFiniteThresholds(
      configuration.thresholds,
    );
    this._settings = configuration.settings;
    this._isLatestInSession = configuration.isLatestInSession;
    this._targetRU = this._getFiniteOptional(configuration.targetRU);
    this._achievedRU = this._getFiniteOptional(configuration.achievedRU);

    this._recentEntries = ScoreProcessor.processTemporalScores(
      configuration.entries,
    );

    const thresholdValues: number[] = this._sortedThresholds.map(
      (entry: [string, number]): number => entry[1],
    );

    this._mapper = new RankScaleMapper(
      thresholdValues,
      this._getRankInterval(configuration.rankInterval),
    );
  }

  /**
   * Updates the visual configuration and schedules a redraw.
   *
   * @param settings - The new visual settings.
   */
  public updateConfiguration(settings: VisualSettings): void {
    this._settings = settings;
    this._handleVisualUpdate();
  }

  /**
   * Updates the score data and rank thresholds, recalculating scales if necessary.
   *
   * @param options - The updated data and configuration options.
   */
  public updateData(options: UpdateDataOptions): void {
    this._recentEntries = ScoreProcessor.processTemporalScores(options.entries);
    this._sortedThresholds = this._getSortedFiniteThresholds(options.thresholds);
    this._isLatestInSession = options.isLatestInSession;
    this._targetRU = this._getFiniteOptional(options.targetRU);
    this._achievedRU = this._getFiniteOptional(options.achievedRU);

    const thresholdValues: number[] = this._sortedThresholds.map(
      (entry: [string, number]): number => entry[1],
    );

    this._mapper = new RankScaleMapper(
      thresholdValues,
      this._getRankInterval(options.rankInterval),
    );
    this._handleVisualUpdate(true);
  }

  /**
   * Renders the component into a container element.
   *
   * @returns The constructed HTMLElement containing the visualization.
   */
  public render(): HTMLElement {
    this._cancelPendingFrames();
    this._isDirty = false;

    this._ensureContainerExists();
    this._initializeDimensions();
    this._syncContainerDimensions();
    this._rebuildRenderer();
    this._performRenderCycle();

    return this._container!;
  }

  /**
   * Disposes of animation frames and references to prevent memory leaks or stale renders.
   */
  public destroy(): void {
    this._cancelPendingFrames();
    this._renderer?.destroy();
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
    if (this._isDirty || !this._container) {
      return;
    }

    this._isDirty = true;
    this._animationFrameId = requestAnimationFrame((): void => {
      this._isDirty = false;
      this._animationFrameId = null;
      this._performRenderCycle();
    });
  }

  private _handleVisualUpdate(forceRebuildRenderer: boolean = false): void {
    this._renderer?.hideInspection();
    this._initializeDimensions();
    this._syncContainerDimensions();

    if (this._container) {
      if (forceRebuildRenderer || !this._renderer) {
        this._rebuildRenderer();
      }
      this.requestUpdate();
    }
  }

  private _initializeDimensions(): void {
    this._containerWidth = ScalingService.getScaledValue(
      DotCloudComponent.baseWidthRem,
      this._settings,
      "dotCloudWidth",
    );

    this._containerHeight = ScalingService.getScaledValue(
      DotCloudComponent.baseHeightRem,
      this._settings,
      "dotCloudSize",
    );

    this._dotRadius = ScalingService.getScaledValue(
      DotCloudComponent._baseDotRadiusRatio,
      this._settings,
      "visDotSize",
    );
  }

  private _rebuildRenderer(): void {
    if (!this._container) {
      return;
    }

    this._renderer?.destroy();
    this._renderer = new DotCloudHtmlRenderer(this._container, this._mapper);
  }

  private _syncContainerDimensions(): void {
    if (!this._container) {
      return;
    }

    this._container.style.width = `${this._containerWidth}rem`;
    this._container.style.height = `${this._containerHeight}rem`;
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

    this._container.replaceChildren();
  }

  private _cancelPendingFrames(): void {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  private _performRenderCycle(): void {
    if (!this._renderer || !this._container) {
      return;
    }

    const padding: number = this._dotRadius * 3;
    const drawableWidth: number = Math.max(0, this._containerWidth - padding * 2);

    const renderContext: RenderContext =
      this._assembleRenderContext(drawableWidth, padding);

    this._renderer.draw(renderContext);
    this._container.style.padding = `0 ${padding}rem`;
  }

  private _assembleRenderContext(width: number, padding: number): RenderContext {
    const rootFontSize: number = this._getRootFontSize();
    const scoreData: CollectedScoreData = this._collectScoreData();

    const context: RenderContext = {
      scores: scoreData.scores,
      timestamps: scoreData.timestamps,
      sortedThresholds: this._sortedThresholds,
      bounds: this._calculateDynamicBounds(
        width,
        scoreData.minScore,
        scoreData.maxScore,
      ),
      isLatestFromSession: this._isLatestInSession,
      settings: this._settings,
      targetRU: this._targetRU,
      achievedRU: this._achievedRU,
      dimensions: {
        width,
        height: this._containerHeight,
        dotRadius: this._dotRadius,
        rootFontSize,
      },
      paddingLeft: padding,
    };

    return context;
  }

  private _getRootFontSize(): number {
    const rootFontSize: number = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  }

  private _collectScoreData(): CollectedScoreData {
    const scores: number[] = [];
    const timestamps: number[] = [];
    let minScore: number = Infinity;
    let maxScore: number = -Infinity;

    this._recentEntries.forEach((entry: ScoreEntry): void => {
      scores.push(entry.score);
      timestamps.push(entry.timestamp);
      minScore = Math.min(minScore, entry.score);
      maxScore = Math.max(maxScore, entry.score);
    });

    return { scores, timestamps, minScore, maxScore };
  }

  private _calculateDynamicBounds(
    width: number,
    minScore: number,
    maxScore: number,
  ): {
    minRU: number;
    maxRU: number;
  } {
    if (this._recentEntries.length === 0) {
      return this._calculateEmptyScoresBounds();
    }

    const minRU: number = this._mapper.calculateRankUnit(minScore);
    const maxRU: number = this._mapper.calculateRankUnit(maxScore);

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
    const highestRU: number = highestRankIndex + 1;

    if (maxRUScore <= highestRU || width <= this._dotRadius * 2) {
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

  private _getSortedFiniteThresholds(
    thresholds: Record<string, number>,
  ): [string, number][] {
    return Object.entries(thresholds)
      .filter((entry: [string, number]): boolean => Number.isFinite(entry[1]))
      .sort(
        (firstEntry: [string, number], secondEntry: [string, number]): number =>
          firstEntry[1] - secondEntry[1],
      );
  }

  private _getFiniteOptional(value: number | undefined): number | undefined {
    return value !== undefined && Number.isFinite(value) ? value : undefined;
  }

  private _getRankInterval(value: number | undefined): number {
    return value !== undefined && Number.isFinite(value) && value !== 0
      ? value
      : 100;
  }
}
