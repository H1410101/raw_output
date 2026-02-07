import { describe, it, expect, vi } from "vitest";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkService } from "../BenchmarkService";
import { BenchmarkScenario } from "../../data/benchmarks";

describe("RankEstimator: RU Influence Capping Check", (): void => {
    it("should check if a scenario's influence on holistic rank is capped at maximum rank", (): void => {
        // 1. Setup mock scenarios with thresholds
        const mockScenarios = _createMockScenarios();

        const mockBenchmarkService = {
            getScenarios: vi.fn().mockReturnValue(mockScenarios),
            getRankNames: vi.fn().mockReturnValue(["rank1", "rank2"]),
            getAllScenarios: vi.fn().mockReturnValue(mockScenarios),
        } as unknown as BenchmarkService;

        const estimator = new RankEstimator(mockBenchmarkService);

        // 2. Mock estimates in localStorage
        const estimates = _createMockEstimates();
        localStorage.setItem("rank_identity_state_v2", JSON.stringify(estimates));

        // 3. Calculate holistic estimate
        // If capped, Scenario 2 should count as 2.0. Average: (2.0 + 2.0) / 2 = 2.0
        // If NOT capped, Average: (2.0 + 3.0) / 2 = 2.5
        const result = estimator.calculateHolisticEstimateRank("Intermediate");

        console.log("Calculated Continuous Value:", result.continuousValue);

        // We expect it to be capped now.
        expect(result.continuousValue).toBe(2.0);
    });
});

function _createMockScenarios(): BenchmarkScenario[] {
    return [
        {
            name: "scenario1",
            category: "categoryA",
            subcategory: "subA",
            // Max rank index + 1 = 2
            thresholds: { "rank1": 100, "rank2": 200 }
        },
        {
            name: "scenario2",
            category: "categoryA",
            subcategory: "subA",
            thresholds: { "rank1": 100, "rank2": 200 }
        }
    ];
}

function _createMockEstimates(): Record<string, ScenarioEstimate> {
    return {
        "scenario1": {
            continuousValue: 2.0,
            highestAchieved: 2.0,
            lastUpdated: new Date().toISOString(),
            penalty: 0,
            lastPlayed: new Date().toISOString(),
            lastDecayed: new Date().toISOString()
        },
        "scenario2": {
            continuousValue: 3.0,
            highestAchieved: 3.0,
            lastUpdated: new Date().toISOString(),
            penalty: 0,
            lastPlayed: new Date().toISOString(),
            lastDecayed: new Date().toISOString()
        }
    };
}
