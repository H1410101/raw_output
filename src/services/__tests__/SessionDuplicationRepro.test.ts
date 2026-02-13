import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionService } from "../SessionService";
import { RankService } from "../RankService";
import { SessionSettingsService } from "../SessionSettingsService";
import { BenchmarkScenario } from "../../data/benchmarks";

function createMockService(): SessionService {
    const mockRankService = {
        calculateRank: vi.fn().mockReturnValue({ rankLevel: 1, progressPercentage: 50 })
    } as unknown as RankService;

    const settings = { sessionTimeoutMinutes: 10 };
    const mockSettingsService = {
        subscribe: vi.fn().mockImplementation((callback: (s: typeof settings) => void) => {
            callback(settings);
        })
    } as unknown as SessionSettingsService;

    return new SessionService(mockRankService, mockSettingsService);
}

describe("SessionService Duplication Repro: Reset Behavior", (): void => {
    let service: SessionService;

    beforeEach((): void => {
        vi.useFakeTimers();
        localStorage.clear();
        service = createMockService();
    });

    it("should deduplicate runs even if session was reset", (): void => {
        const startTime = Date.now();
        service.startRankedSession(startTime);

        const run = {
            scenarioName: "Scenario A",
            score: 100,
            scenario: { name: "Scenario A" } as unknown as BenchmarkScenario,
            difficulty: "Medium",
            timestamp: new Date(startTime + 1000)
        };

        service.registerMultipleRuns([run]);
        service.resetSession(false, true);
        service.registerMultipleRuns([run]);

        expect(service.getAllRankedSessionRuns().length).toBe(1);
    });
});

describe("SessionService Duplication Repro: Precision", (): void => {
    let service: SessionService;

    beforeEach((): void => {
        vi.useFakeTimers();
        localStorage.clear();
        service = createMockService();
    });

    it("should deduplicate runs despite ms differences", (): void => {
        const startTime = 1739181600000;
        service.startRankedSession(startTime);

        const liveRun = {
            scenarioName: "Scenario A",
            score: 100,
            scenario: { name: "Scenario A" } as unknown as BenchmarkScenario,
            difficulty: "Medium",
            timestamp: new Date(startTime + 123)
        };

        const fileRun = {
            scenarioName: "Scenario A",
            score: 100,
            scenario: { name: "Scenario A" } as unknown as BenchmarkScenario,
            difficulty: "Medium",
            timestamp: new Date(startTime)
        };

        service.registerMultipleRuns([liveRun]);
        service.registerMultipleRuns([fileRun]);

        expect(service.getAllRankedSessionRuns().length).toBe(1);
    });
});
