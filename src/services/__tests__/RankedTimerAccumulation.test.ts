import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator } from "../RankEstimator";
import { SessionSettingsService } from "../SessionSettingsService";
import { IdentityService } from "../IdentityService";

interface MockServices {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
    settings: SessionSettingsService;
    identity: IdentityService;
}

function _createBenchmarkMock(): BenchmarkService {
    return {
        getScenarios: vi.fn().mockReturnValue([
            { name: "Scenario A", category: "Cat1", subcategory: "Sub1", thresholds: {} },
            { name: "Scenario B", category: "Cat2", subcategory: "Sub2", thresholds: {} },
            { name: "Scenario C", category: "Cat3", subcategory: "Sub3", thresholds: {} },
        ]),
        getRankNames: vi.fn().mockReturnValue(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]),
    } as unknown as BenchmarkService;
}

function _createSessionMock(): SessionService {
    return {
        startRankedSession: vi.fn(),
        stopRankedSession: vi.fn(),
        onSessionUpdated: vi.fn(),
        getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
        getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
        getRankedScenarioBest: vi.fn().mockReturnValue({}),
        setRankedPlaylist: vi.fn(),
    } as unknown as SessionService;
}

function _createEstimatorMock(): RankEstimator {
    return {
        getScenarioEstimate: vi.fn().mockReturnValue({
            continuousValue: 1.0,
            highestAchieved: 1.0,
            lastUpdated: "",
            penalty: 0,
            lastPlayed: "",
            lastDecayed: ""
        }),
        recordPlay: vi.fn(),
        getScenarioContinuousValue: vi.fn().mockReturnValue(1.0),
        evolveScenarioEstimate: vi.fn(),
        initializePeakRanks: vi.fn(),
        applyPenaltyLift: vi.fn(),
    } as unknown as RankEstimator;
}

function createMocks(): MockServices {
    return {
        benchmark: _createBenchmarkMock(),
        session: _createSessionMock(),
        estimator: _createEstimatorMock(),
        settings: {
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
        } as unknown as SessionSettingsService,
        identity: {
            getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
            onProfilesChanged: vi.fn()
        } as unknown as IdentityService,
    };
}

let service: RankedSessionService;

function setupService(): void {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-20T10:00:00Z"));
    const mocks = createMocks();
    service = new RankedSessionService({
        benchmarkService: mocks.benchmark,
        sessionService: mocks.session,
        rankEstimator: mocks.estimator,
        sessionSettings: mocks.settings,
        identityService: mocks.identity
    });
}

function teardownService(): void {
    vi.useRealTimers();
    localStorage.clear();
}

describe("Ranked Timer Core", (): void => {
    beforeEach(setupService);
    afterEach(teardownService);

    it("should accumulate scenario time across multiple visits", (): void => {
        service.startSession("Gold");
        vi.advanceTimersByTime(30000);
        expect(service.scenarioElapsedSeconds).toBe(30);
        service.advance();
        expect(service.scenarioElapsedSeconds).toBe(0);
        vi.advanceTimersByTime(10000);
        expect(service.scenarioElapsedSeconds).toBe(10);
        service.retreat();
        expect(service.scenarioElapsedSeconds).toBe(30);
    });

    it("should start scenario timer immediately upon resumption", (): void => {
        service.startSession("Gold");
        service.endSession();
        service.reset();

        // Resume session
        service.startSession("Gold");
        vi.advanceTimersByTime(15000);
        expect(service.scenarioElapsedSeconds).toBe(15);
    });
});

describe("Ranked Timer Persistence", (): void => {
    beforeEach(setupService);
    afterEach(teardownService);

    it("should reset scenario timers between distinct runs", (): void => {
        const mocks = createMocks();
        const runData = [{ scenarioName: "Scenario A", score: 100, timestamp: Date.now() + 1000 }];
        (mocks.session.getAllRankedSessionRuns as Mock).mockReturnValue(runData);

        service = new RankedSessionService({
            benchmarkService: mocks.benchmark,
            sessionService: mocks.session,
            rankEstimator: mocks.estimator,
            sessionSettings: mocks.settings,
            identityService: mocks.identity
        });

        service.startSession("Gold");
        vi.advanceTimersByTime(60000);
        service.advance();
        service.advance();
        service.advance();
        service.endSession();
        expect(service.state.accumulatedScenarioSeconds["Scenario A"]).toBe(60);
        service.reset();
        service.startSession("Gold");
        expect(service.state.currentIndex).toBe(0);
        expect(service.scenarioElapsedSeconds).toBe(0);
    });
});
