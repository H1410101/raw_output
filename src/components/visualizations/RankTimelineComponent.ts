import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";

export interface RankTimelineConfiguration {
    readonly thresholds: Record<string, number>;
    readonly settings: VisualSettings;
    readonly targetRU?: number;
    readonly achievedRU?: number;
    readonly attemptsRU?: number[];
    // How many RUs to show. Default to 3.5
    readonly rangeWindow?: number;
    readonly expectedRU?: number;
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
    private _config: RankTimelineConfiguration;
    private _mapper: RankScaleMapper;

    private _targetAnchor: HTMLElement | null = null;
    private _achievedAnchor: HTMLElement | null = null;
    private _targetLabel: HTMLElement | null = null;
    private _achievedLabel: HTMLElement | null = null;

    /**
     * Initializes the timeline.
     * @param config - The initial configuration.
     */
    public constructor(config: RankTimelineConfiguration) {
        this._config = config;
        this._container = document.createElement("div");
        this._container.className = "rank-timeline-container";

        const thresholdValues = Object.values(config.thresholds).sort((a, b) => a - b);
        // Standard interval
        this._mapper = new RankScaleMapper(thresholdValues, 100);
    }

    /**
     * Updates the timeline configuration.
     * @param config - The new configuration.
     */
    public update(config: RankTimelineConfiguration): void {
        this._config = config;

        const thresholdValues = Object.values(config.thresholds).sort((a, b) => a - b);
        this._mapper = new RankScaleMapper(thresholdValues, 100);

        this.render();
    }

    /**
     * Renders the component.
     * @returns The container element.
     */
    public render(): HTMLElement {
        this._container.innerHTML = "";
        this._targetAnchor = null;
        this._achievedAnchor = null;
        this._targetLabel = null;
        this._achievedLabel = null;

        // Create track for masked content (axis, ticks, labels)
        const track = document.createElement("div");
        track.className = "timeline-track";
        this._container.appendChild(track);

        const { minRU, maxRU } = this._calculateViewBounds();
        const ruRange = maxRU - minRU;

        this._renderAxis(track);
        this._renderTicks(track, minRU, maxRU, ruRange);
        this._renderAttempts(track, minRU, ruRange);
        this._renderMarkers(minRU, ruRange, track);
        this._renderProgressLine(track, minRU, ruRange);

        return this._container;
    }

    private _renderAxis(parent: HTMLElement): void {
        const axis = document.createElement("div");
        axis.className = "timeline-axis";
        parent.appendChild(axis);
    }

    private _renderTicks(parent: HTMLElement, minRU: number, maxRU: number, range: number): void {
        const startRU = Math.ceil(minRU - 0.5);
        const endRU = Math.floor(maxRU + 0.5);

        const rankNames = Object.keys(this._config.thresholds).sort(
            (a, b) => this._config.thresholds[a] - this._config.thresholds[b]
        );

        const bounds = { min: minRU, range };

        for (let i = startRU; i <= endRU; i++) {
            const matchingRank = rankNames.find((name: string) => {
                const score = this._config.thresholds[name];
                const rankUnit = this._mapper.calculateRankUnit(score);

                // Float tolerance
                return Math.abs(rankUnit - i) < 0.001;
            });

            this._renderRankTick(parent, i, matchingRank || "", bounds);
        }
    }

    private _renderMarkers(minRU: number, range: number, track: HTMLElement): void {
        const targetRU = this._config.targetRU;
        const achievedRU = this._config.achievedRU;

        if (this._isTargetOffscreen(minRU, range)) {
            this._renderOffscreenTarget();
            this._renderAchievedInOffscreenMode(track, minRU, range);

            return;
        }

        const bounds = { min: minRU, range: range };

        if (targetRU !== undefined && targetRU !== null && achievedRU !== undefined) {
            this._renderOverlappingMarkers(track, bounds, targetRU, achievedRU);
        } else {
            this._renderSingleMarkers(track, bounds, targetRU, achievedRU);
        }
    }

    private _renderOffscreenTarget(): void {
        const leftPercent = 25;
        // Snapped to 25% (mid-fade)

        // Render Caret (replacing notch) - Goes to main container (unmasked)
        const caret = document.createElement("div");
        caret.className = "timeline-caret offscreen";
        caret.style.left = `${leftPercent}%`;
        this._container.appendChild(caret);

        // Render Label - Goes to main container (unmasked)
        const anchor = document.createElement("div");
        anchor.className = "timeline-marker-anchor anchor-target offscreen";
        anchor.style.left = `${leftPercent}%`;
        this._container.appendChild(anchor);

        const text = document.createElement("div");
        text.className = `timeline-marker-label label-target offscreen`;
        text.innerText = "TARGET";
        anchor.appendChild(text);

        this._targetAnchor = anchor;
        this._targetLabel = text;
    }

