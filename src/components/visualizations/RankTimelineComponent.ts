import { VisualSettings } from "../../services/VisualSettingsService";
import { RankScaleMapper } from "./RankScaleMapper";

export interface RankTimelineConfiguration {
    readonly thresholds: Record<string, number>;
    readonly settings: VisualSettings;
    readonly targetRU?: number;
    readonly achievedRU?: number;
    // How many RUs to show. Default to 3.5
    readonly rangeWindow?: number;
}

/**
 * Visualizes the rank progression timeline.
 */
export class RankTimelineComponent {
    private readonly _container: HTMLElement;
    private _config: RankTimelineConfiguration;
    private _mapper: RankScaleMapper;

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

        // Create track for masked content (axis, ticks, labels)
        const track = document.createElement("div");
        track.className = "timeline-track";
        this._container.appendChild(track);

        const { minRU, maxRU } = this._calculateViewBounds();
        const ruRange = maxRU - minRU;

        this._renderAxis(track);
        this._renderTicks(track, minRU, maxRU, ruRange);
        this._renderMarkers(minRU, ruRange, track);

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

        // Offscreen Target Logic ( Target is to the left )
        // "Pulled" towards center if < 25%
        let targetIsOffscreen = false;
        if (targetRU !== undefined) {
            const tPct = ((targetRU - minRU) / range) * 100;
            if (tPct < 25) {
                targetIsOffscreen = true;
            }
        }

        if (targetIsOffscreen) {
            this._renderOffscreenTarget();
            if (achievedRU !== undefined) {
                const aPct = ((achievedRU - minRU) / range) * 100;
                this._renderMarker(track, aPct, "Achieved", "achieved");
            }

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
        const text = document.createElement("div");
        text.className = `timeline-marker-label label-target offscreen`;
        text.innerText = "TARGET";
        text.style.left = `${leftPercent}%`;
        this._container.appendChild(text);
    }

    private _renderOverlappingMarkers(
        parent: HTMLElement,
        bounds: { min: number; range: number },
        target: number,
        achieved: number
    ): void {
        const tPct = ((target - bounds.min) / bounds.range) * 100;
        const aPct = ((achieved - bounds.min) / bounds.range) * 100;

        // Minimum separation in percentage (approx 30% for clean label separation)
        const minSep = 30;
        const diff = Math.abs(tPct - aPct);

        let finalTPct = tPct;
        let finalAPct = aPct;

        if (diff < minSep) {
            const center = (tPct + aPct) / 2;
            const offset = minSep / 2;

            // If exactly equal, default target left, achieved right (or vice versa)
            // If not equal, push further in current direction
            if (tPct <= aPct) {
                finalTPct = center - offset;
                finalAPct = center + offset;
            } else {
                finalTPct = center + offset;
                finalAPct = center - offset;
            }
        }

        this._renderMarker(parent, finalAPct, "Achieved", "achieved");
        this._renderMarker(parent, finalTPct, "Target", "target");
    }

    private _renderSingleMarkers(
        parent: HTMLElement,
        bounds: { min: number; range: number },
        target?: number,
        achieved?: number
    ): void {
        if (achieved !== undefined) {
            const aPct = ((achieved - bounds.min) / bounds.range) * 100;
            this._renderMarker(parent, aPct, "Achieved", "achieved");
        }
        if (target !== undefined && target !== null) {
            const tPct = ((target - bounds.min) / bounds.range) * 100;
            this._renderMarker(parent, tPct, "Target", "target");
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
        tick.style.left = `${leftPercent}%`;
        parent.appendChild(tick);

        const text = document.createElement("div");
        text.className = "timeline-tick-label";
        text.innerText = label;
        text.style.left = `${leftPercent}%`;
        parent.appendChild(text);
    }

    private _renderMarker(
        parent: HTMLElement,
        leftPercent: number,
        label: string,
        type: "achieved" | "target"
    ): void {
        const marker = document.createElement("div");
        marker.className = `timeline-marker marker-${type}`;
        marker.style.left = `${leftPercent}%`;
        parent.appendChild(marker);

        const text = document.createElement("div");
        text.className = `timeline-marker-label label-${type}`;
        text.innerText = label.toUpperCase();
        text.style.left = `${leftPercent}%`;
        parent.appendChild(text);
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
}
