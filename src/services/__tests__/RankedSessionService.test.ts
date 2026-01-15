import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { RankedSessionService } from "../RankedSessionService";
import { BenchmarkService } from "../BenchmarkService";
import { SessionService } from "../SessionService";
import { RankEstimator, ScenarioEstimate } from "../RankEstimator";
import { BenchmarkScenario } from "../../data/benchmarks";

interface MockSet {
    benchmark: BenchmarkService;
    session: SessionService;
    estimator: RankEstimator;
}

describe("RankedSessionService: Lifecycle", (): void => {
    let service: RankedSessionService;
    let mocks: MockSet;

    beforeEach((): void => {
        mocks = _createMocks();
        service = new RankedSessionService(
            mocks.benchmark,
            mocks.session,
            mocks.estimator
        );
    });

    it("should generate a sequence of 3 scenarios using Strong-Weak-Mid logic", (): void => {
        const scenarios: BenchmarkScenario[] = _createDiversePool();
        const estimates: Record<string, Partial<ScenarioEstimate>> = _createDiverseEstimates();

        (mocks.benchmark.getScenarios as Mock).mockReturnValue(scenarios);
        _mockEstimates(mocks.estimator, estimates);

        service.startSession("Gold");

        _assertDiverseSequence(service.state.sequence);
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

function _createMocks(): MockSet {
    vi.clearAllMocks();
    localStorage.clear();

    return {
        benchmark: { getScenarios: vi.fn() } as unknown as BenchmarkService,
        session: {
            setIsRanked: vi.fn(),
            onSessionUpdated: vi.fn(),
            getAllScenarioSessionBests: vi.fn().mockReturnValue([]),
        } as unknown as SessionService,
        estimator: { getScenarioEstimate: vi.fn() } as unknown as RankEstimator
    };
}

function _mockEstimates(estimator: RankEstimator, estimates: Record<string, Partial<ScenarioEstimate>>): void {
    (estimator.getScenarioEstimate as Mock).mockImplementation((name: string) => {
        return estimates[name] || { continuousValue: -1, highestAchieved: -1, lastUpdated: "" };
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
    // Slot 1: Strong (Max Gap). Gap: Clicking (2.0), others 0.
    expect(sequence[0]).toBe("scenClicking1");

    const remainder: string[] = sequence.slice(1);
    // Slot 2: Weak (Min Score). Flick (0), Control (0.5), Track1 (2), Track2 (2.5).
    // Min is Flick (0).
    expect(remainder).toContain("scenFlick1");

    // Slot 3: Mid (Max Gap - Penalty).
    // Remaining: Control (Gap 0), Track1 (Gap 0), Track2 (Gap 0).
    // Penalties: Categories differ from Clicking and Flick.
    // So all 0. Picks first available: scenTracking1.
    expect(remainder).toContain("scenTracking1");
}

function _createCollidingPool(): BenchmarkScenario[] {
    return [
        { name: "targetStrong", category: "Dynamic Clicking", subcategory: "s1", thresholds: {} },
        { name: "weakTrack1", category: "Reactive Tracking", subcategory: "s2", thresholds: {} },
        { name: "weakTrack2", category: "Reactive Tracking", subcategory: "s3", thresholds: {} },
        { name: "weakFlick1", category: "Flick Tech", subcategory: "s4", thresholds: {} },
    ];
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
    expect(sequence[0]).toBe("targetStrong");
    expect(sequence[1]).toBe("weakTrack1");
    expect(sequence[2]).toBe("weakFlick1");
}
