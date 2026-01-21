import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";

export interface RankTimelineConfiguration {
    readonly thresholds: Record<string, number>;
    readonly settings: VisualSettings;
    readonly targetRU?: number;
    readonly achievedRU?: number;
    readonly scrollAnchorRU?: number;
    readonly attemptsRU?: number[];
    // How many RUs to show. Default to 3.5
    readonly rangeWindow?: number;
    readonly expectedRU?: number;
    readonly targetLabel?: string;
    readonly achievedLabel?: string;
}

interface MarkerRenderOptions {
    readonly parent: HTMLElement;
    readonly notchPercent: number;
    readonly labelPercent: number;
    readonly label: string;
    readonly type: "achieved" | "target";
}

/**
 * Visualizes the rank progression timeline.
 */
export class RankTimelineComponent {
    private readonly _container: HTMLElement;
    private readonly _viewport: HTMLElement;
    private readonly _scroller: HTMLElement;

    // Persistent layers to enable animations
    private readonly _ticksLayer: HTMLElement;
    private readonly _attemptsLayer: HTMLElement;
    private readonly _progressLine: HTMLElement;
    private readonly _markersLayer: HTMLElement;

    private _config: RankTimelineConfiguration;
    private _mapper: RankScaleMapper;

    private _targetAnchor: HTMLElement | null = null;
    private _achievedAnchor: HTMLElement | null = null;
    private _targetLabel: HTMLElement | null = null;
    private _achievedLabel: HTMLElement | null = null;

    private _isInitialized: boolean = false;
    private _hasPreviousProgress: boolean = false;
    private _pendingScrollOffset: number | null = null;

    /**
     * Initializes the timeline.
     * @param config - The initial configuration.
     */
    public constructor(config: RankTimelineConfiguration) {
        this._config = config;

        this._container = document.createElement("div");
        this._container.className = "rank-timeline-container";

        this._viewport = document.createElement("div");
        this._viewport.className = "timeline-viewport";
        this._container.appendChild(this._viewport);

        this._scroller = document.createElement("div");
        this._scroller.className = "timeline-scroller";
        this._viewport.appendChild(this._scroller);

        // Initialize persistent layers
        const axis = document.createElement("div");
        axis.className = "timeline-axis";
        this._scroller.appendChild(axis);

        this._ticksLayer = document.createElement("div");
        this._ticksLayer.className = "timeline-ticks-layer";
        this._scroller.appendChild(this._ticksLayer);

        this._attemptsLayer = document.createElement("div");
        this._attemptsLayer.className = "timeline-attempts-layer";
        this._scroller.appendChild(this._attemptsLayer);

        this._progressLine = document.createElement("div");
        this._progressLine.className = "timeline-progress-line";

        // Start hidden
        this._progressLine.style.opacity = "0";
        this._scroller.appendChild(this._progressLine);

        this._markersLayer = document.createElement("div");
        this._markersLayer.className = "timeline-markers-layer";
        this._scroller.appendChild(this._markersLayer);

        const thresholdValues = Object.values(config.thresholds).sort((a: number, b: number) => a - b);
        this._mapper = new RankScaleMapper(thresholdValues, 100);
    }

    /**
     * Gets the main container element.
     * @returns The container element.
     */
    public getContainer(): HTMLElement {
        return this._container;
    }

    /**
     * Updates the timeline configuration and triggers a scroll animation.
     * @param config - The new configuration.
     * @param immediate - If true, jumps to the new position without animation.
     * @param paused - If true, renders the initial state but waits for play() to animate.
     */
    public update(config: RankTimelineConfiguration, immediate: boolean = false, paused: boolean = false): void {
        this._config = config;

        const thresholdValues = Object.values(config.thresholds).sort((a: number, b: number) => a - b);
        this._mapper = new RankScaleMapper(thresholdValues, 100);

        this.render(immediate, paused);
    }

    /**
     * triggers any pending animations.
     */
    public play(): void {
        if (this._pendingScrollOffset !== null) {
            this._scroller.classList.remove("no-transition");
            this._scroller.style.transform = `translateX(${this._pendingScrollOffset}%)`;
            this._pendingScrollOffset = null;
        }

        this._renderProgressLine(false, false);
    }

