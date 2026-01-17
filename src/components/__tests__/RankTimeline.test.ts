/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from "vitest";
import { RankTimelineComponent, RankTimelineConfiguration } from "../visualizations/RankTimelineComponent";
import { VisualSettings } from "../../services/VisualSettingsService";

describe("RankTimelineComponent Logic", () => {
    // Mock settings
    const mockSettings = {} as VisualSettings;
    const mockThresholds = {
        "Iron": 0,
        "Bronze": 100,
        "Silver": 200,
        "Gold": 300,
        "Platinum": 400
    };

    it("should show 7.5 ranks standard window", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2.0,
            achievedRU: 2.0
        };
        const component = new RankTimelineComponent(config);
        const ranges = (component as any)._calculateViewBounds();

        // Center should be 2.0. Window 7.5.
        // Min: 2.0 - 3.75 = -1.75
        // Max: 2.0 + 3.75 = 5.75
        expect(ranges.minRU).toBeCloseTo(-1.75);
        expect(ranges.maxRU).toBeCloseTo(5.75);
    });

    it("should clamp achieved notch at 70% when achieved is far ahead", () => {
        // Target 0. Achieved 25.
        // Window 7.5. Clamp at 70%.
        // 0.7 * 7.5 = 5.25.
        // MinRU should be Achieved - 5.25 = 19.75.

        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 0,
            achievedRU: 25
        };
        const component = new RankTimelineComponent(config);
        const ranges = (component as any)._calculateViewBounds();

        expect(ranges.minRU).toBeCloseTo(19.75);
        expect(ranges.maxRU).toBeCloseTo(27.25);

        // Verify achieved is exactly at 70%
        const achievedRelative = 25 - ranges.minRU;
        expect(achievedRelative / 7.5).toBeCloseTo(0.7);
    });

    it("should detect offscreen target when clamped", () => {
        // Target 0. Achieved 10.
        // Window 7.5. Clamp at 70%.
        // 0.7 * 7.5 = 5.25.
        // MinRU = 10 - 5.25 = 4.75.
        // Target (0). Range 7.5.
        // tPct = (0 - 4.75) / 7.5 = -63%.
        // -63% < 25% -> Snapped.

        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 0,
            achievedRU: 10
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        // Check for caret via class
        const caret = container.querySelector(".timeline-caret");
        expect(caret).toBeTruthy();

        // Check for "TARGET" anchor snapped to 25%
        const targetAnchor = container.querySelector(".anchor-target") as HTMLElement;
        expect(targetAnchor).toBeTruthy();
        expect(targetAnchor.style.left).toBe("25%");
    });

    it("should NOT clamp if achieved is close to target", () => {
        // Target 2, Achieved 3. 
        // Center 2.5. Window 7.5. Min -1.25.
        // Achieved relative: 3 - (-1.25) = 4.25.
        // 4.25 / 7.5 = 0.566... (56.6%). This is <= 70%.
        // So standard centering applies.

        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 3
        };
        const component = new RankTimelineComponent(config);
        const ranges = (component as any)._calculateViewBounds();

        expect(ranges.minRU).toBeCloseTo(-1.25);
    });
    it("should render attempt notches instead of dots", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: { dotOpacity: 50 } as VisualSettings,
            targetRU: 2,
            achievedRU: 3,
            attemptsRU: [2.5, 2.7]
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const notches = container.querySelectorAll(".marker-attempt");
        expect(notches.length).toBe(2);
        expect((notches[0] as HTMLElement).style.opacity).toBe("0.5");
    });
    it("should have anchors follow notches when overlapping", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 2
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const markers = container.querySelectorAll(".timeline-marker");
        const anchors = container.querySelectorAll(".timeline-marker-anchor");

        // Everything should be at 50%
        expect((markers[0] as HTMLElement).style.left).toBe("50%");
        expect((markers[1] as HTMLElement).style.left).toBe("50%");

        expect((anchors[0] as HTMLElement).style.left).toBe("50%");
        expect((anchors[1] as HTMLElement).style.left).toBe("50%");
    });

    it("should resolve collisions by shifting labels in the DOM", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 2
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();
        container.style.width = "1000px";

        document.body.appendChild(container);

        component.resolveCollisions();

        const labels = container.querySelectorAll(".timeline-marker-label");
        expect((labels[0] as HTMLElement).style.transform).toContain("translateX");
        expect((labels[1] as HTMLElement).style.transform).toContain("translateX");

        // Cleanup
        document.body.removeChild(container);
    });

    it("should render the progress line between target and expected", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 4,
            expectedRU: 3
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const progressLine = container.querySelector(".timeline-progress-line") as HTMLElement;
        expect(progressLine).toBeTruthy();

        // Window is 7.5, center is (2+4)/2 = 3. 
        // MinRU = 3 - 3.75 = -0.75.
        // tPct (target=2): (2 - (-0.75)) / 7.5 = 2.75 / 7.5 = 36.666...%
        // ePct (expected=3): (3 - (-0.75)) / 7.5 = 3.75 / 7.5 = 50%
        expect(parseFloat(progressLine.style.left)).toBeCloseTo(36.66, 1);
        expect(parseFloat(progressLine.style.width)).toBeCloseTo(13.33, 1);
    });

    it("should render notches for all runs, highlighting top 3", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 2,
            // Top 3 are 5, 4, 3
            attemptsRU: [1, 2, 3, 4, 5]
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const allNotches = container.querySelectorAll(".marker-attempt");
        expect(allNotches.length).toBe(5);

        const accentNotches = container.querySelectorAll(".marker-attempt:not(.secondary)");
        // Should have 3 accent notches for 5, 4, 3
        expect(accentNotches.length).toBe(3);

        const secondaryNotches = container.querySelectorAll(".marker-attempt.secondary");
        // Should have 2 secondary notches for 2, 1
        expect(secondaryNotches.length).toBe(2);
    });
});
