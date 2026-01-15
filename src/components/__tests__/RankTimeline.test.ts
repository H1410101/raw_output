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

        // Check for "TARGET" label snapped to 25%
        const targetLabel = Array.from(container.querySelectorAll(".label-target")).find(element => element.textContent === "TARGET") as HTMLElement;
        expect(targetLabel).toBeTruthy();
        expect(targetLabel.style.left).toBe("25%");
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
});
