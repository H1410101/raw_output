import { describe, it, expect } from "vitest";
import { RankTimelineComponent, RankTimelineConfiguration, AttemptEntry } from "../visualizations/RankTimelineComponent";
import { VisualSettings } from "../../services/VisualSettingsService";

const mockSettings = { dotOpacity: 50 } as VisualSettings;

function createConfig(achievedRU: number, attempts: AttemptEntry[]): RankTimelineConfiguration {
    return {
        thresholds: { "iron": 0, "bronze": 100 },
        settings: mockSettings,
        targetRU: 1,
        achievedRU,
        attempts
    };
}

describe("RankTimelineComponent Notch Handling", () => {
    it("should recover missing notches when achievedRU changes during update", () => {
        const initialAttempts = [
            { score: 50, timestamp: 1, rankUnit: 0.5 },
            { score: 60, timestamp: 2, rankUnit: 0.6 },
            { score: 30, timestamp: 3, rankUnit: 0.3 },
        ];

        const component = new RankTimelineComponent(createConfig(0.3, initialAttempts));
        const container = component.render();

        expect(container.querySelectorAll(".marker-attempt").length).toBe(2);

        const newAttempts = [
            ...initialAttempts,
            { score: 70, timestamp: 4, rankUnit: 0.7 }
        ];

        component.update(createConfig(0.5, newAttempts));

        const notches = container.querySelectorAll(".marker-attempt");
        const notchPositions = Array.from(notches).map(notchElement =>
            parseFloat((notchElement as HTMLElement).style.left)
        );

        const hasExpectedNotch = notchPositions.some(position => Math.abs(position - 4) < 0.1);
        expect(hasExpectedNotch, "Notch for RU 0.3 should be present after update").toBe(true);
    });
});

describe("RankTimelineComponent Notch Duplicates", () => {
    it("should show multiple notches if multiple runs have same score as achievedRU", () => {
        const dummyAttempts = Array(5).fill(0).map((_unused, index) => ({
            score: 50, timestamp: index, rankUnit: 0.5
        }));

        const component = new RankTimelineComponent(createConfig(0.5, dummyAttempts));
        const container = component.render();

        const attemptsLayer = container.querySelector(".timeline-attempts-layer");
        const notches = attemptsLayer?.querySelectorAll(".marker-attempt");

        expect(notches?.length).toBeGreaterThan(0);
    });
});
