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
    readonly prevSessionRU?: number;
    readonly prevSessionLabel?: string;
}

interface DiscreteLayoutContext {
    readonly rects: DOMRect[];
    readonly anchors: number[];
    readonly buffer: number;
    readonly bounds: DOMRect;
    readonly result: {
        best: number[] | null;
        minShift: number;
    };
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



    private _isInitialized: boolean = false;
    private _hasPreviousProgress: boolean = false;
    private _pendingScrollOffset: number | null = null;
    private _pendingMinRU: number | null = null;
    private _currentMinRU: number = 0;

    private _managedMarkers: {
        rankUnit: number;
        type: "target" | "achieved" | "expected" | "prev";
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
        this._prepareRenderingComponents();

        const { minRU } = this._calculateViewBounds();
        const windowSize = this._config.rangeWindow ?? 7.5;

        this._renderContentLayers();
        this._renderProgressLine({ immediate, paused, viewportMinRU: minRU });

        this._applyScroll(minRU, windowSize, immediate, paused);
        this._finalizeRenderSync(immediate, paused);

        return this._container;
    }

    private _prepareRenderingComponents(): void {
        this._clearLayerContents();
        this._removeStaleAnchors();
        this._resetMarkerState();
    }

    private _clearLayerContents(): void {
        this._ticksLayer.innerHTML = "";
        this._attemptsLayer.innerHTML = "";
        this._markersLayer.innerHTML = "";
    }

    private _removeStaleAnchors(): void {
        const anchors = this._container.querySelectorAll(".timeline-marker-anchor.offscreen");
        anchors.forEach(anchor => anchor.remove());
    }

    private _resetMarkerState(): void {
        this._isInitialized = false;
    }

    private _renderContentLayers(): void {
        this._renderTicks();
        this._renderAttempts();
        this._renderMarkers();
    }

    private _finalizeRenderSync(immediate: boolean, paused: boolean): void {
        this._isInitialized = true;
        if (!immediate && !paused) {
            this._startMarkerSync();
        } else {
            this._syncMarkers();
        }
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
        if (this._config.prevSessionRU !== undefined) {
            this._setupManagedMarker(this._config.prevSessionRU, this._config.prevSessionLabel || "Prev Session", "prev");
        }
        if (expectedRU !== undefined && expectedRU !== null && expectedRU > (achievedRU ?? -Infinity)) {
            this._setupManagedMarker(expectedRU, "", "expected");
        }
    }