    /**
     * Renders the component contents and updates the scroll position.
     * @param immediate - If true, jumps to the new position without animation.
     * @param paused - If true, renders the initial state but waits for play() to animate.
     * @returns The container element.
     */
    public render(immediate: boolean = false, paused: boolean = false): HTMLElement {
        // Clear non-persistent layers
        this._ticksLayer.innerHTML = "";
        this._attemptsLayer.innerHTML = "";
        this._markersLayer.innerHTML = "";

        const offscreenTargetAnchors = this._container.querySelectorAll(".timeline-marker-anchor.offscreen");
        offscreenTargetAnchors.forEach(a => a.remove());

        this._targetAnchor = null;
        this._achievedAnchor = null;
        this._targetLabel = null;
        this._achievedLabel = null;

        const { minRU } = this._calculateViewBounds();
        const windowSize = this._config.rangeWindow ?? 7.5;

        this._renderTicks();
        this._renderAttempts();
        this._renderMarkers(minRU, windowSize);
        this._renderProgressLine(immediate, paused);

        this._applyScroll(minRU, windowSize, immediate, paused);
        this._isInitialized = true;

        return this._container;
    }

    private _renderTicks(): void {
        const rankNames = Object.keys(this._config.thresholds).sort(
            (a, b) => this._config.thresholds[a] - this._config.thresholds[b]
        );

        for (let i = -5; i <= 25; i++) {
            const matchingRank = rankNames.find((name: string) => {
                const score = this._config.thresholds[name];
                const rankUnit = this._mapper.calculateRankUnit(score);

                return Math.abs(rankUnit - i) < 0.001;
            });

            this._renderRankTick(i, matchingRank || "");
        }
    }

    private _renderRankTick(rankUnit: number, label: string): void {
        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        const leftPercent = rankUnit * unitWidth;

        const tick = document.createElement("div");
        tick.className = "timeline-tick";
        if (!label) {
            tick.classList.add("minor");
        }
        tick.style.left = `${leftPercent}%`;
        this._ticksLayer.appendChild(tick);

        if (label) {
            const text = document.createElement("div");
            text.className = "timeline-tick-label";
            text.innerText = label;
            text.style.left = `${leftPercent}%`;
            this._ticksLayer.appendChild(text);
        }
    }

    private _renderMarkers(minRU: number, windowSize: number): void {
        const targetRU = this._config.targetRU;
        const achievedRU = this._config.achievedRU;

        if (this._isTargetOffscreen(minRU, windowSize)) {
            this._renderOffscreenTarget();
            this._renderAchievedInOffscreenMode();

            return;
        }

        if (targetRU !== undefined && targetRU !== null && achievedRU !== undefined) {
            this._renderOverlappingMarkers(targetRU, achievedRU);
        } else {
            this._renderSingleMarkers(targetRU, achievedRU);
        }
    }

    private _renderOffscreenTarget(): void {
        const leftPercent = 25;
        const anchor = document.createElement("div");
        anchor.className = "timeline-marker-anchor anchor-target offscreen";
        anchor.style.left = `${leftPercent}%`;
        this._container.appendChild(anchor);

        const caret = document.createElement("div");
        caret.className = "timeline-caret offscreen";
        anchor.appendChild(caret);

        const text = document.createElement("div");
        text.className = `timeline-marker-label label-target offscreen`;
        text.innerText = (this._config.targetLabel || "TARGET").toUpperCase();
        anchor.appendChild(text);

        this._targetAnchor = anchor;
        this._targetLabel = text;
    }

    private _renderOverlappingMarkers(target: number, achieved: number): void {
        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        this._renderMarker({
            parent: this._markersLayer,
            notchPercent: achieved * unitWidth,
            labelPercent: achieved * unitWidth,
            label: this._config.achievedLabel || "Achieved",
            type: "achieved"
        });
        this._renderMarker({
            parent: this._markersLayer,
            notchPercent: target * unitWidth,
            labelPercent: target * unitWidth,
            label: this._config.targetLabel || "Target",
            type: "target"
        });
    }

