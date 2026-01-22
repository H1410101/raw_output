import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";
import { SCALING_FACTORS } from "../../services/ScalingService";

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
    readonly targetRU?: number;
    readonly achievedRU?: number;
    readonly dimensions: {
        readonly width: number;
        readonly height: number;
        readonly dotRadius: number;
        readonly rootFontSize: number;
    };
}

/**
 * Responsibility: Perform high-level DOM manipulation for the Dot Cloud.
 * Handles the creation and positioning of rank notches, labels, and performance dots using HTML elements.
 */
export class DotCloudHtmlRenderer {
    private readonly _container: HTMLElement;
    private readonly _mapper: RankScaleMapper;

    /**
     * Initializes the renderer with a container element and a mapper.
     *
     * @param container - The parent element that will hold the visualization.
     * @param mapper - Mapper for rank and coordinate calculations.
     */
    public constructor(container: HTMLElement, mapper: RankScaleMapper) {
        this._container = container;
        this._mapper = mapper;
    }

    /**
     * Clears the container's content.
     */
    public clear(): void {
        while (this._container.firstChild) {
            this._container.removeChild(this._container.firstChild);
        }
    }

    /**
     * Orchestrates a complete render pass by updating the DOM based on the context.
     *
     * @param context - The render context containing data and dimensions.
     */
    public draw(context: RenderContext): void {
        this.clear();

        this._renderMetadata(context);

        const densities: number[] = this._calculateLocalDensities(
            context.scoresInRankUnits,
        );
        const peakDensity: number =
            densities.length > 0 ? Math.max(...densities) : 1;

        this._renderPerformanceDots(context, densities, peakDensity);
    }

    private _renderMetadata(context: RenderContext): void {
        const notchHeight: number = this._calculateNotchHeight(
            context.dimensions.rootFontSize,
            context.dimensions.height,
            context.settings,
        );

        this._renderThresholds(notchHeight, context);

        if (context.targetRU !== undefined) {
            this._renderMarker(context.targetRU, "target", notchHeight, context);
        }

        if (context.achievedRU !== undefined) {
            this._renderMarker(context.achievedRU, "achieved", notchHeight, context);
        }
    }

    private _renderThresholds(notchHeight: number, context: RenderContext): void {
        const indices: number[] = this._mapper.identifyRelevantThresholds(
            context.bounds.minRU,
            context.bounds.maxRU,
        );

        indices.forEach((thresholdIndex: number): void => {
            this._renderThresholdMetadata(thresholdIndex, notchHeight, context);
        });
    }

    private _renderThresholdMetadata(
        thresholdIndex: number,
        notchHeight: number,
        context: RenderContext,
    ): void {
        const [rankName]: [string, number] =
            context.sortedThresholds[thresholdIndex];

        const xPos: number = this._mapper.getHorizontalPosition(
            thresholdIndex + 1,
            context.bounds.minRU,
            context.bounds.maxRU,
            context.dimensions.width,
        );

        if (context.settings.showRankNotches) {
            this._createNotchElement(xPos, notchHeight);
        }

        this._createLabelElement(
            rankName.toUpperCase(),
            xPos,
            context.dimensions,
            context.settings,
        );
    }

    private _renderMarker(
        rankUnit: number,
        type: "target" | "achieved",
        notchHeight: number,
        context: RenderContext,
    ): void {
        const xPos: number = this._mapper.getHorizontalPosition(
            rankUnit,
            context.bounds.minRU,
            context.bounds.maxRU,
            context.dimensions.width,
        );

        const markerHeight: number = notchHeight * 0.4;
        const isSession: boolean = context.isLatestFromSession;

        const marker: HTMLDivElement = document.createElement("div");
        marker.className = `dot-cloud-marker dot-cloud-marker-${type}`;

        if (type === "achieved" && !isSession) {
            marker.classList.add("latest-run");
        }

        marker.style.left = `${xPos}px`;
        marker.style.height = `${markerHeight}px`;
        marker.style.top = `${(notchHeight - markerHeight) / 2}px`;

        this._container.appendChild(marker);
    }

    private _renderPerformanceDots(
        context: RenderContext,
        densities: number[],
        peakDensity: number,
    ): void {
        const opacity: number = Math.max(0, Math.min(1, context.settings.dotOpacity / 100));
        const notchHeight: number = this._calculateNotchHeight(
            context.dimensions.rootFontSize,
            context.dimensions.height,
            context.settings,
        );

        for (let i = context.scoresInRankUnits.length - 1; i >= 0; i--) {
            const density: number = densities[i] || 1;

            this._renderPerformanceDot({
                index: i,
                density,
                peakDensity,
                baseOpacity: opacity,
                notchHeight,
                context,
            });
        }
    }

    private _renderPerformanceDot(config: {
        index: number;
        density: number;
        peakDensity: number;
        baseOpacity: number;
        notchHeight: number;
        context: RenderContext;
    }): void {
        const scoreRU: number = config.context.scoresInRankUnits[config.index];
        const xPos: number = this._calculateXPosition(scoreRU, config.context);

        const jitter: number = this._calculateVerticalJitter({
            scoreIndex: config.index,
            localDensity: config.density,
            peakDensity: config.peakDensity,
            notchHeight: config.notchHeight,
            context: config.context,
        });

        this._createDotElement({
            xPos,
            yPos: config.notchHeight / 2 + jitter,
            isLatest: config.index === 0 && config.context.settings.highlightLatestRun,
            isSession: config.context.isLatestFromSession,
            scoreRU,
            timestamp: config.context.timestamps[config.index],
            radius: config.context.dimensions.dotRadius,
            baseOpacity: config.baseOpacity,
        });
    }

