import { describe, it, expect, beforeEach, vi } from "vitest";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkService } from "../BenchmarkService";
import { IdentityService } from "../IdentityService";

describe("RankEstimator: Evolved Value Max Logic", (): void => {
    let estimator: RankEstimator;
    let benchmarkService: BenchmarkService;
    let identityService: IdentityService;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        benchmarkService = { getRankNames: vi.fn() } as unknown as BenchmarkService;
        identityService = { getKovaaksUsername: vi.fn().mockReturnValue("testuser") } as unknown as IdentityService;
        estimator = new RankEstimator(benchmarkService, identityService);
    });

    it("should retain the maximum rank when evolving multiple times in one day", (): void => {
        const scenarioName = "Scen1";
        const initial = _createInitialEstimate();
        localStorage.setItem("rank_identity_state_v2", JSON.stringify({ [scenarioName]: initial }));

        _evolveAndExpect(estimator, scenarioName, 2.0, 1.5);

        _evolveAndExpect(estimator, scenarioName, 1.8, 1.5);

        _evolveAndExpect(estimator, scenarioName, 2.4, 1.7);
    });
});

function _createInitialEstimate(): ScenarioEstimate {
    const now = new Date().toISOString();

    return {
        continuousValue: 1.0,
        highestAchieved: 1.0,
        lastUpdated: now,
        penalty: 0,
        lastPlayed: now,
        lastDecayed: now
    };
}

function _evolveAndExpect(
    estimator: RankEstimator,
    name: string,
    achievement: number,
    expected: number
): void {
    estimator.evolveScenarioEstimate(name, achievement, 1.0);
    const current = estimator.getScenarioEstimate(name);
    expect(current.continuousValue).toBe(expected);
}
