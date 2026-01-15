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
        this._renderAxis();

        const { minRU, maxRU } = this._calculateViewBounds();
        const ruRange = maxRU - minRU;

        this._renderTicks(minRU, maxRU, ruRange);
        this._renderMarkers(minRU, ruRange);

        return this._container;
    }

    private _renderAxis(): void {
        const axis = document.createElement("div");
        axis.className = "timeline-axis";
        this._container.appendChild(axis);
    }

    private _renderTicks(minRU: number, maxRU: number, range: number): void {
        const startRU = Math.ceil(minRU - 0.5);
        const endRU = Math.floor(maxRU + 0.5);

        const rankNames = Object.keys(this._config.thresholds).sort(
            (a, b) => this._config.thresholds[a] - this._config.thresholds[b]
        );

        for (let i = startRU; i <= endRU; i++) {
            const matchingRank = rankNames.find((name: string) => {
                const score = this._config.thresholds[name];
                const rankUnit = this._mapper.calculateRankUnit(score);

                // Float tolerance
                return Math.abs(rankUnit - i) < 0.001;
            });

            this._renderRankTick(i, matchingRank || "", minRU, range);
        }
    }

    private _renderMarkers(minRU: number, range: number): void {
        const targetRU = this._config.targetRU;
        const achievedRU = this._config.achievedRU;

        if (targetRU !== undefined && targetRU !== null && achievedRU !== undefined) {
            this._renderOverlappingMarkers(minRU, range, targetRU, achievedRU);
        } else {
            this._renderSingleMarkers(minRU, range, targetRU, achievedRU);
        }
    }

    private _renderOverlappingMarkers(
        minRU: number,
        range: number,
        target: number,
        achieved: number
    ): void {
        const tPct = ((target - minRU) / range) * 100;
        const aPct = ((achieved - minRU) / range) * 100;

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

        this._renderMarker(finalAPct, "Achieved", "achieved");
        this._renderMarker(finalTPct, "Target", "target");
    }

    private _renderSingleMarkers(
        minRU: number,
        range: number,
        target?: number,
        achieved?: number
    ): void {
        if (achieved !== undefined) {
            const aPct = ((achieved - minRU) / range) * 100;
            this._renderMarker(aPct, "Achieved", "achieved");
        }
        if (target !== undefined && target !== null) {
            const tPct = ((target - minRU) / range) * 100;
            this._renderMarker(tPct, "Target", "target");
        }
    }

    private _renderRankTick(rankUnit: number, label: string, minRU: number, range: number): void {
        const leftPercent = ((rankUnit - minRU) / range) * 100;

        const tick = document.createElement("div");
        tick.className = "timeline-tick";
        tick.style.left = `${leftPercent}%`;
        this._container.appendChild(tick);

        const text = document.createElement("div");
        text.className = "timeline-tick-label";
        text.innerText = label;
        text.style.left = `${leftPercent}%`;
        this._container.appendChild(text);
    }

    private _renderMarker(
        leftPercent: number,
        label: string,
        type: "achieved" | "target"
    ): void {


        const marker = document.createElement("div");
        marker.className = `timeline-marker marker-${type}`;
        marker.style.left = `${leftPercent}%`;
        this._container.appendChild(marker);

        const text = document.createElement("div");
        text.className = `timeline-marker-label label-${type}`;

        // "TARGET", "ACHIEVED"
        text.innerText = label.toUpperCase();
        text.style.left = `${leftPercent}%`;
        this._container.appendChild(text);
    }

    private _calculateViewBounds(): { minRU: number; maxRU: number } {
        const target = this._config.targetRU ?? 0;
        const achieved = this._config.achievedRU;

        let center = target;
        if (achieved !== undefined) {
            center = (target + achieved) / 2;
        }
        // Show ~3.5 ranks
        const windowSize = this._config.rangeWindow ?? 3.5;

        return {
            minRU: center - (windowSize / 2),
            maxRU: center + (windowSize / 2)
        };
    }
}