    private _calculateXPosition(scoreRU: number, context: RenderContext): number {
        return this._mapper.getHorizontalPosition(
            scoreRU,
            context.bounds.minRU,
            context.bounds.maxRU,
            context.dimensions.width,
        );
    }

    private _createDotElement(config: {
        xPos: number;
        yPos: number;
        isLatest: boolean;
        isSession: boolean;
        scoreRU: number;
        timestamp?: number;
        radius: number;
        baseOpacity: number;
    }): void {
        const dot: HTMLDivElement = document.createElement("div");
        dot.className = "dot-cloud-dot";

        if (config.isLatest && config.isSession) {
            dot.classList.add("highlight");
        } else if (config.isLatest) {
            dot.classList.add("latest");
        }

        this._applyDotStyles(dot, config);
        this._applyDotMetadata(dot, config);

        this._container.appendChild(dot);
    }

    private _applyDotStyles(
        dot: HTMLElement,
        config: {
            xPos: number;
            yPos: number;
            radius: number;
            isLatest: boolean;
            isSession: boolean;
            baseOpacity: number;
        },
    ): void {
        dot.style.width = `${config.radius * 2}px`;
        dot.style.height = `${config.radius * 2}px`;
        dot.style.left = `${config.xPos}px`;
        dot.style.top = `${config.yPos}px`;

        const boost: number = config.isLatest && config.isSession ? 0.4 : config.isLatest ? 0.2 : 0;
        const finalOpacity: number = Math.min(1, config.baseOpacity + boost);
        dot.style.setProperty("--dot-opacity", finalOpacity.toString());
    }

    private _applyDotMetadata(
        dot: HTMLElement,
        config: {
            scoreRU: number;
            timestamp?: number;
        },
    ): void {
        dot.setAttribute("data-ru", config.scoreRU.toFixed(3));

        if (config.timestamp) {
            dot.setAttribute("data-time", config.timestamp.toString());
        }
    }

    private _createNotchElement(xPos: number, height: number): void {
        const notch: HTMLDivElement = document.createElement("div");
        notch.className = "dot-cloud-notch";
        notch.style.left = `${xPos}px`;
        notch.style.height = `${height}px`;
        this._container.appendChild(notch);
    }

    private _createLabelElement(
        text: string,
        xPos: number,
        dimensions: { width: number; height: number; rootFontSize: number },
        settings: VisualSettings,
    ): void {
        const anchor: HTMLDivElement = document.createElement("div");
        anchor.className = "dot-cloud-label-anchor";
        anchor.style.left = `${xPos}px`;

        const relPos: number = xPos / dimensions.width;
        if (relPos < 0.2) {
            anchor.classList.add("anchor-left");
        } else if (relPos > 0.8) {
            anchor.classList.add("anchor-right");
        }

        const label: HTMLDivElement = document.createElement("div");
        label.className = "dot-cloud-label";
        label.textContent = text;

        const factor: number = SCALING_FACTORS[settings.visRankFontSize] ?? SCALING_FACTORS.Normal;
        const fontSize: number = dimensions.rootFontSize * 0.5 * factor;
        label.style.fontSize = `${fontSize}px`;

        anchor.appendChild(label);
        this._container.appendChild(anchor);
    }

    private _calculateNotchHeight(
        rootFontSize: number,
        containerHeight: number,
        settings: VisualSettings,
    ): number {
        const factor: number = SCALING_FACTORS[settings.visRankFontSize] ?? SCALING_FACTORS.Normal;
        const rankFontSize: number = rootFontSize * 0.5 * factor;
        const gap: number = rankFontSize * 0.2;
        const labelBuffer: number = rankFontSize + gap;

        return containerHeight - labelBuffer;
    }

    private _calculateLocalDensities(rankUnits: number[]): number[] {
        const windowSizeInRu: number = 0.5;

        return rankUnits.map((target: number): number => {
            const neighbors: number[] = rankUnits.filter(
                (rankUnit: number): boolean => Math.abs(rankUnit - target) <= windowSizeInRu,
            );

            return neighbors
                .map((rankUnit: number): number => Math.pow(Math.abs(rankUnit - target) / windowSizeInRu, 1))
                .reduce((a: number, b: number): number => a + b, 0);
        });
    }

    private _calculateVerticalJitter(config: {
        scoreIndex: number;
        localDensity: number;
        peakDensity: number;
        notchHeight: number;
        context: RenderContext;
    }): number {
        const intensity: string = config.context.settings.dotJitterIntensity.toLowerCase();
        const multiplier: number = this._getJitterMultiplier(intensity);

        if (multiplier === 0 || config.localDensity <= 1) {
            return 0;
        }

        const jitterRange: number = config.notchHeight / 2 - config.context.dimensions.dotRadius;
        const densityRatio: number = Math.pow(config.localDensity / config.peakDensity, 3);
        const populationRatio: number = 0.25 + (0.75 * config.context.scoresInRankUnits.length) / 100;

        const localMax: number = jitterRange * multiplier * densityRatio * populationRatio;
        const seed: number = config.context.timestamps[config.scoreIndex] ?? config.scoreIndex;

        return this._seededRandom(seed) * localMax;
    }

    private _getJitterMultiplier(intensity: string): number {
        const JITTER_MAP: Record<string, number> = {
            min: 0,
            small: 0.25,
            normal: 0.5,
            large: 0.75,
            max: 1,
        };

        return JITTER_MAP[intensity] ?? 0;
    }

    private _seededRandom(seed: number): number {
        let hash: number = (seed += 0x9e3779b9);

        hash ^= hash >>> 16;
        hash = Math.imul(hash, 0x21f0aaad);

        hash ^= hash >>> 15;
        hash = Math.imul(hash, 0x735a2d97);

        hash ^= hash >>> 15;

        return ((hash >>> 0) / 0xffffffff) * 2 - 1;
    }
}
