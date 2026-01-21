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
    private _pendingMinRU: number | null = null;
    private _currentMinRU: number = 0;

    private _managedMarkers: {
        rankUnit: number;
        type: "target" | "achieved" | "expected";
        label: string;
        notch: HTMLElement;
        anchor: HTMLElement;
        labelElement: HTMLElement | null;
        caretLeft: HTMLElement;
        caretRight: HTMLElement;
    }[] = [];

    private _markerSyncId: number | null = null;

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
        const wasPaused = this._pendingScrollOffset !== null;
        const targetMinRU = wasPaused ? (this._pendingMinRU ?? this._currentMinRU) : this._currentMinRU;

        if (wasPaused) {
            this._scroller.classList.remove("no-transition");
            this._scroller.style.transform = `translateX(${this._pendingScrollOffset}%)`;
            this._currentMinRU = this._pendingMinRU ?? this._currentMinRU;
            this._pendingScrollOffset = null;
            this._pendingMinRU = null;
        }

        this._renderProgressLine({
            immediate: false,
            paused: false,
            viewportMinRU: targetMinRU
        });

        if (wasPaused) {
            this._startMarkerSync();
        }
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
        this._renderMarkers();
        this._renderProgressLine({
            immediate,
            paused,
            viewportMinRU: minRU
        });

        this._applyScroll(minRU, windowSize, immediate, paused);
        this._isInitialized = true;

        if (!immediate && !paused) {
            this._startMarkerSync();
        } else {
            this._syncMarkers();
        }

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

    private _renderMarkers(): void {
        const targetRU = this._config.targetRU;
        const achievedRU = this._config.achievedRU;
        const expectedRU = this._config.expectedRU;

        // Clear managed markers
        this._managedMarkers.forEach((marker) => {
            marker.caretLeft.remove();
            marker.caretRight.remove();
        });
        this._managedMarkers = [];

        // Collect all potential markers
        if (targetRU !== undefined && targetRU !== null) {
            this._setupManagedMarker(targetRU, this._config.targetLabel || "Target", "target");
        }
        if (achievedRU !== undefined) {
            this._setupManagedMarker(achievedRU, this._config.achievedLabel || "Achieved", "achieved");
        }
        if (expectedRU !== undefined && expectedRU !== null && expectedRU > (achievedRU ?? -Infinity)) {
            this._setupManagedMarker(expectedRU, "", "expected");
        }
    }

    private _setupManagedMarker(rankUnit: number, label: string, type: "target" | "achieved" | "expected"): void {
        const windowSize = this._config.rangeWindow ?? 7.5;
        const unitWidth = 100 / windowSize;
        const percent = rankUnit * unitWidth;

        const notch = this._createNotch(percent, type);
        const anchor = this._createAnchor(percent, type, label);

        const caretLeft = this._createCaret(label, type, true);
        const caretRight = this._createCaret(label, type, false);

        this._managedMarkers.push({
            rankUnit,
            type,
            label,
            notch,
            anchor,
            labelElement: anchor.querySelector(".timeline-marker-label"),
            caretLeft,
            caretRight,
        });

        this._trackLabelAnchors(type, anchor);
    }

    private _createNotch(percent: number, type: string): HTMLElement {
        const notch = document.createElement("div");
        notch.className = `timeline-marker marker-${type}`;
        notch.style.left = `${percent}%`;
        this._markersLayer.appendChild(notch);

        return notch;
    }

    private _createAnchor(percent: number, type: string, label: string): HTMLElement {
        const anchor = document.createElement("div");
        anchor.className = `timeline-marker-anchor anchor-${type}`;
        anchor.style.left = `${percent}%`;
        this._markersLayer.appendChild(anchor);

        if (label) {
            const labelElement = document.createElement("div");
            labelElement.className = `timeline-marker-label label-${type}`;
            labelElement.innerText = label.toUpperCase();
            anchor.appendChild(labelElement);
        }

        return anchor;
    }

    private _trackLabelAnchors(type: string, anchor: HTMLElement): void {
        const labelElement = anchor.querySelector(".timeline-marker-label") as HTMLElement | null;
        if (type === "target") {
            this._targetAnchor = anchor;
            this._targetLabel = labelElement;
        } else if (type === "achieved") {
            this._achievedAnchor = anchor;
            this._achievedLabel = labelElement;
        }
    }

    private _createCaret(label: string, type: string, isLeft: boolean): HTMLElement {
        const clampedPct = isLeft ? 20 : 80;

        const anchor = document.createElement("div");
        anchor.className = `timeline-marker-anchor anchor-${type} offscreen`;
        anchor.style.left = `${clampedPct}%`;
        anchor.style.opacity = "0";
        anchor.style.pointerEvents = "none";
        // Pin to the side of the Window: left caret starts at 20%, right caret ends at 80%
        anchor.style.transform = isLeft ? "translateX(0)" : "translateX(-100%)";
        this._container.appendChild(anchor);

        const caret = document.createElement("div");
        caret.className = `timeline-caret offscreen caret-${type}`;
        if (!isLeft) caret.style.transform = "rotate(135deg)";

        const text = label ? document.createElement("div") : null;
        if (text) {
            text.className = `timeline-marker-label label-${type} offscreen`;
            text.innerText = label.toUpperCase();
        }

        if (isLeft) {
            anchor.appendChild(caret);
            if (text) anchor.appendChild(text);
        } else {
            if (text) anchor.appendChild(text);
            anchor.appendChild(caret);
        }

        return anchor;
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

    private _renderProgressLine(options: {
        immediate: boolean;
        paused: boolean;
        viewportMinRU?: number;
    }): void {
        const targetRU = this._config.targetRU;
        const expectedRU = this._config.expectedRU;

        if (targetRU === undefined || targetRU === null || expectedRU === undefined || expectedRU === null) {
            this._hideProgressLine();

            return;
        }

        const effectiveMinRU = options.viewportMinRU ?? this._currentMinRU;
        this._performProgressLineAnimate({
            targetRU,
            expectedRU,
            immediate: options.immediate,
            paused: options.paused,
            effectiveMinRU
        });

        if (!options.paused) {
            this._hasPreviousProgress = true;
        }
    }

    private _performProgressLineAnimate(options: {
        targetRU: number;
        expectedRU: number;
        immediate: boolean;
        paused: boolean;
        effectiveMinRU: number;
    }): void {
        const unitWidth = 100 / (this._config.rangeWindow ?? 7.5);
        const left = Math.min(options.targetRU, options.expectedRU) * unitWidth;
        const width = Math.abs(options.targetRU - options.expectedRU) * unitWidth;

        if (!this._hasPreviousProgress && !options.immediate) {
            this._renderInitialProgress({
                targetRU: options.targetRU,
                viewportMinRU: options.effectiveMinRU,
                finalLeft: left,
                finalWidth: width,
                paused: options.paused
            });
        } else if (options.immediate) {
            this._renderImmediateProgress(left, width);
        } else {
            this._renderStandardProgress(left, width);
        }
    }

    private _hideProgressLine(): void {
        this._progressLine.style.opacity = "0";
        this._hasPreviousProgress = false;
    }

    private _renderInitialProgress(options: {
        targetRU: number;
        viewportMinRU: number;
        finalLeft: number;
        finalWidth: number;
        paused: boolean;
    }): void {
        const windowSize = this._config.rangeWindow ?? 7.5;
        const unitWidth = 100 / windowSize;

        // Start from target if it is within the 'anchor width' (20-80% of current view), or left edge
        const targetViewPct = (options.targetRU - options.viewportMinRU) * unitWidth;
        const isOnAnchorWidth = targetViewPct >= 20 && targetViewPct <= 80;

        const initialLeft = isOnAnchorWidth ? options.targetRU * unitWidth : options.viewportMinRU * unitWidth;

        this._progressLine.style.transition = "none";
        this._progressLine.style.left = `${initialLeft}%`;
        this._progressLine.style.width = "0%";
        this._progressLine.style.opacity = "1";

        void this._progressLine.offsetHeight;

        if (!options.paused) {
            this._progressLine.style.transition = "";
            this._progressLine.style.left = `${options.finalLeft}%`;
            this._progressLine.style.width = `${options.finalWidth}%`;
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
            this._pendingMinRU = minRU;

            return;
        }

        this._pendingScrollOffset = null;
        this._pendingMinRU = null;

        if (immediate || !this._isInitialized) {
            this._scroller.classList.add("no-transition");
            this._scroller.style.transform = `translateX(${offsetPercent}%)`;
            // Force reflow
            void this._scroller.offsetHeight;
            this._scroller.classList.remove("no-transition");
            this._currentMinRU = minRU;
            this._syncMarkers();
        } else {
            this._scroller.style.transform = `translateX(${offsetPercent}%)`;
            this._currentMinRU = minRU;
            this._startMarkerSync();
        }
    }

    private _startMarkerSync(): void {
        if (this._markerSyncId !== null) {
            cancelAnimationFrame(this._markerSyncId);
        }

        const startTime = performance.now();
        const duration = 1000;

        const step = (now: number): void => {
            this._syncMarkers();
            if (now - startTime < duration + 100) {
                this._markerSyncId = requestAnimationFrame(step);
            } else {
                this._markerSyncId = null;
            }
        };

        this._markerSyncId = requestAnimationFrame(step);
    }

    private _syncMarkers(): void {
        const viewportRect = this._viewport.getBoundingClientRect();
        const width = viewportRect.width;
        if (width === 0) return;

        const windowStart = 0.2 * width;
        const windowEnd = 0.8 * width;

        this._managedMarkers.forEach((marker) => {
            const notchRect = marker.notch.getBoundingClientRect();
            const center = notchRect.left + (notchRect.width / 2);
            const relCenter = center - viewportRect.left;

            const isLeft = relCenter < windowStart;
            const isRight = relCenter > windowEnd;

            this._updateMarkerVisibility(marker, isLeft, isRight);
        });

        this.resolveCollisions();
    }

    private _updateMarkerVisibility(
        marker: typeof this._managedMarkers[number],
        isLeft: boolean,
        isRight: boolean
    ): void {
        const isOffscreen = isLeft || isRight;

        marker.notch.style.opacity = isOffscreen ? "0" : "1";
        marker.anchor.style.opacity = isOffscreen ? "0" : "1";
        marker.caretLeft.style.opacity = isLeft ? "1" : "0";
        marker.caretRight.style.opacity = isRight ? "1" : "0";
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
        const targetRU: number = this._config.targetRU ?? 0;
        const achievedRU: number | undefined = this._config.scrollAnchorRU ?? this._config.achievedRU;
        const expectedRU: number | undefined = this._config.expectedRU;
        const windowSize: number = this._config.rangeWindow ?? 7.5;

        // Determine highscore (best progress point)
        const scores: number[] = [];
        if (achievedRU !== undefined) scores.push(achievedRU);

        // Include actual achieved too
        if (this._config.achievedRU !== undefined) {
            scores.push(this._config.achievedRU);
        }

        if (expectedRU !== undefined && expectedRU !== null) scores.push(expectedRU);
        if (this._config.attemptsRU) scores.push(...this._config.attemptsRU);

        const highscore: number | null = scores.length > 0 ? Math.max(...scores) : null;

        let minRU: number;

        if (highscore === null) {
            // Case 1: If there is only the target labelled notch, center it.
            minRU = targetRU - 0.5 * windowSize;
        } else if (highscore - targetRU <= 0.6 * windowSize) {
            // Case 2: If the target labelled notch and highscore both fit in the Window (60%), 
            // make them symmetrical about the horizontal center.
            const center = (targetRU + highscore) / 2;
            minRU = center - 0.5 * windowSize;
        } else {
            // Case 3: If they do not fit within the view (Window):
            const highscoreAt80 = highscore - 0.8 * windowSize;

            if (achievedRU === undefined) {
                // If only the highest score is present, align it to the right edge of the Window.
                minRU = highscoreAt80;
            } else {
                // If the achieved labelled notch is present, center it OR align the highest 
                // score to the right edge of the Window, whichever is the leftmost scroll position.
                // Leftmost scroll position = smallest minRU.
                const achievedCentered = achievedRU - 0.5 * windowSize;
                minRU = Math.min(achievedCentered, highscoreAt80);
            }
        }

        return { minRU, maxRU: minRU + windowSize };
    }

}
