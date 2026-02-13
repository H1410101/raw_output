/* eslint-disable */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankEstimator, RankEstimateMap, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkService } from "../BenchmarkService";
import { IdentityService } from "../IdentityService";

const STORAGE_KEY = "rank_identity_state_v2_testuser";

interface MockBenchmarkService {
    getAllScenarios: Mock;
    getRankNames: Mock;
    getScenarios: Mock;
}

const _createMockService = (): MockBenchmarkService => ({
    getAllScenarios: vi.fn(),
    getRankNames: vi.fn(),
    getScenarios: vi.fn(),
});

describe("Peak Rank - Median (Odd)", (): void => {
    let estimator: RankEstimator;
    let mockService: MockBenchmarkService;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        mockService = _createMockService();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        estimator = new RankEstimator(mockService as unknown as BenchmarkService, identityService);
    });

    it("should handle odd number of played scenarios", (): void => {
        const initialMap = _createMapWithValues([2.0, 4.0, 10.0]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMap));
        mockService.getAllScenarios.mockReturnValue([{ name: "unplayed" }]);

        estimator.initializePeakRanks();
        const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as RankEstimateMap;
        expect(map["unplayed"].highestAchieved).toBe(4.0);
    });
});

describe("Peak Rank - Median (Even)", (): void => {
    let estimator: RankEstimator;
    let mockService: MockBenchmarkService;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        mockService = _createMockService();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        estimator = new RankEstimator(mockService as unknown as BenchmarkService, identityService);
    });

    it("should handle even number of played scenarios", (): void => {
        const initialMap = _createMapWithValues([2.0, 4.0, 6.0, 10.0]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMap));
        mockService.getAllScenarios.mockReturnValue([{ name: "unplayed" }]);

        estimator.initializePeakRanks();
        const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as RankEstimateMap;
        expect(map["unplayed"].highestAchieved).toBe(5.0);
    });
});

describe("Peak Rank - Formula", (): void => {
    let estimator: RankEstimator;
    let mockService: MockBenchmarkService;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        mockService = _createMockService();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        estimator = new RankEstimator(mockService as unknown as BenchmarkService, identityService);
    });

    it("should use min(median, 0.5 * best)", (): void => {
        const now = new Date().toISOString();
        const initialMap: RankEstimateMap = {
            "scenarioOne": { continuousValue: 10, highestAchieved: 10, lastUpdated: now, penalty: 0, lastPlayed: now, lastDecayed: now },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMap));
        mockService.getAllScenarios.mockReturnValue([{ name: "scenarioOne" }, { name: "scenarioTwo" }]);

        estimator.initializePeakRanks();
        const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as RankEstimateMap;
        expect(map["scenarioTwo"].highestAchieved).toBe(5.0);
    });
});

describe("Peak Rank - Stability", (): void => {
    let estimator: RankEstimator;
    let mockService: MockBenchmarkService;

    beforeEach((): void => {
        vi.clearAllMocks();
        localStorage.clear();
        mockService = _createMockService();
        const identityService = {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn(),
        } as unknown as IdentityService;
        estimator = new RankEstimator(mockService as unknown as BenchmarkService, identityService);
    });

    it("should never lower an existing peak", (): void => {
        const initialMap: RankEstimateMap = _createMapWithValues([10.0]);
        const now = new Date().toISOString();
        const entry: ScenarioEstimate = {
            continuousValue: 0,
            highestAchieved: 8.0,
            lastUpdated: now,
            penalty: 0,
            lastPlayed: now,
            lastDecayed: now,
        };
        initialMap["existing"] = entry;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMap));
        mockService.getAllScenarios.mockReturnValue([{ name: "existing" }]);

        estimator.initializePeakRanks();
        const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as RankEstimateMap;
        expect(map["existing"].highestAchieved).toBe(8.0);
    });
});

function _createMapWithValues(values: number[]): RankEstimateMap {
    const map: RankEstimateMap = {};
    const now = new Date().toISOString();
    values.forEach((value: number, index: number): void => {
        map[`scenario${index}`] = {
            continuousValue: value,
            highestAchieved: value,
            lastUpdated: now,
            penalty: 0,
            lastPlayed: now,
            lastDecayed: now,
        };
    });

    return map;
}
