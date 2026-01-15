
import { describe, it, expect } from "vitest";
import { RankScaleMapper } from "../visualizations/RankScaleMapper";

describe("RankScaleMapper RU Scaling", () => {
    // T0=1000, T1=1500, T2=2000, T3=2500, T4=3000
    const thresholds = [1000, 1500, 2000, 2500, 3000];
    const mapper = new RankScaleMapper(thresholds, 100);

    it("should map 0 score to 0 RU", () => {
        expect(mapper.calculateRankUnit(0)).toBeCloseTo(0);
    });

    it("should map T0 score (1000) to 1 RU", () => {
        expect(mapper.calculateRankUnit(1000)).toBeCloseTo(1);
    });

    it("should map Unranked midpoint (500) to 0.5 RU", () => {
        expect(mapper.calculateRankUnit(500)).toBeCloseTo(0.5);
    });

    it("should map Standard Case T1 (1500) to 2 RU", () => {
        // T0=1000 (RU 1), T1=1500 (RU 2)
        expect(mapper.calculateRankUnit(1500)).toBeCloseTo(2);
    });

    it("should map Standard Midpoint (1250) to 1.5 RU", () => {
        expect(mapper.calculateRankUnit(1250)).toBeCloseTo(1.5);
    });

    it("should map Max Threshold (3000) to 5 RU (Index 4 + 1)", () => {
        expect(mapper.calculateRankUnit(3000)).toBeCloseTo(5);
    });

    it("should map Above Rank (3500) to 6 RU", () => {
        // T4-T3 = 500.
        // 3000 -> 5. 3500 -> 3000 + 500 -> 5 + 1 = 6.
        expect(mapper.calculateRankUnit(3500)).toBeCloseTo(6);
    });

    it("should map Below Rank Negative Score (-500) to -0.5 RU", () => {
        // -500 / 1000 = -0.5
        expect(mapper.calculateRankUnit(-500)).toBeCloseTo(-0.5);
    });
});
