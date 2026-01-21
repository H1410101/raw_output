import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";
import { SessionSettingsService } from "../SessionSettingsService";

interface MockSet {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
    settings: SessionSettingsService;
}

describe("RankedSessionService: Resumption Behavior", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _setupMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });

    it("should retain the same sequence on same-day resumption", (): void => {
        const scenarios = _createNumberedScenarios(3);
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator);

        service.startSession("Gold");
        const firstSequence = [...service.state.sequence];

        service.endSession();
        service.reset();

        service.startSession("Gold");
        expect(service.state.sequence).toEqual(firstSequence);
    });
});

describe("RankedSessionService: Persistence Behavior", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _setupMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });

    it("should maintain persistent targets across difficulty switches", (): void => {
        _setupMultiDiffMock(mocks);

        service.startSession("Gold");
        expect(service.state.initialEstimates["Gold1"]).toBe(1.0);

        service.startSession("Silver");
        service.startSession("Gold");

        expect(service.state.initialEstimates["Gold1"]).toBe(1.0);
    });

    it("should pass initialValue during evolution", (): void => {
        _setupEvolutionMock(mocks);

        service.startSession("Gold");

        const updateFn = (mocks.session.onSessionUpdated as Mock).mock.calls[0][0] as (names: string[]) => void;
        updateFn(["Scen1"]);

        service.endSession();

        expect(mocks.estimator.evolveScenarioEstimate).toHaveBeenCalledWith("Scen1", 2.0, 1.0);
    });
});

function _setupMocks(): MockSet {
    vi.clearAllMocks();
    localStorage.clear();

    return {
        benchmark: { getScenarios: vi.fn(), getRankNames: vi.fn() } as unknown as BenchmarkService,
        session: {
            setIsRanked: vi.fn(),
            onSessionUpdated: vi.fn(),
            resetSession: vi.fn(),
            startRankedSession: vi.fn(),
            stopRankedSession: vi.fn(),
            getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
            getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
        } as unknown as SessionService,
        estimator: {
            getScenarioEstimate: vi.fn(),
            recordPlay: vi.fn(),
            getScenarioContinuousValue: vi.fn(),
            evolveScenarioEstimate: vi.fn()
        } as unknown as RankEstimator,
        settings: {
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
        } as unknown as SessionSettingsService
    };
}

function _createNumberedScenarios(count: number): BenchmarkScenario[] {
    return Array.from({ length: count }, (_unused, index) => ({
        name: `Scen${index + 1}`,
        category: "Cat",
        subcategory: "Sub",
        thresholds: {}
    }));
}

function _mockEstimates(estimator: RankEstimator): void {
    (estimator.getScenarioEstimate as Mock).mockImplementation((name: string) => ({
        continuousValue: name === "Scen1" ? 1.0 : name === "Scen2" ? 0.0 : 0.5,
        highestAchieved: 1.0,
        penalty: 0,
        lastPlayed: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastDecayed: new Date().toISOString()
    }));
}

function _setupMultiDiffMock(mocks: MockSet): void {
    const gold = [{ name: "Gold1", category: "C1", subcategory: "S1", thresholds: {} }];
    const silver = [{ name: "Silver1", category: "C1", subcategory: "S1", thresholds: {} }];

    (mocks.benchmark.getScenarios as Mock).mockImplementation((diff) => (diff === "Gold" ? gold : silver));
    (mocks.estimator.getScenarioEstimate as Mock).mockReturnValue({
        continuousValue: 1.0,
        highestAchieved: 2.0,
        penalty: 0,
        lastPlayed: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastDecayed: new Date().toISOString()
    });
}

function _setupEvolutionMock(mocks: MockSet): void {
    const scenarios = [{ name: "Scen1", category: "C1", subcategory: "S1", thresholds: {} }];
    (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
    (mocks.estimator.getScenarioEstimate as Mock).mockReturnValue({
        continuousValue: 1.0,
        highestAchieved: 1.0,
        penalty: 0,
        lastPlayed: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastDecayed: new Date().toISOString()
    });
    (mocks.session.getAllRankedSessionRuns as Mock).mockReturnValue([{ scenarioName: "Scen1", score: 100 }, { scenarioName: "Scen1", score: 100 }, { scenarioName: "Scen1", score: 100 }]);
    (mocks.estimator.getScenarioContinuousValue as Mock).mockReturnValue(2.0);
}
