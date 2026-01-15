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

        const axis = document.createElement("div");
        axis.className = "timeline-axis";
        this._container.appendChild(axis);

        const { minRU, maxRU } = this._calculateViewBounds();
        const ruRange = maxRU - minRU;

        // Iterate through all integer RUs visible in the window
        const startRU = Math.ceil(minRU - 0.5);
        const endRU = Math.floor(maxRU + 0.5);

        // Defined these outside the loop to be accessible inside.
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

            this._renderRankTick(i, matchingRank || "", minRU, ruRange);
        }

        // Render Achieved (Upward)
        if (this._config.achievedRU !== undefined) {
            this._renderMarker(this._config.achievedRU, "Achieved", "achieved", { minRU, range: ruRange });
        }

        // Render Target (Upward)
        // Check if defined, even if 0
        if (this._config.targetRU !== undefined && this._config.targetRU !== null) {
            this._renderMarker(this._config.targetRU, "Target", "target", { minRU, range: ruRange });
        }

        return this._container;
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
        rankUnit: number,
        label: string,
        type: "achieved" | "target",
        viewBounds: { minRU: number; range: number }
    ): void {
        const leftPercent = ((rankUnit - viewBounds.minRU) / viewBounds.range) * 100;

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
