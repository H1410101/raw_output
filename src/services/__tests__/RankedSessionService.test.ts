import { describe, it, expect, beforeEach, vi } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioIdentity } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";

// Mocks
const mockBenchmarkService = {
    getScenarios: vi.fn(),
} as unknown as BenchmarkService;

const mockSessionService = {
    setIsRanked: vi.fn(),
    onSessionUpdated: vi.fn(),
} as unknown as SessionService;

const mockRankEstimator = {
    getScenarioIdentity: vi.fn(),
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
                { name: "Scen_Tracking_1", category: "Reactive Tracking", subcategory: "s1", thresholds: {} },
                { name: "Scen_Clicking_1", category: "Dynamic Clicking", subcategory: "s2", thresholds: {} }, // Strong (High Gap)
                { name: "Scen_Flick_1", category: "Flick Tech", subcategory: "s3", thresholds: {} }, // Weak 1
                { name: "Scen_Control_1", category: "Control Tracking", subcategory: "s4", thresholds: {} }, // Weak 2
                { name: "Scen_Tracking_2", category: "Reactive Tracking", subcategory: "s5", thresholds: {} },
            ];

            (mockBenchmarkService.getScenarios as any).mockReturnValue(scenarios);

            // Setup Identities for logic
            // Target:
            // Strong: Clustering_1 (Gap 2.0)
            // Weak 1: Flick_1 (Current 0.0)
            // Weak 2: Control_1 (Current 1.0)

            const identities: Record<string, Partial<ScenarioIdentity>> = {
                "Scen_Tracking_1": { continuousValue: 2.0, highestAchieved: 2.0 }, // Stable
                "Scen_Clicking_1": { continuousValue: 1.0, highestAchieved: 3.0 }, // Big Gap (2.0) -> Strong Slot
                "Scen_Flick_1": { continuousValue: 0.0, highestAchieved: 0.0 }, // Absolute Weakest -> Weak Slot 1
                "Scen_Control_1": { continuousValue: 0.5, highestAchieved: 0.5 }, // Second Weakest -> Weak Slot 2
                "Scen_Tracking_2": { continuousValue: 2.5, highestAchieved: 2.5 },
            };

            (mockRankEstimator.getScenarioIdentity as any).mockImplementation((name: string) => {
                return identities[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "" };
            });

            service.startSession("Gold");

            const state = service.state;
            expect(state.status).toBe("ACTIVE");
            expect(state.sequence).toHaveLength(3);

            // Verify Slots
            // Slot 1: Strong (Max Gap) -> Scen_Clicking_1
            // Slot 2: Weak (Min Strength) -> Scen_Flick_1 (0.0)
            // Slot 3: Weak 2 (Next Min Strength) -> Scen_Control_1 (0.5)

            expect(state.sequence[0]).toBe("Scen_Clicking_1");

            // The weak slots might be swapped or jittered, but Flick and Control are the lowest.
            const weaks = state.sequence.slice(1);
            expect(weaks).toContain("Scen_Flick_1");
            expect(weaks).toContain("Scen_Control_1");
        });

        it("should handle diversity check (swap slot 3 if category collision)", () => {
            // Setup scenarios with collision potential
            const scenarios: BenchmarkScenario[] = [
                { name: "Target_Strong", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
                { name: "Weak_Track_1", category: "Reactive Tracking", subcategory: "s2", thresholds: {} }, // Weakest
                { name: "Weak_Track_2", category: "Reactive Tracking", subcategory: "s3", thresholds: {} }, // 2nd Weakest (Collision!)
                { name: "Weak_Flick_1", category: "Flick Tech", subcategory: "s4", thresholds: {} }, // 3rd Weakest (Swap Target)
            ];

            (mockBenchmarkService.getScenarios as any).mockReturnValue(scenarios);

            const identities: Record<string, Partial<ScenarioIdentity>> = {
                "Target_Strong": { continuousValue: 1.0, highestAchieved: 3.0 }, // Gap 2
                "Weak_Track_1": { continuousValue: 0.1, highestAchieved: 0.1 },
                "Weak_Track_2": { continuousValue: 0.2, highestAchieved: 0.2 },
                "Weak_Flick_1": { continuousValue: 0.25, highestAchieved: 0.25 }, // Close enough to swap (< 1.0 diff)
            };

            (mockRankEstimator.getScenarioIdentity as any).mockImplementation((name: string) => {
                return identities[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "" };
            });

            service.startSession("Gold");
            const seq = service.state.sequence;

            expect(seq[0]).toBe("Target_Strong");
            expect(seq[1]).toBe("Weak_Track_1");
            // Should have swapped Weak_Track_2 with Weak_Flick_1 to avoid double Tracking
            expect(seq[2]).toBe("Weak_Flick_1");
        });
    });
});
