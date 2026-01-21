import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";
import { SessionSettingsService } from "../SessionSettingsService";

interface MockSet {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
    settings: SessionSettingsService;
}

function _createResumptionMocks(): MockSet {
    vi.clearAllMocks();
    localStorage.clear();

    return {
        benchmark: { getScenarios: vi.fn(), getRankNames: vi.fn().mockReturnValue([]) } as unknown as BenchmarkService,
        session: {
            onSessionUpdated: vi.fn(),
            startRankedSession: vi.fn(),
            stopRankedSession: vi.fn(),
            getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
            getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
        } as unknown as SessionService,
        estimator: {
            getScenarioEstimate: vi.fn(),
            recordPlay: vi.fn(),
            getScenarioContinuousValue: vi.fn().mockReturnValue(1.0),
            evolveScenarioEstimate: vi.fn(),
        } as unknown as RankEstimator,
        settings: {
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
        } as unknown as SessionSettingsService
    };
}

describe("RankedSessionService Resumption (Basic)", () => {
    let service: RankedSessionService;
    let mocks: MockSet;
    beforeEach(() => {
        mocks = _createResumptionMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    it("should resume a session from today if started with same difficulty", () => {
        const scenarios = _createPool();
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, _createEstimates());
        service.startSession("Gold");
        const sequence = service.state.sequence;
        const callback = (mocks.session.onSessionUpdated as Mock).mock.calls[0][0] as (updatedScenarioNames?: string[]) => void;
        callback([sequence[0]]);
        service.reset();
        service.startSession("Gold");
        expect(service.state.status).toBe("ACTIVE");
        expect(service.state.currentIndex).toBe(1);
        expect(service.state.sequence).toEqual(sequence);
        service.retreat();
        expect(service.state.currentIndex).toBe(0);
    });
});

describe("RankedSessionService Resumption (Difficulty)", () => {
    let service: RankedSessionService;
    let mocks: MockSet;
    beforeEach(() => {
        mocks = _createResumptionMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    it("should start a new session if diff difficulty is requested", () => {
        const goldScenarios = _createPool();
        const platScenarios = _createPool().reverse();
        (mocks.benchmark.getScenarios as Mock).mockImplementation((diff: string) => (diff === "Gold" ? goldScenarios : platScenarios));
        _mockEstimates(mocks.estimator, _createEstimates());
        service.startSession("Gold");
        const goldSequence = service.state.sequence;
        service.reset();
        service.startSession("Platinum");
        expect(service.state.sequence).not.toEqual(goldSequence);
        expect(service.state.currentIndex).toBe(0);
        expect(service.state.difficulty).toBe("Platinum");
    });
});

describe("RankedSessionService Resumption (Jumping)", () => {
    let service: RankedSessionService;
    let mocks: MockSet;
    beforeEach(() => {
        mocks = _createResumptionMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    it("should jump to scenario after last played even if some were skipped", () => {
        const scenarios = _createPool();
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, _createEstimates());
        service.startSession("Gold");
        const sequence = service.state.sequence;
        const callback = (mocks.session.onSessionUpdated as Mock).mock.calls[0][0] as (updatedScenarioNames?: string[]) => void;
        callback([sequence[1]]);
        service.reset();
        service.startSession("Gold");
        expect(service.state.currentIndex).toBe(2);
    });
});

describe("RankedSessionService Resumption (Extension)", () => {
    let service: RankedSessionService;
    let mocks: MockSet;
    beforeEach(() => {
        mocks = _createResumptionMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    it("should extend session if all gauntlet scenarios were played", () => {
        const scenarios = _createPool();
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, _createEstimates());
        service.startSession("Gold");
        const sequence = service.state.sequence;
        const callback = (mocks.session.onSessionUpdated as Mock).mock.calls[0][0] as (updatedScenarioNames?: string[]) => void;
        callback([sequence[0], sequence[1], sequence[2]]);
        service.reset();
        service.startSession("Gold");
        expect(service.state.sequence.length).toBeGreaterThan(3);
        expect(service.state.currentIndex).toBe(3);
        expect(service.state.initialGauntletComplete).toBe(true);
    });
});

function _mockEstimates(estimator: RankEstimator, estimates: Record<string, Partial<ScenarioEstimate>>): void {
    (estimator.getScenarioEstimate as Mock).mockImplementation((name: string) => {

        return estimates[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "", penalty: 0, lastPlayed: "" };
    });
}

function _createPool(): BenchmarkScenario[] {

    return [
        { name: "scenOne", category: "Cat1", subcategory: "Sub1", thresholds: {} },
        { name: "scenTwo", category: "Cat2", subcategory: "Sub2", thresholds: {} },
        { name: "scenThree", category: "Cat3", subcategory: "Sub3", thresholds: {} },
        { name: "scenFour", category: "Cat4", subcategory: "Sub4", thresholds: {} },
        { name: "scenFive", category: "Cat5", subcategory: "Sub5", thresholds: {} },
        { name: "scenSix", category: "Cat6", subcategory: "Sub6", thresholds: {} },
    ];
}

function _createEstimates(): Record<string, Partial<ScenarioEstimate>> {

    return {
        scenOne: { continuousValue: 1.0, highestAchieved: 1.0 },
        scenTwo: { continuousValue: 1.0, highestAchieved: 1.0 },
        scenThree: { continuousValue: 1.0, highestAchieved: 1.0 },
    };
}
