import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { SessionSettingsService } from "../SessionSettingsService";

interface MockSet {
    mockBenchmark: BenchmarkService;
    mockSession: SessionService;
    mockEstimator: RankEstimator;
    mockSettings: SessionSettingsService;
}

describe("RankedSessionService: RU Clamping", (): void => {
    let service: RankedSessionService;
    let mockBenchmark: BenchmarkService;
    let mockSession: SessionService;
    let mockEstimator: RankEstimator;
    let mockSettings: SessionSettingsService;

    beforeEach((): void => {
        const mocks: MockSet = _createMocks();
        mockBenchmark = mocks.mockBenchmark;
        mockSession = mocks.mockSession;
        mockEstimator = mocks.mockEstimator;
        mockSettings = mocks.mockSettings;

        service = new RankedSessionService(
            mockBenchmark,
            mockSession,
            mockEstimator,
            mockSettings
        );
    });

    it("should clamp CurrentRU and PeakRU to the max rank in the difficulty", (): void => {
        _setupClampingTest(mockBenchmark, mockEstimator);

        service.startSession("Gold");

        // With clamp: scenB (5.8) should be chosen as the strongest over the clamped scenA (5.0).
        expect(service.state.sequence[0]).toBe("scenB");
    });
});

function _createMocks(): MockSet {
    vi.clearAllMocks();
    localStorage.clear();

    return {
        mockBenchmark: {
            getScenarios: vi.fn(),
            getRankNames: vi.fn(),
            getDifficulty: vi.fn().mockReturnValue("Gold"),
        } as unknown as BenchmarkService,
        mockSession: {
            setIsRanked: vi.fn(),
            onSessionUpdated: vi.fn(),
            resetSession: vi.fn(),
            startRankedSession: vi.fn(),
            stopRankedSession: vi.fn(),
            getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
            getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
            setRankedPlaylist: vi.fn(),
        } as unknown as SessionService,
        mockEstimator: {
            getScenarioEstimate: vi.fn(),
            recordPlay: vi.fn(),
            initializePeakRanks: vi.fn(),
            applyPenaltyLift: vi.fn(),
        } as unknown as RankEstimator,
        mockSettings: {
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
        } as unknown as SessionSettingsService,
    };
}

function _setupClampingTest(mockBenchmark: BenchmarkService, mockEstimator: RankEstimator): void {
    const rankNames = ["R1", "R2", "R3", "R4", "R5"];
    (mockBenchmark.getRankNames as Mock).mockReturnValue(rankNames);

    const scenarios = [
        { name: "scenA", category: "Cat1", subcategory: "Sub1", thresholds: {} },
        { name: "scenB", category: "Cat2", subcategory: "Sub2", thresholds: {} },
        { name: "scenC", category: "Cat3", subcategory: "Sub3", thresholds: {} },
        { name: "scenD", category: "Cat4", subcategory: "Sub4", thresholds: {} },
    ];
    (mockBenchmark.getScenarios as Mock).mockReturnValue(scenarios);

    const estimates: Record<string, Partial<ScenarioEstimate>> = {
        "scenA": { continuousValue: 10.0, highestAchieved: 12.0 },
        "scenB": { continuousValue: 4.0, highestAchieved: 4.9 },
        "scenC": { continuousValue: 4.5, highestAchieved: 4.6 },
        "scenD": { continuousValue: 0.0, highestAchieved: 0.0 },
    };

    (mockEstimator.getScenarioEstimate as Mock).mockImplementation((name: string) => {
        return estimates[name] || {
            continuousValue: -1,
            highestAchieved: -1,
            lastUpdated: "",
            penalty: 0,
            lastPlayed: "",
            lastDecayed: ""
        };
    });
}