    private _renderOverlappingMarkers(
        parent: HTMLElement,
        bounds: { min: number; range: number },
        target: number,
        achieved: number
    ): void {
        const tPct = ((target - bounds.min) / bounds.range) * 100;
        const aPct = ((achieved - bounds.min) / bounds.range) * 100;

        this._renderMarker({
            parent,
            notchPercent: aPct,
            labelPercent: aPct,
            label: "Achieved",
            type: "achieved"
        });
        this._renderMarker({
            parent,
            notchPercent: tPct,
            labelPercent: tPct,
            label: "Target",
            type: "target"
        });
    }

    private _renderSingleMarkers(
        parent: HTMLElement,
        bounds: { min: number; range: number },
        target?: number,
        achieved?: number
    ): void {
        if (achieved !== undefined) {
            const aPct = ((achieved - bounds.min) / bounds.range) * 100;
            this._renderMarker({
                parent,
                notchPercent: aPct,
                labelPercent: aPct,
                label: "Achieved",
                type: "achieved"
            });
        }
        if (target !== undefined && target !== null) {
            const tPct = ((target - bounds.min) / bounds.range) * 100;
            this._renderMarker({
                parent,
                notchPercent: tPct,
                labelPercent: tPct,
                label: "Target",
                type: "target"
            });
        }
    }

