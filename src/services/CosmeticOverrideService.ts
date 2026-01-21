import { AppStateService } from "./AppStateService";
import { DifficultyTier } from "../data/benchmarks";
import { BenchmarkService } from "./BenchmarkService";
import { EstimatedRank } from "./RankEstimator";
import { RankResult } from "./RankService";

/**
 * Service to manage temporary, purely cosmetic rank overrides.
 * This is used for the "BE BETTER" feature in the peak warning popup.
 */
export class CosmeticOverrideService {
    private _isBeBetterActive: boolean = false;
    private _activeDifficulty: DifficultyTier | null = null;
    private readonly _appStateService: AppStateService;
    private readonly _benchmarkService: BenchmarkService;
    private readonly _onStateChanged: (() => void)[] = [];

    /**
     * Initializes the service and sets up auto-reset listeners.
     *
     * @param appStateService - Service for accessing application state.
     * @param benchmarkService - Service for accessing benchmark definitions.
     */
    public constructor(appStateService: AppStateService, benchmarkService: BenchmarkService) {
        this._appStateService = appStateService;
        this._benchmarkService = benchmarkService;

        this._setupAutoResets();
    }

    /**
     * Activates the "BE BETTER" cosmetic override for the current difficulty.
     */
    public activate(): void {
        this._isBeBetterActive = true;
        this._activeDifficulty = this._appStateService.getBenchmarkDifficulty();
        this._notifyListeners();
    }

    /**
     * Deactivates the override.
     */
    public deactivate(): void {
        this._isBeBetterActive = false;
        this._activeDifficulty = null;
        this._notifyListeners();
    }

    /**
     * Checks if the "BE BETTER" override is active for a specific difficulty.
     *
     * @param difficulty - The difficulty tier to check.
     * @returns True if the override is active for the given difficulty.
     */
    public isActiveFor(difficulty: DifficultyTier): boolean {
        return this._isBeBetterActive && this._activeDifficulty === difficulty;
    }

    /**
     * Gets the fake "Top Rank + 999%" EstimatedRank for a difficulty.
     *
     * @param difficulty - The difficulty tier to get the fake rank for.
     * @returns A fake top-tier EstimatedRank descriptor.
     */
    public getFakeEstimatedRank(difficulty: DifficultyTier): EstimatedRank {
        const rankNames = this._benchmarkService.getRankNames(difficulty);
        const topRank = rankNames[rankNames.length - 1] || "Unranked";

        return {
            rankName: topRank,
            color: "var(--rank-color-default)",
            progressToNext: 999,
            continuousValue: rankNames.length + 9.99,
        };
    }

    /**
     * Gets the fake "Top Rank + 999%" RankResult for a difficulty.
     *
     * @param difficulty - The difficulty tier to get the fake rank for.
     * @returns A fake top-tier RankResult descriptor.
     */
    public getFakeRankResult(difficulty: DifficultyTier): RankResult {
        const rankNames = this._benchmarkService.getRankNames(difficulty);
        const topRank = rankNames[rankNames.length - 1] || "Unranked";

        return {
            currentRank: topRank,
            nextRank: null,
            progressPercentage: 999,
            rankLevel: rankNames.length,
        };
    }

    /**
     * Subscribes to activation/deactivation events.
     *
     * @param callback - The function to call when the state changes.
     */
    public onStateChanged(callback: () => void): void {
        this._onStateChanged.push(callback);
    }

    private _setupAutoResets(): void {
        this._appStateService.onDifficultyChanged(() => this.deactivate());
        this._appStateService.onTabChanged(() => this.deactivate());
    }

    private _notifyListeners(): void {
        this._onStateChanged.forEach(callback => callback());
    }
}