    private _setupManagedMarker(rankUnit: number, label: string, type: "target" | "achieved" | "expected" | "prev"): void {
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

        this._trackLabelAnchors();
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

    private _trackLabelAnchors(): void {
        // Reserved for potential use
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
        const markers = this._managedMarkers.filter(marker =>
            marker.label && marker.labelElement && marker.anchor.style.opacity !== "0"
        );
        if (markers.length < 2) return;

        this._resetMarkerLabels(markers);
        const buffer = 0.5 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        const sorted = [...markers].sort((markerA, markerB) => markerA.rankUnit - markerB.rankUnit);

        const clusters = this._findCollisionClusters(sorted, buffer);
        clusters.forEach(cluster => this._resolveClusterLayout(cluster, buffer));
    }

    private _resetMarkerLabels(markers: typeof this._managedMarkers): void {
        markers.forEach(marker => {
            marker.labelElement!.style.transform = "";
            marker.labelElement!.style.opacity = "1";
        });
    }

    private _findCollisionClusters(markers: typeof this._managedMarkers, buffer: number): (typeof this._managedMarkers)[] {
        if (markers.length === 0) return [];
        const clusters: (typeof this._managedMarkers)[] = [[markers[0]]];

        for (let i = 1; i < markers.length; i++) {
            const current = markers[i];
            const prevCluster = clusters[clusters.length - 1];
            const lastInPrev = prevCluster[prevCluster.length - 1];

            const anchorA = lastInPrev.anchor.getBoundingClientRect().left;
            const anchorB = current.anchor.getBoundingClientRect().left;
            const widthA = lastInPrev.labelElement!.offsetWidth;
            const widthB = current.labelElement!.offsetWidth;

            // Clustering based on "Potential Footprint":
            // Distance between anchors must be >= sum of widths (max possible span) + buffer
            if (anchorB - anchorA < widthA + widthB + buffer) {
                prevCluster.push(current);
            } else {
                clusters.push([current]);
            }
        }

        return clusters;
    }

    private _resolveClusterLayout(cluster: typeof this._managedMarkers, buffer: number): void {
        const success = this._applyDiscreteLayout(cluster, buffer);
        if (success) return;

        const prevMarker = cluster.find(marker => marker.type === "prev");
        if (prevMarker) {
            prevMarker.labelElement!.style.opacity = "0";
            prevMarker.labelElement!.style.transform = "";

            const remaining = cluster.filter(marker => marker !== prevMarker);
            // Re-resolve for core markers only
            this._applyDiscreteLayout(remaining, buffer);
        } else {
            // Fallback for core markers if they can't fit discretely (rare)
            // We use simple progressive push to ensure they don't overlap, even if 'undefined'
            this._applyProgressivePush(cluster, buffer);
        }
    }

    private _applyDiscreteLayout(markers: typeof this._managedMarkers, buffer: number): boolean {
        if (markers.length === 0) return true;

        const rects = markers.map(marker => marker.labelElement!.getBoundingClientRect());
        const anchors = markers.map(marker => marker.anchor.getBoundingClientRect().left);
        const containerRect = this._container.getBoundingClientRect();

        const bestShifts = this._findBestDiscreteShifts(rects, anchors, buffer, containerRect);
        if (bestShifts) {
            markers.forEach((marker, i) => {
                marker.labelElement!.style.transform = `translateX(${bestShifts[i]}px)`;
            });

            return true;
        }

        return false;
    }

    private _findBestDiscreteShifts(rects: DOMRect[], anchors: number[], buffer: number, bounds: DOMRect): number[] | null {
        const context: DiscreteLayoutContext = {
            rects,
            anchors,
            buffer,
            bounds,
            result: { best: null, minShift: Infinity }
        };

        this._searchDiscrete(0, [], context);

        return context.result.best;
    }

    private _searchDiscrete(index: number, shifts: number[], context: DiscreteLayoutContext): void {
        const { rects } = context;

        if (index === rects.length) {
            this._evaluateDiscreteLayout(shifts, context);

            return;
        }

        [0, -1, 1].forEach(direction => {
            const shiftValue = direction * (rects[index].width / 2);

            shifts.push(shiftValue);
            this._searchDiscrete(index + 1, shifts, context);
            shifts.pop();
        });
    }

    private _evaluateDiscreteLayout(shifts: number[], context: DiscreteLayoutContext): void {
        if (!this._isValidDiscreteLayout(shifts, context)) return;

        const { result } = context;
        const total = shifts.reduce((sum, shift) => sum + Math.abs(shift), 0);

        if (total < result.minShift) {
            result.minShift = total;
            result.best = [...shifts];
        }
    }

    private _isValidDiscreteLayout(shifts: number[], context: DiscreteLayoutContext): boolean {
        const { rects, anchors, buffer, bounds } = context;

        for (let i = 0; i < shifts.length; i++) {
            const leftI = anchors[i] + shifts[i] - rects[i].width / 2;
            const rightI = anchors[i] + shifts[i] + rects[i].width / 2;

            if (leftI < bounds.left || rightI > bounds.right) return false;

            for (let j = i + 1; j < shifts.length; j++) {
                const leftJ = anchors[j] + shifts[j] - rects[j].width / 2;

                if (rightI + buffer > leftJ) return false;
            }
        }

        return true;
    }

    private _applyProgressivePush(markers: typeof this._managedMarkers, buffer: number): void {
        for (let i = 1; i < markers.length; i++) {
            const current = markers[i];
            const prev = markers[i - 1];
            const currentRect = current.labelElement!.getBoundingClientRect();
            const prevRect = prev.labelElement!.getBoundingClientRect();

            if (currentRect.left < prevRect.right + buffer) {
                const overlap = (prevRect.right + buffer) - currentRect.left;
                current.labelElement!.style.transform = `translateX(${overlap}px)`;
            }
        }
    }
    private _calculateViewBounds(): { minRU: number; maxRU: number } {
        const targetRU: number = this._config.targetRU ?? 0;
        const achievedRU: number | undefined = this._config.scrollAnchorRU ?? this._config.achievedRU;
        const windowSize: number = this._config.rangeWindow ?? 7.5;

        const highscore = this._getHighscore();
        let minRU: number;

        if (highscore === null) {
            minRU = targetRU - 0.5 * windowSize;
        } else if (highscore - targetRU <= 0.6 * windowSize) {
            const center = (targetRU + highscore) / 2;
            minRU = center - 0.5 * windowSize;
        } else {
            minRU = this._calculateLargeOffsetMinRU(highscore, achievedRU, windowSize);
        }

        return { minRU, maxRU: minRU + windowSize };
    }

    private _getHighscore(): number | null {
        const scores: number[] = [];
        if (this._config.scrollAnchorRU !== undefined) scores.push(this._config.scrollAnchorRU);
        if (this._config.achievedRU !== undefined) scores.push(this._config.achievedRU);
        if (this._config.prevSessionRU !== undefined) scores.push(this._config.prevSessionRU);
        if (this._config.expectedRU !== undefined) scores.push(this._config.expectedRU);
        if (this._config.attemptsRU) scores.push(...this._config.attemptsRU);

        return scores.length > 0 ? Math.max(...scores) : null;
    }

    private _calculateLargeOffsetMinRU(highscore: number, achievedRU: number | undefined, windowSize: number): number {
        const highscoreAt80 = highscore - 0.8 * windowSize;

        if (achievedRU === undefined) {
            return highscoreAt80;
        }

        const achievedCentered = achievedRU - 0.5 * windowSize;

        return Math.min(achievedCentered, highscoreAt80);
    }

}
