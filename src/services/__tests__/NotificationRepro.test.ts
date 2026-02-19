
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionService } from "../SessionService";
import { RankService } from "../RankService";
import { SessionSettingsService } from "../SessionSettingsService";
import { BenchmarkScenario } from "../../data/benchmarks";
import { IdentityService } from "../IdentityService";

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

    const mockIdentityService = {
        getKovaaksUsername: vi.fn().mockReturnValue("testuser"),
        onProfilesChanged: vi.fn()
    } as unknown as IdentityService;

    return new SessionService(mockRankService, mockSettingsService, mockIdentityService);
}

describe("SessionService Notification Logic", (): void => {
    let service: SessionService;

    beforeEach((): void => {
        vi.useFakeTimers();
        localStorage.clear();
        service = createMockService();
    });

    it("should NOT notify if registering only duplicate runs", (): void => {
        const startTime = Date.now();
        const run = {
            scenarioName: "Scenario A",
            score: 100,
            scenario: { name: "Scenario A" } as unknown as BenchmarkScenario,
            difficulty: "Medium",
            timestamp: new Date(startTime)
        };

        service.registerMultipleRuns([run]);

        const listener = vi.fn();
        service.onSessionUpdated(listener);

        // Register the same run again
        service.registerMultipleRuns([run]);

        // This expectation is likely to FAIL currently, which confirms the issue
        expect(listener).not.toHaveBeenCalled();
    });

    it("should NOT notify if registering an empty list of runs", (): void => {
        const listener = vi.fn();
        service.onSessionUpdated(listener);

        service.registerMultipleRuns([]);

        // This expectation is also likely to FAIL currently
        expect(listener).not.toHaveBeenCalled();
    });
});