    private _renderSingleMarkers(target?: number, achieved?: number): void {
        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);

        if (achieved !== undefined) {
            this._renderMarker({
                parent: this._markersLayer,
                notchPercent: achieved * unitWidth,
                labelPercent: achieved * unitWidth,
                label: this._config.achievedLabel || "Achieved",
                type: "achieved"
            });
        }
        if (target !== undefined && target !== null) {
            this._renderMarker({
                parent: this._markersLayer,
                notchPercent: target * unitWidth,
                labelPercent: target * unitWidth,
                label: this._config.targetLabel || "Target",
                type: "target"
            });
        }
    }

    private _renderMarker(options: MarkerRenderOptions): void {
        const marker = document.createElement("div");
        marker.className = `timeline-marker marker-${options.type}`;
        marker.style.left = `${options.notchPercent}%`;
        options.parent.appendChild(marker);

        const anchor = document.createElement("div");
        anchor.className = `timeline-marker-anchor anchor-${options.type}`;
        anchor.style.left = `${options.labelPercent}%`;
        options.parent.appendChild(anchor);

        const text = document.createElement("div");
        text.className = `timeline-marker-label label-${options.type}`;
        text.innerText = options.label.toUpperCase();
        anchor.appendChild(text);

        if (options.type === "target") {
            this._targetAnchor = anchor;
            this._targetLabel = text;
        } else {
            this._achievedAnchor = anchor;
            this._achievedLabel = text;
        }
    }

    private _renderAchievedInOffscreenMode(): void {
        const achievedRU = this._config.achievedRU;

        if (achievedRU === undefined) return;

        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        this._renderMarker({
            parent: this._markersLayer,
            notchPercent: achievedRU * unitWidth,
            labelPercent: achievedRU * unitWidth,
            label: this._config.achievedLabel || "Achieved",
            type: "achieved"
        });
    }

    private _renderAttempts(): void {
        const attempts = this._config.attemptsRU;
        if (!attempts || attempts.length === 0) return;

        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        const opacity = (this._config.settings.dotOpacity ?? 40) / 100;
        const sorted = [...attempts].sort((a: number, b: number) => b - a);
        const top3Threshold = sorted.length >= 3 ? sorted[2] : (sorted[sorted.length - 1] ?? -Infinity);

        attempts.forEach((rankUnit: number) => {
            const isTop3 = rankUnit >= top3Threshold;
            const notch = document.createElement("div");
            notch.className = "timeline-marker marker-attempt";
            if (!isTop3) notch.classList.add("secondary");
            notch.style.left = `${rankUnit * unitWidth}%`;
            notch.style.opacity = opacity.toString();
            this._attemptsLayer.appendChild(notch);
        });
    }

    private _renderProgressLine(immediate: boolean, paused: boolean): void {
        const targetRU = this._config.targetRU;
        const expectedRU = this._config.expectedRU;

        if (targetRU === undefined || targetRU === null || expectedRU === undefined || expectedRU === null) {
            this._hideProgressLine();

            return;
        }

        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        const left = Math.min(targetRU, expectedRU) * unitWidth;
        const width = Math.abs(targetRU - expectedRU) * unitWidth;

        if (!this._hasPreviousProgress && !immediate) {
            this._renderInitialProgress(targetRU * unitWidth, left, width, paused);
        } else if (immediate) {
            this._renderImmediateProgress(left, width);
        } else {
            this._renderStandardProgress(left, width);
        }

        if (!paused) {
            this._hasPreviousProgress = true;
        }
    }

    private _hideProgressLine(): void {
        this._progressLine.style.opacity = "0";
        this._hasPreviousProgress = false;
    }

    private _renderInitialProgress(targetPct: number, finalLeft: number, finalWidth: number, paused: boolean): void {
        this._progressLine.style.transition = "none";
        this._progressLine.style.left = `${targetPct}%`;
        this._progressLine.style.width = "0%";
        this._progressLine.style.opacity = "1";

        void this._progressLine.offsetHeight;

        if (!paused) {
            this._progressLine.style.transition = "";
            this._progressLine.style.left = `${finalLeft}%`;
            this._progressLine.style.width = `${finalWidth}%`;
        }
    }

    private _renderImmediateProgress(left: number, width: number): void {
        this._progressLine.style.transition = "none";
        this._progressLine.style.left = `${left}%`;
        this._progressLine.style.width = `${width}%`;
        this._progressLine.style.opacity = "1";

        void this._progressLine.offsetHeight;
        this._progressLine.style.transition = "";
    }

    private _renderStandardProgress(left: number, width: number): void {
        this._progressLine.style.left = `${left}%`;
        this._progressLine.style.width = `${width}%`;
        this._progressLine.style.opacity = "1";
    }

    private _applyScroll(minRU: number, windowSize: number, immediate: boolean, paused: boolean): void {
        const unitWidth = 100 / windowSize;
        const offsetPercent = -minRU * unitWidth;

        if (paused && this._isInitialized) {
            this._pendingScrollOffset = offsetPercent;

            return;
        }

        this._pendingScrollOffset = null;

        if (immediate || !this._isInitialized) {
            this._scroller.classList.add("no-transition");
            this._scroller.style.transform = `translateX(${offsetPercent}%)`;
            // Force reflow
            void this._scroller.offsetHeight;
            this._scroller.classList.remove("no-transition");
        } else {
            this._scroller.style.transform = `translateX(${offsetPercent}%)`;
        }
    }

    /**
     * Resolves visual collisions between markers.
     */
    public resolveCollisions(): void {
        const hasRequiredElements = this._targetAnchor && this._achievedAnchor &&
            this._targetLabel && this._achievedLabel;

        if (!hasRequiredElements) return;

        const targetRect: DOMRect = this._targetAnchor!.getBoundingClientRect();
        const achievedRect: DOMRect = this._achievedAnchor!.getBoundingClientRect();
        const buffer: number = 0.5 * parseFloat(getComputedStyle(document.documentElement).fontSize);

        if (targetRect.left < achievedRect.right + buffer && targetRect.right > achievedRect.left - buffer) {
            this._adjustOverlappingLabels(targetRect, achievedRect);
        }
    }

    private _adjustOverlappingLabels(targetRect: DOMRect, achievedRect: DOMRect): void {
        const currentTargetCenter = targetRect.left + (targetRect.width / 2);
        const currentAchievedCenter = achievedRect.left + (achievedRect.width / 2);
        let finalTargetCenter;
        let finalAchievedCenter;

        if (currentTargetCenter <= currentAchievedCenter) {
            finalTargetCenter = currentTargetCenter - (targetRect.width / 2);
            finalAchievedCenter = currentAchievedCenter + (achievedRect.width / 2);
        } else {
            finalAchievedCenter = currentAchievedCenter - (achievedRect.width / 2);
            finalTargetCenter = currentTargetCenter + (targetRect.width / 2);
        }

        this._targetLabel!.style.transform = `translateX(${finalTargetCenter - currentTargetCenter}px)`;
        this._achievedLabel!.style.transform = `translateX(${finalAchievedCenter - currentAchievedCenter}px)`;
    }

    private _calculateViewBounds(): { minRU: number; maxRU: number } {
        const target = this._config.targetRU ?? 0;
        const achieved = this._config.scrollAnchorRU ?? this._config.achievedRU;
        let center = target;

        if (achieved !== undefined) center = (target + achieved) / 2;

        const windowSize = this._config.rangeWindow ?? 7.5;
        let minRU = center - (windowSize / 2);

        if (achieved !== undefined) {
            const constraint = achieved - (0.7 * windowSize);

            if (minRU < constraint) minRU = constraint;
        }

        return { minRU, maxRU: minRU + windowSize };
    }

    private _isTargetOffscreen(minRU: number, range: number): boolean {
        const targetRU = this._config.targetRU;

        if (targetRU === undefined) return false;

        const tPct = ((targetRU - minRU) / range) * 100;

        return tPct < 25;
    }
}
