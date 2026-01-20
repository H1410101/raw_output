import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";

export interface SummaryTimelineConfiguration {
    readonly scenarioName: string;
    readonly thresholds: Record<string, number>;
    readonly settings: VisualSettings;
    readonly oldRU: number;
    readonly newRU: number;
    readonly gain: number;
    readonly oldRankName: string;
    readonly newRankName: string;
    readonly oldProgress: number;
    readonly newProgress: number;
}

interface TickRenderOptions {
    readonly parent: HTMLElement;
    readonly minRU: number;
    readonly maxRU: number;
    readonly rankUnitsRange: number;
}

interface ProgressRenderOptions {
    readonly parent: HTMLElement;
    readonly minRU: number;
    readonly rankUnitsRange: number;
}

interface NotchRenderOptions {
    readonly parent: HTMLElement;
    readonly rankUnits: number;
    readonly minRU: number;
    readonly rankUnitsRange: number;
    readonly type: "old" | "new";
}

interface LabelRenderOptions {
    readonly parent: HTMLElement;
    readonly rankUnits: number;
    readonly rankName: string;
    readonly progress: number;
    readonly minRU: number;
    readonly rankUnitsRange: number;
    readonly type: "old" | "new";
}

interface CollisionOptions {
    readonly leftHitbox: HTMLElement | null;
    readonly rightHitbox: HTMLElement | null;
    readonly leftLabel: HTMLElement | null;
    readonly rightLabel: HTMLElement | null;
}

/**
 * Specialized timeline visualization for the end-run summary.
 * Displays rank progression with scenario name and gain delta.
 */
export class SummaryTimelineComponent {
    private readonly _container: HTMLElement;
    private readonly _config: SummaryTimelineConfiguration;
    private readonly _mapper: RankScaleMapper;
    private _resizeObserver: ResizeObserver | null = null;

    private _titleAnchor: HTMLElement | null = null;
    private _deltaAnchor: HTMLElement | null = null;
    private _oldAnchor: HTMLElement | null = null;
    private _newAnchor: HTMLElement | null = null;

    private _titleLabel: HTMLElement | null = null;
    private _deltaLabel: HTMLElement | null = null;
    private _oldLabel: HTMLElement | null = null;
    private _newLabel: HTMLElement | null = null;

    private _titleHitbox: HTMLElement | null = null;
    private _deltaHitbox: HTMLElement | null = null;
    private _oldHitbox: HTMLElement | null = null;
    private _newHitbox: HTMLElement | null = null;

    /**
     * Initializes the summary timeline component.
     * @param config - The timeline configuration.
     */
    public constructor(config: SummaryTimelineConfiguration) {
        this._config = config;
        this._container = document.createElement("div");
        this._container.className = "summary-timeline-component";
        this._container.style.width = "100%";

        const thresholdValues = Object.values(config.thresholds).sort((a, b) => a - b);
        this._mapper = new RankScaleMapper(thresholdValues, 100);
    }

    /**
     * Cleans up resources.
     */
    public destroy(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }

    /**
     * Renders the summary timeline.
     * @returns The container element.
     */
    public render(): HTMLElement {
        this._container.innerHTML = "";
        this._titleAnchor = null;
        this._deltaAnchor = null;
        this._oldAnchor = null;
        this._newAnchor = null;

        this._titleLabel = null;
        this._deltaLabel = null;
        this._oldLabel = null;
        this._newLabel = null;

        this._titleHitbox = null;
        this._deltaHitbox = null;
        this._oldHitbox = null;
        this._newHitbox = null;

        const { minRU, maxRU } = this._calculateViewBounds();
        const rankUnitsRange = maxRU - minRU;

        const track = document.createElement("div");
        track.className = "summary-timeline-track";
        this._container.appendChild(track);

        this._renderAxis(track);
        this._renderTicks({ parent: track, minRU, maxRU, rankUnitsRange });
        this._renderProgress({ parent: track, minRU, rankUnitsRange });

        this._renderScenarioName(track);
        this._renderDelta(track, minRU, rankUnitsRange);
        this._renderRankLabels(track, minRU, rankUnitsRange);

        this._setupResizeObserver();

        return this._container;
    }

