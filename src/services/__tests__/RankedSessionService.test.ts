import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";

import { SessionSettingsService } from "../SessionSettingsService";
import { IdentityService } from "../IdentityService";

interface MockSet {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
    settings: SessionSettingsService;
    identity: IdentityService;
}

describe("RankedSessionService: Lifecycle", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = new RankedSessionService({ benchmarkService: mocks.benchmark, sessionService: mocks.session, rankEstimator: mocks.estimator, sessionSettings: mocks.settings, identityService: mocks.identity });
    });

    it("should generate a sequence of 3 scenarios using Weak-Strong-Diverse logic", (): void => {
        const scenarios: BenchmarkScenario[] = _createDiversePool();
        const estimates: Record<string, Partial<ScenarioEstimate>> = _createDiverseEstimates();

        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, estimates);

        service.startSession("Gold");

        _assertDiverseSequence(service.state.sequence);
    });

    it("should use the overall-rank floor for scenarios with weak or missing highscores", (): void => {
        _setupFallbackGapTest(mocks);

        service.startSession("Gold");

        expect(service.state.sequence[0]).toBe("unestablished");
    });
});

describe("RankedSessionService: Activity", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = new RankedSessionService({ benchmarkService: mocks.benchmark, sessionService: mocks.session, rankEstimator: mocks.estimator, sessionSettings: mocks.settings, identityService: mocks.identity });
    });

    it("should correctly report activity status", (): void => {
        expect(service.isSessionActive()).toBe(false);

        const scenarios = _createDiversePool();
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, _createDiverseEstimates());

        service.startSession("Gold");
        expect(service.isSessionActive()).toBe(true);

        service.endSession();
        expect(service.state.status).toBe("SUMMARY");
        expect(service.isSessionActive()).toBe(true);

        service.reset();
        expect(service.isSessionActive()).toBe(false);
    });
});
describe("RankedSessionService: Timer Expiry", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = _createRankedService(mocks);
    });

    afterEach((): void => {
        vi.useRealTimers();
    });

    it("should transition to SUMMARY state when timer expires", (): void => {
        vi.useFakeTimers();
        const settings: { rankedIntervalMinutes: number } = { rankedIntervalMinutes: 1 };
        (mocks.settings.getSettings as Mock).mockReturnValue(settings);

        _setupStandardSession(service, mocks);

        // Advance time by 61 seconds
        vi.advanceTimersByTime(61 * 1000);

        // We need to trigger a check since we don't have a background timer yet
        service.checkExpiration();

        expect(service.state.status).toBe("SUMMARY");
    });
});

describe("RankedSessionService: Timer Reset", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = _createRankedService(mocks);
    });

    it("should reset the timer when a new score is recorded", async (): Promise<void> => {
        _setupStandardSession(service, mocks);
        const initialStartTime: string | null = service.state.startTime;

        // Mock a new run that is newer than initialStartTime
        const runTimestamp = Date.now() + 5000;
        (mocks.session.getAllRankedSessionRuns as Mock).mockReturnValue([
            { scenarioName: "someScenario", score: 100, timestamp: runTimestamp }
        ]);

        const onSessionUpdated: Mock = mocks.session.onSessionUpdated as Mock;
        const onSessionUpdatedCallback: SessionUpdateListener = onSessionUpdated.mock.calls[0][0] as SessionUpdateListener;
        onSessionUpdatedCallback(["someScenario"]);

        const newStartTime: string | null = service.state.startTime;
        expect(newStartTime).not.toBe(initialStartTime);
        expect(newStartTime).toBe(new Date(runTimestamp).toISOString());
    });
});

describe("RankedSessionService: Diversity", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = new RankedSessionService({ benchmarkService: mocks.benchmark, sessionService: mocks.session, rankEstimator: mocks.estimator, sessionSettings: mocks.settings, identityService: mocks.identity });
    });

    it("should handle diversity check (penalty for similar categories)", (): void => {
        const scenarios: BenchmarkScenario[] = _createCollidingPool();
        const estimates: Record<string, Partial<ScenarioEstimate>> = _createCollidingEstimates();

        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, estimates);

        service.startSession("Gold");

        _assertCollidingSequence(service.state.sequence);
    });
});

function _createBenchmarkMock(): BenchmarkService {
    return {
        getScenarios: vi.fn(),
        getRankNames: vi.fn().mockReturnValue("Gold"),
        getDifficulty: vi.fn().mockReturnValue("Gold"),
        getAvailableDifficulties: vi.fn().mockReturnValue(["Gold", "Platinum"]),
    } as unknown as BenchmarkService;
}

function _createSessionMock(): SessionService {
    return {
        setIsRanked: vi.fn(),
        onSessionUpdated: vi.fn(),
        resetSession: vi.fn(),
        startRankedSession: vi.fn(),
        stopRankedSession: vi.fn(),
        getAllScenarioSessionBests: vi.fn().mockReturnValue([]),
        getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
        getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
        getRankedScenarioBest: vi.fn().mockReturnValue({}),
        setRankedPlaylist: vi.fn(),
    } as unknown as SessionService;
}

function _createEstimatorMock(): RankEstimator {
    return {
        getScenarioEstimate: vi.fn(),
        recordPlay: vi.fn(),
        applyPenaltyLift: vi.fn(),
        calculateHolisticEstimateRank: vi.fn().mockReturnValue({ rankName: "Gold", color: "", progressToNext: 0, continuousValue: 2.0 }),
        getScenarioContinuousValue: vi.fn().mockReturnValue(1.0),
        evolveScenarioEstimate: vi.fn(),
        initializePeakRanks: vi.fn(),
    } as unknown as RankEstimator;
}

