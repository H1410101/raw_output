
import { describe, it, expect, beforeEach } from "vitest";
import { RankService } from "../RankService";
import { BenchmarkScenario } from "../../data/benchmarks";

// T0=1000, T1=2000...
const mockScenario: BenchmarkScenario = {
    name: "Test Scenario",
    category: "Test",
    subcategory: "Test",
    thresholds: {
        "bronze": 1000,
        "silver": 2000,
        "gold": 3000
    }
};

describe("RankService: Rank Level Logic", () => {
    let rankService: RankService;

    beforeEach(() => {
        rankService = new RankService();
    });

    it("should return Level 0 for Unranked scores (score < T0)", () => {
        // Score 500. T0 is 1000.
        const result = rankService.calculateRank(500, mockScenario);
        expect(result.currentRank).toBe("Unranked");

        // Before update it was -1. Now should be 0.
        expect(result.rankLevel).toBe(0);
    });

    it("should return Level 1 for Bronze (T0 <= score < T1)", () => {
        // Score 1500. T0=1000, T1=2000.
        // Index is 0 (Bronze).
        const result = rankService.calculateRank(1500, mockScenario);
        expect(result.currentRank).toBe("bronze");
        // Before update it was 0. Now should be 1.
        expect(result.rankLevel).toBe(1);
    });

    it("should return Level 2 for Silver (score >= T1)", () => {
        const result = rankService.calculateRank(2500, mockScenario);
        expect(result.currentRank).toBe("silver");
        expect(result.rankLevel).toBe(2);
    });

    it("should return Level 3 for Gold (Highest Rank)", () => {
        const result = rankService.calculateRank(3500, mockScenario);
        expect(result.currentRank).toBe("gold");
        expect(result.rankLevel).toBe(3);
    });
});

describe("RankService: Progress Calculation", () => {
    let rankService: RankService;

    beforeEach(() => {
        rankService = new RankService();
    });

    it("should calculate correct Unranked progress", () => {
        // Score 500. Range 0 to 1000. => 50%
        const result = rankService.calculateRank(500, mockScenario);
        expect(result.progressPercentage).toBe(50);
    });

    it("should calculate correct Ranked progress", () => {
        // Score 1500. Range 1000 to 2000. => 50%
        const result = rankService.calculateRank(1500, mockScenario);
        expect(result.progressPercentage).toBe(50);
    });

    it("should calculate correct Beyond Max progress", () => {
        // Score 3500. Max is 3000. Interval (3000-2000) = 1000.
        // Diff = 500. 500/1000 = 50%.
        const result = rankService.calculateRank(3500, mockScenario);
        expect(result.progressPercentage).toBe(50);
    });

    it("should handle empty thresholds with Level 0", () => {
        const emptyScenario: BenchmarkScenario = { ...mockScenario, thresholds: {} };
        const result = rankService.calculateRank(100, emptyScenario);
        expect(result.currentRank).toBe("Unranked");
        expect(result.rankLevel).toBe(0);
    });
});
