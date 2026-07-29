import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimateMap, RankEstimator, ScenarioEstimate } from "../RankEstimator";
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

    it("should generate three scenarios in primary-secondary-coverage order", (): void => {
        const scenarios: BenchmarkScenario[] = _createSelectionPool();
        const estimates: Record<string, Partial<ScenarioEstimate>> = _createSelectionEstimates();

        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, estimates);

        service.startSession("Gold");

        _assertSelectionSequence(service.state.sequence);
    });

    it("should use the overall-rank floor for scenarios with low or missing highscores", (): void => {
        _setupFallbackGapTest(mocks);

        service.startSession("Gold");

        expect(service.state.sequence[0]).toBe("unestablished");
    });

});

describe("RankedSessionService: State Emissions", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = _createRankedService(mocks);
    });

    it("should notify once when starting a new session", (): void => {
        _assertSingleStartNotification(service, mocks);
    });

    it("should persist and notify once when advance automatically extends", (): void => {
        _assertSingleAutomaticExtension(service, mocks);
    });
});

describe("RankedSessionService: Rank Storage Snapshot", (): void => {
    beforeEach((): void => {
        localStorage.clear();
    });

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("should preserve selection while reading rank storage once", (): void => {
        const scenarios = _createSelectionPool();
        const benchmark = _createSnapshotBenchmark(scenarios);
        const identity = _createIdentityMock();
        const estimator = new RankEstimator(benchmark, identity);
        const storageKey = "rank_identity_state_v2_testuser";
        localStorage.setItem(storageKey, JSON.stringify(_createStoredSelectionEstimates()));
        const service = new RankedSessionService({
            benchmarkService: benchmark,
            sessionService: _createSessionMock(),
            rankEstimator: estimator,
            sessionSettings: _createSettingsMock(),
            identityService: identity,
        });
        const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

        service.startSession("Gold");

        expect(service.state.sequence).toEqual(["scenClicking1", "scenFlick1", "scenControl1"]);
        expect(getItemSpy.mock.calls.filter(([key]) => key === storageKey)).toHaveLength(1);
        expect(setItemSpy.mock.calls.filter(([key]) => key === storageKey)).toHaveLength(0);
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

        const scenarios = _createSelectionPool();
        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, _createSelectionEstimates());

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
        getRankEstimateMap: vi.fn().mockReturnValue({}),
        getScenarioEstimate: vi.fn(),
        recordPlay: vi.fn(),
        applyPenaltyLift: vi.fn(),
        calculateHolisticEstimateRank: vi.fn().mockReturnValue({ rankName: "Gold", color: "", progressToNext: 0, continuousValue: 2.0 }),
        getScenarioContinuousValue: vi.fn().mockReturnValue(1.0),
        evolveScenarioEstimate: vi.fn(),
        evolveScenarioEstimates: vi.fn(),
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

function _createSelectionPool(): BenchmarkScenario[] {
    return [
        { name: "scenTracking1", category: "Reactive Tracking", subcategory: "s1", thresholds: {} },
        { name: "scenClicking1", category: "Dynamic Clicking", subcategory: "s2", thresholds: {} },
        { name: "scenFlick1", category: "Flick Tech", subcategory: "s3", thresholds: {} },
        { name: "scenControl1", category: "Control Tracking", subcategory: "s4", thresholds: {} },
        { name: "scenTracking2", category: "Reactive Tracking", subcategory: "s5", thresholds: {} },
    ];
}

function _createSelectionEstimates(): Record<string, Partial<ScenarioEstimate>> {
    return {
        "scenTracking1": { continuousValue: 2.0, highestAchieved: 2.0 },
        "scenClicking1": { continuousValue: 1.0, highestAchieved: 3.0 },
        "scenFlick1": { continuousValue: 0.0, highestAchieved: 0.0 },
        "scenControl1": { continuousValue: 0.5, highestAchieved: 0.5 },
        "scenTracking2": { continuousValue: 2.5, highestAchieved: 2.5 },
    };
}

function _createStoredSelectionEstimates(): RankEstimateMap {
    const timestamp = new Date().toISOString();
    const estimates = _createSelectionEstimates();

    return Object.fromEntries(Object.entries(estimates).map(([name, estimate]) => [name, {
        continuousValue: estimate.continuousValue ?? 0,
        highestAchieved: name === "scenFlick1" ? 0.01 : estimate.highestAchieved ?? 0,
        lastUpdated: timestamp,
        penalty: 0,
        lastPlayed: timestamp,
        lastDecayed: timestamp,
    }]));
}

function _createSnapshotBenchmark(scenarios: BenchmarkScenario[]): BenchmarkService {
    return {
        getScenarios: vi.fn().mockReturnValue(scenarios),
        getAllScenarios: vi.fn().mockReturnValue(scenarios),
        getRankNames: vi.fn().mockReturnValue(["R1", "R2", "R3", "R4", "R5"]),
    } as unknown as BenchmarkService;
}

function _assertSelectionSequence(sequence: string[]): void {
    expect(sequence).toHaveLength(3);
    expect(sequence[0]).toBe("scenFlick1");
    expect(sequence[1]).toBe("scenClicking1");
    expect(sequence[2]).toBe("scenControl1");
}

function _createCollidingPool(): BenchmarkScenario[] {
    return [
        { name: "secondaryTarget", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
        { name: "primaryTrack1", category: "Reactive Tracking", subcategory: "s2", thresholds: {} },
        { name: "primaryTrack2", category: "Reactive Tracking", subcategory: "s3", thresholds: {} },
        { name: "coverageFlick1", category: "Flick Tech", subcategory: "s4", thresholds: {} },
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
        "secondaryTarget": { continuousValue: 1.0, highestAchieved: 3.0 },
        "primaryTrack1": { continuousValue: 0.1, highestAchieved: 0.1 },
        "primaryTrack2": { continuousValue: 0.2, highestAchieved: 0.2 },
        "coverageFlick1": { continuousValue: 0.25, highestAchieved: 0.25 },
    };
}

function _assertCollidingSequence(sequence: string[]): void {
    expect(sequence[0]).toBe("primaryTrack1");
    expect(sequence[1]).toBe("secondaryTarget");
    expect(sequence[2]).toBe("coverageFlick1");
}

function _setupStandardSession(service: RankedSessionService, mocks: MockSet): void {
    const scenarios: BenchmarkScenario[] = _createSelectionPool();
    const estimates: Record<string, Partial<ScenarioEstimate>> = _createSelectionEstimates();

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

function _assertSingleStartNotification(service: RankedSessionService, mocks: MockSet): void {
    (mocks.benchmark.getScenarios as Mock).mockReturnValue(_createSelectionPool());
    _mockEstimates(mocks.estimator, _createSelectionEstimates());
    const listener = vi.fn();
    service.onStateChanged(listener);

    service.startSession("Gold");

    expect(listener).toHaveBeenCalledTimes(1);
}

function _assertSingleAutomaticExtension(service: RankedSessionService, mocks: MockSet): void {
    (mocks.benchmark.getScenarios as Mock).mockReturnValue(_createSelectionPool());
    _mockEstimates(mocks.estimator, _createSelectionEstimates());
    const listener = vi.fn();
    service.onStateChanged(listener);
    service.startSession("Gold");
    service.advance();
    service.advance();
    service.advance();
    service.extendSession();
    service.advance();
    listener.mockClear();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    service.advance();

    expect(service.state.status).toBe("ACTIVE");
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    setItemSpy.mockRestore();
}

type SessionUpdateListener = (updatedScenarioNames?: string[]) => void;