function _createSettingsMock(): SessionSettingsService {
    return {
        getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
    } as unknown as SessionSettingsService;
}

function _createIdentityMock(): IdentityService {
    return {
        getKovaaksUsername: vi.fn().mockReturnValue("TestUser"),
        onProfilesChanged: vi.fn(),
    } as unknown as IdentityService;
}

function _createMocks(): MockSet {
    vi.clearAllMocks();
    localStorage.clear();

    const mocks: MockSet = {
        benchmark: _createBenchmarkMock(),
        session: _createSessionMock(),
        estimator: _createEstimatorMock(),
        settings: _createSettingsMock(),
        identity: _createIdentityMock()
    };

    _mockEstimates(mocks.estimator, {});

    return mocks;
}

function _mockEstimates(estimator: RankEstimator, estimates: Record<string, Partial<ScenarioEstimate>>): void {
    const defaultEstimate: ScenarioEstimate = { continuousValue: -1, highestAchieved: -1, lastUpdated: "", penalty: 0, lastPlayed: "", lastDecayed: "" };
    (estimator.getScenarioEstimate as Mock).mockImplementation((name: string) => {
        return estimates[name] || defaultEstimate;
    });
}

function _createDiversePool(): BenchmarkScenario[] {
    return [
        { name: "scenTracking1", category: "Reactive Tracking", subcategory: "s1", thresholds: {} },
        { name: "scenClicking1", category: "Dynamic Clicking", subcategory: "s2", thresholds: {} },
        { name: "scenFlick1", category: "Flick Tech", subcategory: "s3", thresholds: {} },
        { name: "scenControl1", category: "Control Tracking", subcategory: "s4", thresholds: {} },
        { name: "scenTracking2", category: "Reactive Tracking", subcategory: "s5", thresholds: {} },
    ];
}

function _createDiverseEstimates(): Record<string, Partial<ScenarioEstimate>> {
    return {
        "scenTracking1": { continuousValue: 2.0, highestAchieved: 2.0 },
        "scenClicking1": { continuousValue: 1.0, highestAchieved: 3.0 },
        "scenFlick1": { continuousValue: 0.0, highestAchieved: 0.0 },
        "scenControl1": { continuousValue: 0.5, highestAchieved: 0.5 },
        "scenTracking2": { continuousValue: 2.5, highestAchieved: 2.5 },
    };
}

function _assertDiverseSequence(sequence: string[]): void {
    expect(sequence).toHaveLength(3);
    expect(sequence[0]).toBe("scenFlick1");
    expect(sequence[1]).toBe("scenClicking1");
    expect(sequence[2]).toBe("scenControl1");
}

function _createCollidingPool(): BenchmarkScenario[] {
    return [
        { name: "targetStrong", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
        { name: "weakTrack1", category: "Reactive Tracking", subcategory: "s2", thresholds: {} },
        { name: "weakTrack2", category: "Reactive Tracking", subcategory: "s3", thresholds: {} },
        { name: "weakFlick1", category: "Flick Tech", subcategory: "s4", thresholds: {} },
    ];
}

function _setupFallbackGapTest(mocks: MockSet): void {
    const scenarios: BenchmarkScenario[] = [
        { name: "established", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
        { name: "unestablished", category: "Flick Tech", subcategory: "s2", thresholds: {} },
        { name: "supportA", category: "Reactive Tracking", subcategory: "s3", thresholds: {} },
        { name: "supportB", category: "Control Tracking", subcategory: "s4", thresholds: {} },
    ];

    (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
    (mocks.estimator.calculateHolisticEstimateRank as Mock).mockReturnValue({ continuousValue: 2.5 });
    _mockEstimates(mocks.estimator, {
        established: { continuousValue: 1.5, highestAchieved: 4.5 },
        unestablished: { continuousValue: 0, highestAchieved: 0 },
        supportA: { continuousValue: 1.2, highestAchieved: 1.2 },
        supportB: { continuousValue: 1.1, highestAchieved: 1.1 },
    });
}

function _createCollidingEstimates(): Record<string, Partial<ScenarioEstimate>> {
    return {
        "targetStrong": { continuousValue: 1.0, highestAchieved: 3.0 },
        "weakTrack1": { continuousValue: 0.1, highestAchieved: 0.1 },
        "weakTrack2": { continuousValue: 0.2, highestAchieved: 0.2 },
        "weakFlick1": { continuousValue: 0.25, highestAchieved: 0.25 },
    };
}

function _assertCollidingSequence(sequence: string[]): void {
    expect(sequence[0]).toBe("weakTrack1");
    expect(sequence[1]).toBe("targetStrong");
    expect(sequence[2]).toBe("weakFlick1");
}

function _setupStandardSession(service: RankedSessionService, mocks: MockSet): void {
    const scenarios: BenchmarkScenario[] = _createDiversePool();
    const estimates: Record<string, Partial<ScenarioEstimate>> = _createDiverseEstimates();

    (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
    _mockEstimates(mocks.estimator, estimates);

    service.startSession("Gold");
}

function _createRankedService(mocks: MockSet): RankedSessionService {
    return new RankedSessionService({
        benchmarkService: mocks.benchmark,
        sessionService: mocks.session,
        rankEstimator: mocks.estimator,
        sessionSettings: mocks.settings,
        identityService: mocks.identity,
    });
}

type SessionUpdateListener = (updatedScenarioNames?: string[]) => void;