    private _setupResizeObserver(): void {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }

        this._resizeObserver = new ResizeObserver((): void => {
            this.resolveCollisions();
        });

        this._resizeObserver.observe(this._container);
    }

    private _renderScenarioName(parent: HTMLElement): void {
        const anchor = document.createElement("div");
        anchor.className = "summary-timeline-label-anchor top old title-fixed anchor-center";
        anchor.style.left = "10%";
        parent.appendChild(anchor);
        this._titleAnchor = anchor;

        const text = this._config.scenarioName;
        this._titleHitbox = this._createHitbox(anchor, text, "title");
        this._titleLabel = this._createLabel(anchor, "summary-timeline-title", text);

        this._titleLabel.style.transform = "translateX(0%)";
    }

    private _renderDelta(parent: HTMLElement, minRU: number, rankUnitsRange: number): void {
        const pct = ((this._config.newRU - minRU) / rankUnitsRange) * 100;

        if (pct < 0 || pct > 100) return;

        const anchor = document.createElement("div");
        anchor.className = "summary-timeline-label-anchor top new anchor-center";
        anchor.style.left = `${pct}%`;
        parent.appendChild(anchor);
        this._deltaAnchor = anchor;

        const text = `+${this._config.gain}%`;
        this._deltaHitbox = this._createHitbox(anchor, text);
        this._deltaLabel = this._createLabel(anchor, "summary-timeline-delta", text);

        this._deltaLabel.style.transform = "translateX(0%)";
    }

    private _createHitbox(parent: HTMLElement, text: string, className?: string): HTMLElement {
        const hitbox = document.createElement("div");
        hitbox.className = className ? `summary-timeline-hitbox ${className}` : "summary-timeline-hitbox";
        hitbox.innerText = text;
        parent.appendChild(hitbox);

        return hitbox;
    }

    /**
     * Creates a text label element.
     * @param parent - The parent element to append to.
     * @param className - The class to apply.
     * @param text - The text content.
     * @returns The label element.
     */
    private _createLabel(parent: HTMLElement, className: string, text: string): HTMLElement {
        const label = document.createElement("div");
        label.className = className;
        label.innerText = text;
        parent.appendChild(label);

        return label;
    }

    /**
     * Renders the timeline axis.
     * @param parent - The parent element to append to.
     */
    private _renderAxis(parent: HTMLElement): void {
        const axis = document.createElement("div");
        axis.className = "summary-timeline-axis";
        parent.appendChild(axis);
    }

    /**
     * Renders rank unit ticks.
     * @param options - The render options.
     */
    private _renderTicks(options: TickRenderOptions): void {
        const startRU = Math.ceil(options.minRU - 0.5);
        const endRU = Math.floor(options.maxRU + 0.5);

        for (let i = startRU; i <= endRU; i++) {
            const leftPercent = ((i - options.minRU) / options.rankUnitsRange) * 100;

            if (leftPercent < 0 || leftPercent > 100) continue;

            const tick = document.createElement("div");
            tick.className = "summary-timeline-tick";
            tick.style.left = `${leftPercent}%`;
            options.parent.appendChild(tick);
        }
    }

    /**
     * Renders rank unit progress.
     * @param options - The render options.
     */
    private _renderProgress(options: ProgressRenderOptions): void {
        const oldPct = ((this._config.oldRU - options.minRU) / options.rankUnitsRange) * 100;
        const newPct = ((this._config.newRU - options.minRU) / options.rankUnitsRange) * 100;

        const left = Math.min(oldPct, newPct);
        const right = Math.max(oldPct, newPct);
        const width = right - left;

        if (width > 0) {
            const progressLine = document.createElement("div");
            progressLine.className = "summary-timeline-progress";
            progressLine.style.left = `${left}%`;
            progressLine.style.width = `${width}%`;
            options.parent.appendChild(progressLine);
        }
    }

    /**
     * Renders all rank labels.
     * @param parent - The parent element to append to.
     * @param minRU - The minimum rank unit.
     * @param rankUnitsRange - The rank unit range.
     */
    private _renderRankLabels(parent: HTMLElement, minRU: number, rankUnitsRange: number): void {
        this._renderMarkerNotch({ parent, rankUnits: this._config.oldRU, minRU, rankUnitsRange, type: "old" });
        this._renderMarkerNotch({ parent, rankUnits: this._config.newRU, minRU, rankUnitsRange, type: "new" });

        this._renderRankLabel({
            parent,
            rankUnits: this._config.oldRU,
            rankName: this._config.oldRankName,
            progress: this._config.oldProgress,
            minRU,
            rankUnitsRange,
            type: "old"
        });

        this._renderRankLabel({
            parent,
            rankUnits: this._config.newRU,
            rankName: this._config.newRankName,
            progress: this._config.newProgress,
            minRU,
            rankUnitsRange,
            type: "new"
        });
    }

    /**
     * Renders a marker notch.
     * @param options - The render options.
     */
    private _renderMarkerNotch(options: NotchRenderOptions): void {
        const pct = ((options.rankUnits - options.minRU) / options.rankUnitsRange) * 100;

        if (pct < 0 || pct > 100) return;

        const notch = document.createElement("div");
        notch.className = `summary-timeline-marker-notch ${options.type}`;
        notch.style.left = `${pct}%`;
        options.parent.appendChild(notch);
    }

    /**
     * Renders a rank label.
     * @param options - The render options.
     */
    private _renderRankLabel(options: LabelRenderOptions): void {
        const pct = ((options.rankUnits - options.minRU) / options.rankUnitsRange) * 100;

        if (pct < 0 || pct > 100) return;

        const anchor = document.createElement("div");
        anchor.className = `summary-timeline-label-anchor bottom ${options.type} anchor-center`;
        anchor.style.left = `${pct}%`;
        options.parent.appendChild(anchor);

        const text = `${options.rankName.toUpperCase()} +${options.progress}%`;
        const hitbox = this._createHitbox(anchor, text);
        const label = this._createLabel(anchor, `summary-timeline-rank-label ${options.type}`, text);

        if (options.type === "old") {
            this._oldAnchor = anchor;
            this._oldLabel = label;
            this._oldHitbox = hitbox;
            label.style.transform = "translateX(0%)";
        } else {
            this._newAnchor = anchor;
            this._newLabel = label;
            this._newHitbox = hitbox;
            label.style.transform = "translateX(0%)";
        }
    }

    /**
     * Resolves collisions between label pairs.
     */
    public resolveCollisions(): void {
        this._resolvePair({
            leftHitbox: this._titleHitbox,
            rightHitbox: this._deltaHitbox,
            leftLabel: this._titleLabel,
            rightLabel: this._deltaLabel
        });

        this._resolvePair({
            leftHitbox: this._oldHitbox,
            rightHitbox: this._newHitbox,
            leftLabel: this._oldLabel,
            rightLabel: this._newLabel
        });
    }

    private _resolvePair(options: CollisionOptions): void {
        if (!options.leftHitbox || !options.rightHitbox || !options.leftLabel || !options.rightLabel) return;

        const leftRect = options.leftHitbox.getBoundingClientRect();
        const rightRect = options.rightHitbox.getBoundingClientRect();

        if (leftRect.width === 0 || rightRect.width === 0) return;

        const buffer = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;

        // Default Alignments (Centered)
        let leftTransform = "translateX(0%)";
        let rightTransform = "translateX(0%)";

        if (leftRect.right + buffer > rightRect.left) {
            leftTransform = "translateX(-50%)";
            rightTransform = "translateX(50%)";
        }

        options.leftLabel.style.transform = leftTransform;
        options.rightLabel.style.transform = rightTransform;
    }

    /**
     * Calculates the view bounds for the timeline.
     * @returns The min and max rank units to display.
     */
    private _calculateViewBounds(): { minRU: number; maxRU: number } {
        const center = (this._config.oldRU + this._config.newRU) / 2;
        const windowSize = 2.5;

        let minRU = center - (windowSize / 2);
        const constraint = this._config.newRU - (0.8 * windowSize);

        if (minRU < constraint) {
            minRU = constraint;
        }

        return {
            minRU,
            maxRU: minRU + windowSize
        };
    }
}
