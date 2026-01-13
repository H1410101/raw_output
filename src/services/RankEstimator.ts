import { BenchmarkScenario } from "../data/benchmarks";
import { BenchmarkService } from "./BenchmarkService";

export interface EstimatedRank {
    readonly rankName: string;
    readonly color: string;
    readonly progressToNext: number;
    readonly continuousValue: number;
}

/**
 * Represents the persistent rank estimate for a specific scenario.
 */
export interface ScenarioRankEstimate {
    readonly continuousValue: number;
    readonly highestAchieved: number;
    readonly lastUpdated: string;
}

/**
 * Represents the holistic rank estimate across all scenarios.
 */
export type RankEstimateMap = Record<string, ScenarioRankEstimate>;

/**
 * Service for calculating holistic rank estimates and evolving per-scenario identities.
 *
 * Implements the "Rank Mechanics Specification v4.3".
 */
export class RankEstimator {
    private static readonly _identityKey: string = "rank_identity_state_v2";
    // increased from 0.1
    private static readonly _learningRate: number = 0.15;
    // Uncertainty factor
    private static readonly _phi: number = 1.0;

    private readonly _benchmarkService: BenchmarkService;

    /**
     * Initializes the estimator.
     *
     * @param rankService - Service for individual rank calculations.
     * @param benchmarkService - Service for accessing benchmark definitions.
     */
    public constructor(
        benchmarkService: BenchmarkService,
    ) {
        this._benchmarkService = benchmarkService;
    }

    /**
     * Retrieves the current persistent rank estimate map.
     *
     * @returns The full rank estimate map from storage.
     */
    public getRankEstimateMap(): RankEstimateMap {
        const raw: string | null = localStorage.getItem(RankEstimator._identityKey);

        if (raw) {
            try {
                return JSON.parse(raw) as RankEstimateMap;
            } catch {
                // Return default on error
            }
        }

        return {};
    }

