import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RankEstimateMap, RankEstimator, ScenarioEstimate } from "../RankEstimator";
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

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("should retain the maximum rank when evolving multiple times in one day", (): void => {
        const scenarioName = "Scen1";
        const initial = _createInitialEstimate();
        localStorage.setItem("rank_identity_state_v2_testuser", JSON.stringify({ [scenarioName]: initial }));

        _evolveAndExpect(estimator, scenarioName, 2.0, 1.5);

        _evolveAndExpect(estimator, scenarioName, 1.8, 1.5);

        _evolveAndExpect(estimator, scenarioName, 2.4, 1.7);
    });
});

describe("RankEstimator: Batch Evolution I/O", (): void => {
    let estimator: RankEstimator;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        const benchmarkService = { getRankNames: vi.fn() } as unknown as BenchmarkService;
        const identityService = { getKovaaksUsername: vi.fn().mockReturnValue("testuser") } as unknown as IdentityService;
        estimator = new RankEstimator(benchmarkService, identityService);
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("should preserve rank and notification order with one batch storage commit", (): void => {
        _assertBatchEvolution(estimator);
    });

    it("should not read, write, or notify for an empty evolution batch", (): void => {
        _assertEmptyBatchIsSilent(estimator);
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

function _assertBatchEvolution(estimator: RankEstimator): void {
    const storageKey = "rank_identity_state_v2_testuser";
    const initialMap: RankEstimateMap = {
        scen1: _createInitialEstimate(),
        scen2: { ..._createInitialEstimate(), continuousValue: 2.5, highestAchieved: 3.0 },
    };
    localStorage.setItem(storageKey, JSON.stringify(initialMap));
    const listener = vi.fn();
    estimator.onEstimateUpdated(listener);
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    estimator.evolveScenarioEstimates([
        { scenarioName: "scen1", sessionRank: 3.0, initialValue: 1.0 },
        { scenarioName: "scen2", sessionRank: 2.0, initialValue: 1.0 },
    ]);

    expect(getItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(setItemSpy.mock.calls[0][1] as string) as RankEstimateMap;
    expect(persisted.scen1.continuousValue).toBe(2.0);
    expect(persisted.scen1.highestAchieved).toBe(2.0);
    expect(persisted.scen2.continuousValue).toBe(2.5);
    expect(persisted.scen2.highestAchieved).toBe(3.0);
    expect(listener.mock.calls.map(([scenarioName]) => scenarioName)).toEqual(["scen1", "scen2"]);
}

function _assertEmptyBatchIsSilent(estimator: RankEstimator): void {
    const listener = vi.fn();
    estimator.onEstimateUpdated(listener);
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    estimator.evolveScenarioEstimates([]);

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
}
