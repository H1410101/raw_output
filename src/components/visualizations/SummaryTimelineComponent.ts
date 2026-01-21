import { VisualSettings } from "../../services/VisualSettingsService";


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
    readonly totalSecondsSpent: number;
    readonly attempts: number;
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

    private _scroller: HTMLElement | null = null;
    private _progressLine: HTMLElement | null = null;

    private _resizeObserver: ResizeObserver | null = null;
    private _hasStarted: boolean = false;
    private _isDeltaAnimating: boolean = false;
    private _pendingEndScroll: number | null = null;
    private _playTimeout: number | null = null;

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
    }

    /**
     * Returns true if the animation has started.
     * @returns True if started.
     */
    public hasStarted(): boolean {
        return this._hasStarted;
    }

    /**
     * Gets the scenario name for this timeline.
     * @returns The scenario name.
     */
    public get scenarioName(): string {
        return this._config.scenarioName;
    }

    /**
     * Cleans up resources.
     */
    public destroy(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        if (this._playTimeout !== null) {
            window.clearTimeout(this._playTimeout);
            this._playTimeout = null;
        }
    }

    /**
     * Triggers the animation.
     */
    public play(): void {
        if (this._hasStarted || !this._scroller || !this._progressLine) return;
        this._hasStarted = true;

        if (this._pendingEndScroll !== null) {
            this._scroller.style.transform = `translateX(${this._pendingEndScroll}%)`;
            this._pendingEndScroll = null;
        }

        const { startMinRU, endMinRU, windowSize } = this._calculateAnimationBounds();
        const renderMinRU = Math.min(startMinRU, endMinRU);
        const unitWidth = 100 / windowSize;

        const oldPct = (this._config.oldRU - renderMinRU) * unitWidth;
        const newPct = (this._config.newRU - renderMinRU) * unitWidth;

        const left = Math.min(oldPct, newPct);
        const width = Math.abs(oldPct - newPct);

        this._progressLine.style.left = `${left}%`;
        this._progressLine.style.width = `${width}%`;
        this._playTimeout = window.setTimeout((): void => {
            this._playTimeout = null;
            if (this._deltaLabel) {
                this._isDeltaAnimating = true;
                this._deltaLabel.style.transition = "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
                this._deltaLabel.style.opacity = "0.8";
                this.resolveCollisions();
            }
        }, 1500);
    }

    /**
     * Renders the summary timeline in its initial state.
     * @returns The container element.
     */
    public render(): HTMLElement {
        this._resetLabelsAndHitboxes();

        const { startMinRU, endMinRU, windowSize } = this._calculateAnimationBounds();
        const unitWidth = 100 / windowSize;
        const renderMinRU = Math.min(startMinRU, endMinRU);

        const track = document.createElement("div");
        track.className = "summary-timeline-track";
        this._container.appendChild(track);

        this._scroller = document.createElement("div");
        this._scroller.className = "summary-timeline-scroller";
        track.appendChild(this._scroller);

        this._renderScrollerContents(renderMinRU, unitWidth, startMinRU, endMinRU);
        this._renderContainerContents();


        this._setupScrollerInitialState(renderMinRU, startMinRU, endMinRU, unitWidth);
        this._setupResizeObserver();

        return this._container;
    }

    private _resetLabelsAndHitboxes(): void {
        this._container.innerHTML = "";
        this._titleLabel = null;
        this._deltaLabel = null;
        this._oldLabel = null;
        this._newLabel = null;
        this._titleHitbox = null;
        this._deltaHitbox = null;
        this._oldHitbox = null;
        this._newHitbox = null;
    }

    private _renderScrollerContents(renderMinRU: number, unitWidth: number, startMinRU: number, endMinRU: number): void {
        if (!this._scroller) return;

        const windowSize = 2.5;
        const renderMaxRU = Math.max(startMinRU + windowSize, endMinRU + windowSize);

        this._renderAxis(this._scroller);
        this._renderTicks({ parent: this._scroller, minRU: renderMinRU, maxRU: renderMaxRU, rankUnitsRange: windowSize, unitWidth });
        this._renderInitialProgress(this._scroller, renderMinRU, unitWidth);
        this._renderDelta(this._scroller, renderMinRU, unitWidth);
        this._renderRankLabels(this._scroller, renderMinRU, unitWidth);
    }

    private _renderContainerContents(): void {
        this._renderScenarioName();
        this._renderScenarioStats();
    }

    private _setupScrollerInitialState(renderMinRU: number, startMinRU: number, endMinRU: number, unitWidth: number): void {
        if (!this._scroller) return;

        const initialOffset = (renderMinRU - startMinRU) * unitWidth;
        this._scroller.style.transition = "none";
        this._scroller.style.transform = `translateX(${initialOffset}%)`;
        void this._scroller.offsetHeight;
        this._scroller.style.transition = "";

        this._pendingEndScroll = (renderMinRU - endMinRU) * unitWidth;
    }

    private _renderInitialProgress(parent: HTMLElement, minRU: number, unitWidth: number): void {
        const oldPct = (this._config.oldRU - minRU) * unitWidth;

        this._progressLine = document.createElement("div");
        this._progressLine.className = "summary-timeline-progress";
        this._progressLine.style.transition = "none";
        this._progressLine.style.left = `${oldPct}%`;
        this._progressLine.style.width = "0%";
        parent.appendChild(this._progressLine);

        void this._progressLine.offsetHeight;
        this._progressLine.style.transition = "";
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

    private _renderScenarioName(): void {
        const containerAnchor = document.createElement("div");
        containerAnchor.className = "summary-timeline-label-anchor top old title-fixed anchor-left";
        containerAnchor.style.left = "1.5rem";
        this._container.appendChild(containerAnchor);

        const text = this._config.scenarioName;
        this._titleHitbox = this._createHitbox(containerAnchor, text, "title");
        this._titleLabel = this._createLabel(containerAnchor, "summary-timeline-title", text);

        this._titleLabel.style.transform = "none";
    }

    private _renderScenarioStats(): void {
        const anchor = document.createElement("div");
        anchor.className = "summary-timeline-label-anchor top old title-fixed anchor-right";
        anchor.style.right = "1.5rem";
        this._container.appendChild(anchor);

        const mins = Math.floor(this._config.totalSecondsSpent / 60);
        const secs = this._config.totalSecondsSpent % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

        const text = `${timeStr} | ${this._config.attempts}`;
        this._createLabel(anchor, "summary-timeline-stats", text);
    }

    private _renderDelta(parent: HTMLElement, minRU: number, unitWidth: number): void {
        const pct = (this._config.newRU - minRU) * unitWidth;


        const anchor = document.createElement("div");
        anchor.className = "summary-timeline-label-anchor top new anchor-center";
        anchor.style.left = `${pct}%`;
        parent.appendChild(anchor);

        const text = `+${this._config.gain}%`;
        this._deltaHitbox = this._createHitbox(anchor, text);
        this._deltaLabel = this._createLabel(anchor, "summary-timeline-delta", text);

        this._deltaLabel.style.opacity = "0";
        this._deltaLabel.style.transform = "translateX(-1.5rem)";
    }

    private _createHitbox(parent: HTMLElement, text: string, className?: string): HTMLElement {
        const hitbox = document.createElement("div");
        hitbox.className = className ? `summary-timeline-hitbox ${className}` : "summary-timeline-hitbox";
        hitbox.innerText = text;
        parent.appendChild(hitbox);

        return hitbox;
    }

    private _createLabel(parent: HTMLElement, className: string, text: string): HTMLElement {
        const label = document.createElement("div");
        label.className = className;
        label.innerText = text;
        parent.appendChild(label);

        return label;
    }

    private _renderAxis(parent: HTMLElement): void {
        const axis = document.createElement("div");
        axis.className = "summary-timeline-axis";
        axis.style.left = "-500%";
        axis.style.right = "-500%";
        parent.appendChild(axis);
    }

    private _renderTicks(options: { parent: HTMLElement, minRU: number, maxRU: number, rankUnitsRange: number, unitWidth: number }): void {
        const startRU = Math.ceil(options.minRU - 0.5);
        const endRU = Math.floor(options.maxRU + 0.5);

        for (let i = startRU; i <= endRU; i++) {
            const leftPercent = (i - options.minRU) * options.unitWidth;

            const tick = document.createElement("div");
            tick.className = "summary-timeline-tick";
            tick.style.left = `${leftPercent}%`;
            options.parent.appendChild(tick);
        }
    }

    private _renderRankLabels(parent: HTMLElement, minRU: number, unitWidth: number): void {
        this._renderMarkerNotch({ parent, rankUnits: this._config.oldRU, minRU, unitWidth, type: "old" });
        this._renderMarkerNotch({ parent, rankUnits: this._config.newRU, minRU, unitWidth, type: "new" });

        this._renderRankLabel({
            parent,
            rankUnits: this._config.oldRU,
            rankName: this._config.oldRankName,
            progress: this._config.oldProgress,
            minRU,
            unitWidth,
            type: "old"
        });

        this._renderRankLabel({
            parent,
            rankUnits: this._config.newRU,
            rankName: this._config.newRankName,
            progress: this._config.newProgress,
            minRU,
            unitWidth,
            type: "new"
        });
    }

    private _renderMarkerNotch(options: { parent: HTMLElement, rankUnits: number, minRU: number, unitWidth: number, type: "old" | "new" }): void {
        const pct = (options.rankUnits - options.minRU) * options.unitWidth;

        const notch = document.createElement("div");
        notch.className = `summary-timeline-marker-notch ${options.type}`;
        notch.style.left = `${pct}%`;
        options.parent.appendChild(notch);
    }

    private _renderRankLabel(options: { parent: HTMLElement, rankUnits: number, rankName: string, progress: number, minRU: number, unitWidth: number, type: "old" | "new" }): void {
        const pct = (options.rankUnits - options.minRU) * options.unitWidth;

        const anchor = document.createElement("div");
        anchor.className = `summary-timeline-label-anchor bottom ${options.type} anchor-center`;
        anchor.style.left = `${pct}%`;
        options.parent.appendChild(anchor);

        const text = `${options.rankName.toUpperCase()} +${options.progress}%`;
        const hitbox = this._createHitbox(anchor, text);
        const label = this._createLabel(anchor, `summary-timeline-rank-label ${options.type}`, text);

        if (options.type === "old") {
            this._oldLabel = label;
            this._oldHitbox = hitbox;
        } else {
            this._newLabel = label;
            this._newHitbox = hitbox;
        }
        label.style.transform = "translateX(0%)";
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

        // Default Alignments 
        let leftTransform = options.leftLabel === this._titleLabel ? "none" : "translateX(0%)";
        let rightTransform = "translateX(0%)";

        if (leftRect.right + buffer > rightRect.left) {
            if (options.leftLabel === this._titleLabel) {
                const shift = leftRect.right + buffer - rightRect.left;
                rightTransform = `translateX(${shift}px)`;
            } else {
                leftTransform = "translateX(-50%)";
                rightTransform = "translateX(50%)";
            }
        }

        options.leftLabel.style.transform = leftTransform;

        if (options.rightLabel !== this._deltaLabel || this._isDeltaAnimating) {
            options.rightLabel.style.transform = rightTransform;
        }
    }

    private _calculateAnimationBounds(): { startMinRU: number, endMinRU: number, windowSize: number } {
        const windowSize = 2.5;
        const startMinRU = this._config.oldRU - (windowSize / 2);

        const { minRU: endMinRU } = this._getFinalViewBounds();

        return { startMinRU, endMinRU, windowSize };
    }

    private _getFinalViewBounds(): { minRU: number; windowSize: number } {
        const windowSize = 2.5;
        const center = (this._config.oldRU + this._config.newRU) / 2;

        let minRU = center - (windowSize / 2);
        const constraint = this._config.newRU - (0.8 * windowSize);

        if (minRU < constraint) {
            minRU = constraint;
        }

        return { minRU, windowSize };
    }
}
