import { BenchmarkScenario } from "../data/benchmarks";
import { RankService, RankResult } from "./RankService";
import { BenchmarkService } from "./BenchmarkService";

export interface EstimatedRank {
    readonly rankName: string;
    readonly progressToNext: number;
    readonly continuousValue: number;
}

/**
 * Represents the persistent identity for a specific scenario.
 */
export interface ScenarioIdentity {
    readonly continuousValue: number;
    readonly highestAchieved: number;
    readonly lastUpdated: string;
}

/**
 * Represents the holistic identity across all scenarios.
 */
export type RankIdentityMap = Record<string, ScenarioIdentity>;

/**
 * Service for calculating holistic rank estimates and evolving per-scenario identities.
 */
export class RankEstimator {
    private static readonly _identityKey: string = "rank_identity_state_v2";
    private readonly _rankService: RankService;
    private readonly _benchmarkService: BenchmarkService;

    /**
     * Initializes the estimator.
     *
     * @param rankService - Service for individual rank calculations.
     * @param benchmarkService - Service for accessing benchmark definitions.
     */
    public constructor(
        rankService: RankService,
        benchmarkService: BenchmarkService,
    ) {
        this._rankService = rankService;
        this._benchmarkService = benchmarkService;
    }

    /**
     * Retrieves the current persistent identity map.
     *
     * @returns The full identity map from storage.
     */
    public getIdentityMap(): RankIdentityMap {
        const raw: string | null = localStorage.getItem(RankEstimator._identityKey);

        if (raw) {
            try {
                return JSON.parse(raw) as RankIdentityMap;
            } catch {
                // Return default on error
            }
        }

        return {};
    }

    /**
     * Retrieves the identity for a specific scenario.
     *
     * @param scenarioName - The name of the scenario.
     * @returns The scenario identity or a default unranked identity.
     */
    public getScenarioIdentity(scenarioName: string): ScenarioIdentity {
        const map: RankIdentityMap = this.getIdentityMap();

        return map[scenarioName] || {
            continuousValue: -1,
            highestAchieved: -1,
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Estimates the rank representation for a given continuous value.
     *
     * @param value - The continuous skill value.
     * @param difficulty - The difficulty tier.
     * @returns An EstimatedRank descriptor.
     */
    public getEstimateForValue(value: number, difficulty: string): EstimatedRank {
        const rankNames: string[] = this._benchmarkService.getRankNames(difficulty);

        return this._buildEstimate(value, rankNames);
    }

    /**
     * Calculates the rank level for a single scenario based on raw score.
     *
     * @param score - The achieved score.
     * @param scenario - The scenario metadata.
     * @returns A float representing the continuous rank level (Level + Progress).
     */
    public getScenarioContinuousValue(score: number, scenario: BenchmarkScenario): number {
        const result: RankResult = this._rankService.calculateRank(score, scenario);

        return this._convertToContinuous(score, result, scenario);
    }

    /**
     * Evolves the identity for a specific scenario.
     *
     * @param scenarioName - The scenario to update.
     * @param sessionRank - The continuous rank achieved in the current session.
     */
    public evolveScenarioIdentity(scenarioName: string, sessionRank: number): void {
        const map: RankIdentityMap = this.getIdentityMap();
        const current: ScenarioIdentity = this.getScenarioIdentity(scenarioName);

        let newValue: number = current.continuousValue;

        if (current.continuousValue === -1) {
            // Anchor: Start at S-2
            newValue = Math.max(0, sessionRank - 2);
        } else {
            // Asymptotic Gain: New = E + (S - E) * factor
            const factor: number = 0.1;
            newValue = current.continuousValue + (sessionRank - current.continuousValue) * factor;
        }

        map[scenarioName] = {
            continuousValue: newValue,
            highestAchieved: Math.max(current.highestAchieved, newValue),
            lastUpdated: new Date().toISOString(),
        };

        localStorage.setItem(RankEstimator._identityKey, JSON.stringify(map));
    }

    /**
     * Calculates an overall rank based on a set of scenario scores.
     * Used for the "Ranked Session Summary".
     *
     * @param difficulty - The difficulty tier.
     * @param sessionScores - Map of scenario names to scores.
     * @returns The average estimated rank.
     */
    public calculateOverallRank(difficulty: string, sessionScores: Map<string, number>): EstimatedRank {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        const rankNames: string[] = this._benchmarkService.getRankNames(difficulty);

        if (scenarios.length === 0) {
            return this._createEmptyEstimate();
        }

        let totalValue: number = 0;
        let playedCount: number = 0;

        for (const scenario of scenarios) {
            const score: number | undefined = sessionScores.get(scenario.name);
            if (score !== undefined) {
                totalValue += this.getScenarioContinuousValue(score, scenario);
                playedCount++;
            }
        }

        const average: number = playedCount > 0 ? totalValue / playedCount : 0;

        return this._buildEstimate(average, rankNames);
    }

    /**
     * Applies asymptotic daily decay across all known scenario identities.
     */
    public applyDailyDecay(): void {
        const map: RankIdentityMap = this.getIdentityMap();
        const now: Date = new Date();
        const updatedMap: RankIdentityMap = {};

        for (const [scenario, identity] of Object.entries(map)) {
            const last: Date = new Date(identity.lastUpdated);
            const daysPassed: number = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

            if (daysPassed <= 0) {
                updatedMap[scenario] = identity;
                continue;
            }

            const decayRate: number = 0.05 * daysPassed;
            const target: number = identity.highestAchieved / 1.5;
            const newValue: number = Math.max(target, identity.continuousValue - (identity.continuousValue - target) * decayRate);

            updatedMap[scenario] = {
                ...identity,
                continuousValue: newValue,
                lastUpdated: now.toISOString(),
            };
        }

        localStorage.setItem(RankEstimator._identityKey, JSON.stringify(updatedMap));
    }

    /**
     * Converts a single scenario score into a continuous rank value.
     *
     * @param score - The raw score achieved.
     * @param result - The individual rank evaluation result.
     * @param scenario - The scenario metadata.
     * @returns A float representing (RankLevel + Progress).
     */
    private _convertToContinuous(
        score: number,
        result: RankResult,
        scenario: BenchmarkScenario,
    ): number {
        if (result.rankLevel === -1) {
            const allThresholds: number[] = Object.values(scenario.thresholds);
            const firstThreshold: number = allThresholds[0];

            if (!firstThreshold) {
                return 0;
            }

            return Math.min(0.99, score / firstThreshold);
        }

        return result.rankLevel + result.progressPercentage / 100;
    }

    private _buildEstimate(value: number, rankNames: string[]): EstimatedRank {
        const rankLevel: number = Math.floor(value);
        const progress: number = Math.round((value - rankLevel) * 100);

        const rankName: string =
            rankLevel < 0
                ? "Unranked"
                : rankNames[Math.min(rankLevel, rankNames.length - 1)];

        return {
            rankName,
            progressToNext: progress,
            continuousValue: value,
        };
    }

    private _createEmptyEstimate(): EstimatedRank {
        return {
            rankName: "Unranked",
            progressToNext: 0,
            continuousValue: 0,
        };
    }
}
