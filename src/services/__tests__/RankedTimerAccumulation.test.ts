import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator } from "../RankEstimator";
import { SessionSettingsService } from "../SessionSettingsService";

interface MockServices {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
    settings: SessionSettingsService;
}

function createMocks(): MockServices {
    return {
        benchmark: {
            getScenarios: vi.fn().mockReturnValue([
                { name: "Scenario A", category: "Cat1", subcategory: "Sub1", thresholds: {} },
                { name: "Scenario B", category: "Cat2", subcategory: "Sub2", thresholds: {} },
                { name: "Scenario C", category: "Cat3", subcategory: "Sub3", thresholds: {} },
            ]),
        } as unknown as BenchmarkService,
        session: {
            startRankedSession: vi.fn(),
            stopRankedSession: vi.fn(),
            onSessionUpdated: vi.fn(),
            getAllRankedSessionRuns: vi.fn().mockReturnValue([]),
            getAllRankedScenarioBests: vi.fn().mockReturnValue([]),
        } as unknown as SessionService,
        estimator: {
            getScenarioEstimate: vi.fn().mockReturnValue({ continuousValue: 1.0, highestAchieved: 1.0 }),
            recordPlay: vi.fn(),
            getScenarioContinuousValue: vi.fn().mockReturnValue(1.0),
            evolveScenarioEstimate: vi.fn(),
        } as unknown as RankEstimator,
        settings: {
            getSettings: vi.fn().mockReturnValue({ rankedIntervalMinutes: 60 }),
        } as unknown as SessionSettingsService,
    };
}

describe("Ranked Timer: Accumulation", (): void => {
    let service: RankedSessionService;
    beforeEach((): void => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-20T10:00:00Z"));
        const mocks = createMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    afterEach((): void => {
        vi.useRealTimers();
        localStorage.clear();
    });
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
});

describe("Ranked Timer: Reset", (): void => {
    let service: RankedSessionService;
    beforeEach((): void => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-20T10:00:00Z"));
        const mocks = createMocks();
        service = new RankedSessionService(mocks.benchmark, mocks.session, mocks.estimator, mocks.settings);
    });
    afterEach((): void => {
        vi.useRealTimers();
        localStorage.clear();
    });
    it("should reset scenario timers between distinct runs", (): void => {
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

