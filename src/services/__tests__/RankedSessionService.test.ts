import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioRankEstimate } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";

// Mocks
const mockBenchmarkService = {
    getScenarios: vi.fn(),
} as unknown as BenchmarkService;

const mockSessionService = {
    setIsRanked: vi.fn(),
    onSessionUpdated: vi.fn(),
    getAllScenarioSessionBests: vi.fn().mockReturnValue([]),
} as unknown as SessionService;

const mockRankEstimator = {
    getScenarioRankEstimate: vi.fn(),
} as unknown as RankEstimator;

describe("RankedSessionService", () => {
    let service: RankedSessionService;

    beforeEach(() => {
        vi.clearAllMocks();

        // Clear local storage
        localStorage.clear();

        service = new RankedSessionService(
            mockBenchmarkService,
            mockSessionService,
            mockRankEstimator
        );
    });

    describe("startSession", () => {
        it("should generate a sequence of 3 scenarios using Strong-Weak-Weak logic", () => {
            // Setup scenarios
            const scenarios: BenchmarkScenario[] = [
                { name: "scenTracking1", category: "Reactive Tracking", subcategory: "s1", thresholds: {} },
                { name: "scenClicking1", category: "Dynamic Clicking", subcategory: "s2", thresholds: {} },
                { name: "scenFlick1", category: "Flick Tech", subcategory: "s3", thresholds: {} },
                { name: "scenControl1", category: "Control Tracking", subcategory: "s4", thresholds: {} },
                { name: "scenTracking2", category: "Reactive Tracking", subcategory: "s5", thresholds: {} },
            ];

            (mockBenchmarkService.getScenarios as Mock).mockReturnValue(scenarios);

            // Setup Rank Estimates
            const identities: Record<string, Partial<ScenarioRankEstimate>> = {
                "scenTracking1": { continuousValue: 2.0, highestAchieved: 2.0 },
                "scenClicking1": { continuousValue: 1.0, highestAchieved: 3.0 },
                "scenFlick1": { continuousValue: 0.0, highestAchieved: 0.0 },
                "scenControl1": { continuousValue: 0.5, highestAchieved: 0.5 },
                "scenTracking2": { continuousValue: 2.5, highestAchieved: 2.5 },
            };

            (mockRankEstimator.getScenarioRankEstimate as Mock).mockImplementation((name: string) => {
                return identities[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "" };
            });

            service.startSession("Gold");

            const state = service.state;
            expect(state.status).toBe("ACTIVE");
            expect(state.sequence).toHaveLength(3);

            // Slot 1: Strong (Max Gap). Gap: Clicking (2.0), others 0.
            expect(state.sequence[0]).toBe("scenClicking1");

            const weaks = state.sequence.slice(1);
            expect(weaks).toContain("scenFlick1");
            expect(weaks).toContain("scenControl1");
        });

        it("should handle diversity check (swap slot 3 if category collision)", () => {
            // Setup scenarios with collision potential
            const scenarios: BenchmarkScenario[] = [
                { name: "targetStrong", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
                { name: "weakTrack1", category: "Reactive Tracking", subcategory: "s2", thresholds: {} },
                { name: "weakTrack2", category: "Reactive Tracking", subcategory: "s3", thresholds: {} },
                { name: "weakFlick1", category: "Flick Tech", subcategory: "s4", thresholds: {} },
            ];

            (mockBenchmarkService.getScenarios as Mock).mockReturnValue(scenarios);

            const identities: Record<string, Partial<ScenarioRankEstimate>> = {
                "targetStrong": { continuousValue: 1.0, highestAchieved: 3.0 },
                "weakTrack1": { continuousValue: 0.1, highestAchieved: 0.1 },
                "weakTrack2": { continuousValue: 0.2, highestAchieved: 0.2 },
                "weakFlick1": { continuousValue: 0.25, highestAchieved: 0.25 },
            };

            (mockRankEstimator.getScenarioRankEstimate as Mock).mockImplementation((name: string) => {
                return identities[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "" };
            });

            service.startSession("Gold");
            const seq = service.state.sequence;

            expect(seq[0]).toBe("targetStrong");
            expect(seq[1]).toBe("weakTrack1");
            expect(seq[2]).toBe("weakFlick1");
        });
    });
});