    private _renderRankTick(
        parent: HTMLElement,
        rankUnit: number,
        label: string,
        bounds: { min: number; range: number }
    ): void {
        const leftPercent = ((rankUnit - bounds.min) / bounds.range) * 100;

        const tick = document.createElement("div");
        tick.className = "timeline-tick";
        if (!label) {
            tick.classList.add("minor");
        }
        tick.style.left = `${leftPercent}%`;
        parent.appendChild(tick);

        const text = document.createElement("div");
        text.className = "timeline-tick-label";
        text.innerText = label;
        text.style.left = `${leftPercent}%`;
        parent.appendChild(text);
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

    /**
     * Resolves collisions between the Target and Achieved markers.
     * This must be called after the component is added to the DOM.
     */
    public resolveCollisions(): void {
        const hasRequiredElements = this._targetAnchor && this._achievedAnchor &&
            this._targetLabel && this._achievedLabel;
        if (!hasRequiredElements) return;

        const targetRect: DOMRect = this._targetAnchor!.getBoundingClientRect();
        const achievedRect: DOMRect = this._achievedAnchor!.getBoundingClientRect();

        const buffer: number = this._getCollisionBuffer();
        if (!this._detectOverlap(targetRect, achievedRect, buffer)) return;

        const { finalTargetCenter, finalAchievedCenter, currentTargetCenter, currentAchievedCenter } =
            this._calculateResolutionPositions(targetRect, achievedRect);

        this._targetLabel!.style.transform = `translateX(${finalTargetCenter - currentTargetCenter}px)`;
        this._achievedLabel!.style.transform = `translateX(${finalAchievedCenter - currentAchievedCenter}px)`;
    }

    private _getCollisionBuffer(): number {
        const rootFontSize: number = parseFloat(getComputedStyle(document.documentElement).fontSize);

        return 0.5 * rootFontSize;
    }

    private _detectOverlap(targetRect: DOMRect, achievedRect: DOMRect, buffer: number): boolean {
        return targetRect.left < achievedRect.right + buffer &&
            targetRect.right > achievedRect.left - buffer;
    }

    private _calculateResolutionPositions(
        targetRect: DOMRect,
        achievedRect: DOMRect
    ): {
        finalTargetCenter: number,
        finalAchievedCenter: number,
        currentTargetCenter: number,
        currentAchievedCenter: number
    } {
        const currentTargetCenter = targetRect.left + (targetRect.width / 2);
        const currentAchievedCenter = achievedRect.left + (achievedRect.width / 2);

        let finalTargetCenter: number;
        let finalAchievedCenter: number;

        if (currentTargetCenter <= currentAchievedCenter) {
            // Target is on the left: attach its right edge to its notch (half width displacement)
            finalTargetCenter = currentTargetCenter - (targetRect.width / 2);
            // Achieved is on the right: attach its left edge to its notch (half width displacement)
            finalAchievedCenter = currentAchievedCenter + (achievedRect.width / 2);
        } else {
            // Achieved is on the left: attach its right edge to its notch (half width displacement)
            finalAchievedCenter = currentAchievedCenter - (achievedRect.width / 2);
            // Target is on the right: attach its left edge to its notch (half width displacement)
            finalTargetCenter = currentTargetCenter + (targetRect.width / 2);
        }

        return { finalTargetCenter, finalAchievedCenter, currentTargetCenter, currentAchievedCenter };
    }

    private _isTargetOffscreen(minRU: number, range: number): boolean {
        const targetRU = this._config.targetRU;
        if (targetRU === undefined) return false;

        const tPct = ((targetRU - minRU) / range) * 100;

        return tPct < 25;
    }

    private _renderAchievedInOffscreenMode(
        track: HTMLElement,
        minRU: number,
        range: number
    ): void {
        const achievedRU = this._config.achievedRU;
        if (achievedRU === undefined) return;

        const aPct = ((achievedRU - minRU) / range) * 100;
        this._renderMarker({
            parent: track,
            notchPercent: aPct,
            labelPercent: aPct,
            label: "Achieved",
            type: "achieved"
        });
    }

    private _renderAttempts(parent: HTMLElement, minRU: number, range: number): void {
        const attempts = this._config.attemptsRU;
        if (!attempts || attempts.length === 0) return;

        const opacity = (this._config.settings.dotOpacity ?? 40) / 100;

        // Find the score threshold for the top 3 runs
        const sorted = [...attempts].sort((a, b) => b - a);
        const top3Threshold = sorted.length >= 3 ? sorted[2] : (sorted[sorted.length - 1] ?? -Infinity);

        attempts.forEach(rankUnit => {
            const leftPercent = ((rankUnit - minRU) / range) * 100;
            if (leftPercent < 0 || leftPercent > 100) return;

            const isTop3 = rankUnit >= top3Threshold;
            this._renderAttemptNotch(parent, leftPercent, isTop3, opacity);
        });
    }

    private _renderAttemptNotch(parent: HTMLElement, percent: number, isTop3: boolean, opacity: number): void {
        const notch = document.createElement("div");
        notch.className = "timeline-marker marker-attempt";

        if (!isTop3) {
            notch.classList.add("secondary");
        }

        notch.style.left = `${percent}%`;
        notch.style.opacity = opacity.toString();
        parent.appendChild(notch);
    }

    private _calculateViewBounds(): { minRU: number; maxRU: number } {
        const target = this._config.targetRU ?? 0;
        const achieved = this._config.achievedRU;

        let center = target;
        if (achieved !== undefined) {
            center = (target + achieved) / 2;
        }
        // Show 7.5 ranks as requested (3 ranks fit in 40% of screen)
        const windowSize = this._config.rangeWindow ?? 7.5;

        // Default layout: centered
        let minRU = center - (windowSize / 2);

        // Clamp logic: If achieved goes past 70% of the view, freeze it there.
        // We want (achieved - minRU) / windowSize <= 0.7
        // => achieved - minRU <= 0.7 * windowSize
        // => minRU >= achieved - 0.7 * windowSize
        if (achieved !== undefined) {
            const constraint = achieved - (0.7 * windowSize);

            if (minRU < constraint) {
                minRU = constraint;
            }
        }

        return {
            minRU: minRU,
            maxRU: minRU + windowSize
        };
    }

    private _renderExpectedNotch(parent: HTMLElement, minRU: number, range: number): void {
        const expectedRU = this._config.expectedRU;
        if (expectedRU === undefined || expectedRU === null) {
            return;
        }

        const leftPercent = ((expectedRU - minRU) / range) * 100;
        if (leftPercent < 0 || leftPercent > 100) {
            return;
        }

        const notch = document.createElement("div");
        notch.className = "timeline-marker marker-expected";
        notch.style.left = `${leftPercent}%`;
        parent.appendChild(notch);
    }

    private _renderProgressLine(parent: HTMLElement, minRU: number, range: number): void {
        const targetRU = this._config.targetRU;
        const expectedRU = this._config.expectedRU;

        if (targetRU === undefined || targetRU === null || expectedRU === undefined || expectedRU === null) {
            return;
        }

        const tPct = ((targetRU - minRU) / range) * 100;
        const ePct = ((expectedRU - minRU) / range) * 100;

        const left = Math.min(tPct, ePct);
        const right = Math.max(tPct, ePct);
        const width = right - left;

        if (right < 0 || left > 100 || width <= 0.001) {
            return;
        }

        const line = document.createElement("div");
        line.className = "timeline-progress-line";
        line.style.left = `${left}%`;
        line.style.width = `${width}%`;
        parent.appendChild(line);
    }
}
