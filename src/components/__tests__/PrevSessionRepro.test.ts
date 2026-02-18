/* eslint-disable @typescript-eslint/naming-convention, max-lines-per-function */
import { describe, it, expect } from "vitest";
import { RankTimelineComponent, RankTimelineConfiguration } from "../visualizations/RankTimelineComponent";
import { VisualSettings } from "../../services/VisualSettingsService";

describe("RankTimelineComponent Prev Session Check", () => {
    const mockSettings = {} as VisualSettings;
    const mockThresholds = { "Iron": 0, "Bronze": 100 };

    it("should NOT render prev session notch when prevSessionRU is undefined", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 1,
            achievedRU: 1,
            // prevSessionRU is omitted (undefined)
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();
        const prevNotch = container.querySelector(".marker-prev");
        const prevAnchor = container.querySelector(".anchor-prev");

        expect(prevNotch).not.toBeNull();
        expect(prevAnchor).not.toBeNull();

        expect((prevNotch as HTMLElement).style.opacity).toBe("0");
        expect((prevAnchor as HTMLElement).style.opacity).toBe("0");
    });

    it("should render prev session notch when prevSessionRU is provided", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 1,
            achievedRU: 1,
            prevSessionRU: 0.5
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const prevNotch = container.querySelector(".marker-prev");
        expect(prevNotch).not.toBeNull();
    });
});
