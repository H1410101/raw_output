/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { describe, it, expect } from "vitest";
import { SummaryTimelineComponent, SummaryTimelineConfiguration } from "../visualizations/SummaryTimelineComponent";
import { VisualSettings } from "../../services/VisualSettingsService";

describe("SummaryTimelineComponent Logic", () => {
    const mockSettings = {} as VisualSettings;
    const mockThresholds = {
        "Iron": 0,
        "Bronze": 100,
        "Silver": 200
    };

    it("should render ticks at 0.2 increments", () => {
        const config: SummaryTimelineConfiguration = {
            scenarioName: "Test Scenario",
            thresholds: mockThresholds,
            settings: mockSettings,
            oldRU: 2.0,
            newRU: 2.5,
            gain: 50,
            oldRankName: "Bronze",
            newRankName: "Silver",
            oldProgress: 0,
            newProgress: 50,
            totalSecondsSpent: 60,
            attempts: 1
        };

        const component = new SummaryTimelineComponent(config);
        const container = component.render();

        // Access the scroller where ticks are rendered
        // The render method sets up the initial state but relies on helper methods for content
        // _renderScrollerContents is called during render()

        const scroller = container.querySelector(".summary-timeline-scroller");
        expect(scroller).toBeTruthy();

        const ticks = scroller?.querySelectorAll(".summary-timeline-tick");
        expect(ticks?.length).toBeGreaterThan(0);

        // We expect mostly minor ticks (4 minor for every 1 major)
        const minorTicks = scroller?.querySelectorAll(".summary-timeline-tick.minor");
        const majorTicks = Array.from(ticks || []).filter(tick => !tick.classList.contains("minor"));

        expect(minorTicks!.length).toBeGreaterThan(majorTicks.length);

        // Check ratio roughly
        // Ideally 4:1 but boundaries might affect it slightly
        const ratio = minorTicks!.length / majorTicks.length;
        expect(ratio).toBeGreaterThan(3);
        expect(ratio).toBeLessThan(5);
    });

    it("should render notches with correct classes", () => {
        const config: SummaryTimelineConfiguration = {
            scenarioName: "Test Scenario",
            thresholds: mockThresholds,
            settings: mockSettings,
            oldRU: 2.0,
            newRU: 2.5,
            gain: 50,
            oldRankName: "Bronze",
            newRankName: "Silver",
            oldProgress: 0,
            newProgress: 50,
            totalSecondsSpent: 60,
            attempts: 1
        };

        const component = new SummaryTimelineComponent(config);
        const container = component.render();

        const oldNotch = container.querySelector(".summary-timeline-marker-notch.old");
        const newNotch = container.querySelector(".summary-timeline-marker-notch.new");

        expect(oldNotch).toBeTruthy();
        expect(newNotch).toBeTruthy();
    });
});