    /**
     * Retrieves the rank estimate for a specific scenario.
     *
     * @param scenarioName - The name of the scenario.
     * @returns The scenario rank estimate or a default unranked estimate.
     */
    public getScenarioRankEstimate(scenarioName: string): ScenarioRankEstimate {
        const map: RankEstimateMap = this.getRankEstimateMap();

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
     * Uses the "Rank Unit" formula (Specification 2.2).
     *
     * @param score - The achieved score.
     * @param scenario - The scenario metadata.
     * @returns A float representing the continuous rank level (Integral Rank + Progress).
     */
    public getScenarioContinuousValue(score: number, scenario: BenchmarkScenario): number {
        // We pull thresholds directly to apply the new T_0=0 logic precisely.
        // RankService could be used, but we want strict control over the "Rank Unit" float definition.

        // Sort thresholds by value
        const entries = Object.entries(scenario.thresholds).sort((a, b) => a[1] - b[1]);
        const sortedThresholds = entries.map(entry => entry[1]);

        return RankEstimator._calculateRankUnit(score, sortedThresholds);
    }

    /**
     * Evolves the rank estimate for a specific scenario.
     *
     * @param scenarioName - The scenario to update.
     * @param sessionRank - The continuous rank achieved in the current session.
     */
    public evolveScenarioRankEstimate(scenarioName: string, sessionRank: number): void {
        const map: RankEstimateMap = this.getRankEstimateMap();
        const current: ScenarioRankEstimate = this.getScenarioRankEstimate(scenarioName);

        let newValue: number = current.continuousValue;

        if (current.continuousValue === -1) {
            // Anchor: Start at S-2 for unranked seed
            newValue = Math.max(0, sessionRank - 2);
        } else {
            // EMA Update (Specification 2.4)
            newValue = current.continuousValue + RankEstimator._learningRate * (sessionRank - current.continuousValue);
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
     * Uses Hierarchical Aggregation (Specification 2.5).
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

        // 1. Convert Scores to Continuous Ranks
        const scenarioRanks: Map<string, number> = new Map();
        for (const scenario of scenarios) {
            const score = sessionScores.get(scenario.name);
            if (score !== undefined) {
                scenarioRanks.set(scenario.name, this.getScenarioContinuousValue(score, scenario));
            }
        }

        if (scenarioRanks.size === 0) {
            return this._createEmptyEstimate();
        }

        // 2. Aggregate Hierarchically
        const overallRankValue = RankEstimator._calculateHierarchicalAverage(scenarios, scenarioRanks);

        return this._buildEstimate(overallRankValue, rankNames);
    }

    /**
     * Applies asymptotic daily decay across all known scenario identities.
     * Uses Max(Exponential, Linear) logic (Specification 1.2).
     */
    public applyDailyDecay(): void {
        const map: RankEstimateMap = this.getRankEstimateMap();
        const now: Date = new Date();
        const updatedMap: RankEstimateMap = {};
        let hasChanges = false;

        for (const [scenario, rankEstimate] of Object.entries(map)) {
            const decayResult = this._processScenarioDecay(rankEstimate, now);
            updatedMap[scenario] = decayResult.newEstimate;
            if (decayResult.changed) {
                hasChanges = true;
            }
        }

        if (hasChanges) {
            localStorage.setItem(RankEstimator._identityKey, JSON.stringify(updatedMap));
        }
    }

    private _processScenarioDecay(
        estimate: ScenarioRankEstimate,
        now: Date
    ): { newEstimate: ScenarioRankEstimate; changed: boolean } {
        const last: Date = new Date(estimate.lastUpdated);
        const msPassed = now.getTime() - last.getTime();
        const daysPassed = msPassed / (1000 * 60 * 60 * 24);

        if (daysPassed <= 1.0) {
            return { newEstimate: estimate, changed: false };
        }

        const newContinuous = RankEstimator._calculateDecay(
            estimate.continuousValue,
            estimate.highestAchieved,
            daysPassed
        );

        if (Math.abs(newContinuous - estimate.continuousValue) > 0.001) {
            return {
                newEstimate: {
                    ...estimate,
                    continuousValue: newContinuous,
                    lastUpdated: now.toISOString(),
                },
                changed: true,
            };
        }

        return { newEstimate: estimate, changed: false };
    }

    // --- Private Static Pure Calculation Logic ---

    /**
     * Calculates the single "Rank Unit" value for a score.
     * @param score - The score achieved.
     * @param sortedThresholds - The thresholds for the ranking system.
     * @returns The continuous rank value.
     */
    private static _calculateRankUnit(score: number, sortedThresholds: number[]): number {
        // 1. Identify Rank Index
        let rankIndex = -1;
        for (let i = 0; i < sortedThresholds.length; i++) {
            if (score >= sortedThresholds[i]) {
                rankIndex = i;
            } else {
                break;
            }
        }

        // 2. Unranked Case (Score < T_0)
        // Spec 2.2: R = (S / T_0) * 0.99 -- Wait, T_0 IS the first threshold in the array (index 0).
        // If rankIndex is -1, it means S < thresholds[0].
        if (rankIndex === -1) {
            const thresholdZero = sortedThresholds[0];

            return thresholdZero > 0 ? (score / thresholdZero) * 0.99 : 0;
        }

        // 3. Beyond Max Case
        // Spec 2.2: V = T_max - T_max-1
        if (rankIndex === sortedThresholds.length - 1) {
            const tMax = sortedThresholds[rankIndex];
            const tPrev = rankIndex > 0 ? sortedThresholds[rankIndex - 1] : 0;
            const virtualInterval = tMax - tPrev;
            const safeInterval = virtualInterval > 0 ? virtualInterval : 100; // Fallback

            return rankIndex + (score - tMax) / safeInterval;
        }

        // 4. Standard Case
        // Spec 2.2: P = (S - T_i) / (T_i+1 - T_i)
        const tLower = sortedThresholds[rankIndex];
        const tUpper = sortedThresholds[rankIndex + 1];
        const interval = tUpper - tLower;
        const safeInterval = interval > 0 ? interval : 1;

        const delta = (score - tLower) / safeInterval;

        return rankIndex + delta;
    }

    /**
     * Calculates the decayed rank value.
     * @param current
     * @param peak
     * @param daysPassed
     */
    private static _calculateDecay(current: number, peak: number, daysPassed: number): number {
        // Spec 1.2
        const floor = peak - 2 * RankEstimator._phi;

        // If already below floor (unlikely but possible), stay there.
        if (current <= floor) {
            return current;
        }

        // 1. Exponential Model (Half-Life 30 days)
        const expDecay = floor + (current - floor) * Math.pow(0.5, daysPassed / 30);

        // 2. Linear Model (Saturation 90 days)
        const linDecay = current - (current - floor) * (daysPassed / 90);

        // Logic: Max(Floor, Min(Exp, Lin)) -> "Most aggressive valid decay"
        // Wait, Spec says: I_decayed = min(I_exp, I_lin). 
        // We want the LOWER value (more decay).
        // But we must floor it at I_floor.
        // Actually both formulas inherently respect the floor conceptually if strictly applied to the delta.
        // But let's be safe.

        const candidate = Math.min(expDecay, linDecay);

        return Math.max(floor, candidate);
    }

    /**
     * Aggregates rank values hierarchically.
     * @param scenarios - List of benchmark scenarios.
     * @param scores - Map of scenario scores.
     * @returns The hierarchical average rank value.
     */
    private static _calculateHierarchicalAverage(
        scenarios: BenchmarkScenario[],
        scores: Map<string, number>
    ): number {
        const hierarchy = this._buildHierarchy(scenarios, scores);
        const catAverages: number[] = this._calculateCategoryAverages(hierarchy);

        if (catAverages.length === 0) {
            return 0;
        }

        return catAverages.reduce((acc, val) => acc + val, 0) / catAverages.length;
    }

    private static _buildHierarchy(
        scenarios: BenchmarkScenario[],
        scores: Map<string, number>
    ): Record<string, Record<string, number[]>> {
        const hierarchy: Record<string, Record<string, number[]>> = {};

        for (const scenario of scenarios) {
            if (!scores.has(scenario.name)) continue;

            const category = scenario.category;
            const subcategory = scenario.subcategory;
            const value = scores.get(scenario.name)!;

            if (!hierarchy[category]) hierarchy[category] = {};
            if (!hierarchy[category][subcategory]) {
                hierarchy[category][subcategory] = [];
            }

            hierarchy[category][subcategory].push(value);
        }

        return hierarchy;
    }

    private static _calculateCategoryAverages(
        hierarchy: Record<string, Record<string, number[]>>
    ): number[] {
        const catAverages: number[] = [];

        for (const catKey in hierarchy) {
            const subMap = hierarchy[catKey];
            const subAverages: number[] = [];

            for (const subKey in subMap) {
                const values = subMap[subKey];
                const subAvg =
                    values.reduce((acc, val) => acc + val, 0) / values.length;
                subAverages.push(subAvg);
            }

            if (subAverages.length > 0) {
                const catAvg =
                    subAverages.reduce((acc, val) => acc + val, 0) / subAverages.length;
                catAverages.push(catAvg);
            }
        }

        return catAverages;
    }

    private _buildEstimate(value: number, rankNames: string[]): EstimatedRank {
        const rankLevel: number = Math.floor(value);
        const progress: number = Math.min(99, Math.max(0, Math.round((value - rankLevel) * 100)));

        const rankName: string =
            rankLevel < 0
                ? "Unranked"
                : rankLevel >= rankNames.length
                    ? rankNames[rankNames.length - 1] // Cap at max name
                    : rankNames[rankLevel]; // Normal case

        // If we heavily exceeded, we might want to show "MaxRank + 2" or something, 
        // but for now we essentially clap the NAME, but keep the continuous value.
        // Actually, if rankLevel > max, we should probably still show the max rank name.

        return {
            rankName,
            color: "var(--rank-color-default)",
            progressToNext: progress,
            continuousValue: value,
        };
    }

    private _createEmptyEstimate(): EstimatedRank {
        return {
            rankName: "Unranked",
            color: "var(--rank-color-unranked)",
            progressToNext: 0,
            continuousValue: 0,
        };
    }
}
