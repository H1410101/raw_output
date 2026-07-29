/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { afterEach, describe, it, expect, vi } from "vitest";
import { SummaryTimelineComponent, SummaryTimelineConfiguration } from "../visualizations/SummaryTimelineComponent";
import { VisualSettings } from "../../services/VisualSettingsService";

describe("SummaryTimelineComponent Logic", () => {
    const mockSettings = {} as VisualSettings;
    const mockThresholds = {
        "Iron": 0,
        "Bronze": 100,
        "Silver": 200
    };

    afterEach((): void => {
        vi.useRealTimers();
    });

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

    it("preserves characterized finite positions and tick count", (): void => {
        const component = new SummaryTimelineComponent(_createConfig(mockSettings, mockThresholds));
        const container: HTMLElement = component.render();

        expect(container.querySelectorAll(".summary-timeline-tick")).toHaveLength(19);
        expect(container.querySelector<HTMLElement>(".summary-timeline-progress")?.style.left)
            .toBe("50%");
        expect(container.querySelector<HTMLElement>(".summary-timeline-label-anchor.top.new")?.style.left)
            .toBe("70%");
    });

    it("commits each render with replaceChildren once", (): void => {
        const component = new SummaryTimelineComponent(_createConfig(mockSettings, mockThresholds));
        const container: HTMLElement = component.render();
        const replaceChildren = vi.spyOn(container, "replaceChildren");

        component.render();

        expect(replaceChildren).toHaveBeenCalledTimes(1);
        expect(container.querySelectorAll(".summary-timeline-track")).toHaveLength(1);
    });

    it("rejects non-finite rank units", (): void => {
        [Infinity, -Infinity, Number.NaN].forEach((rankUnit: number): void => {
            expect((): SummaryTimelineComponent => new SummaryTimelineComponent(
                _createConfig(mockSettings, mockThresholds, { oldRU: rankUnit }),
            )).toThrow(RangeError);
            expect((): SummaryTimelineComponent => new SummaryTimelineComponent(
                _createConfig(mockSettings, mockThresholds, { newRU: rankUnit }),
            )).toThrow(RangeError);
        });
    });

    it("does not loop when finite rank arithmetic overflows", (): void => {
        const component = new SummaryTimelineComponent(
            _createConfig(mockSettings, mockThresholds, {
                oldRU: Number.MAX_VALUE,
                newRU: Number.MAX_VALUE,
            }),
        );

        expect((): HTMLElement => component.render()).not.toThrow();
        expect(component.render().querySelectorAll(".summary-timeline-tick")).toHaveLength(0);
    });

    it("does not apply a timeout from a replaced render", (): void => {
        vi.useFakeTimers();
        const component = new SummaryTimelineComponent(_createConfig(mockSettings, mockThresholds));
        component.render();
        component.play();

        const container: HTMLElement = component.render();
        vi.advanceTimersByTime(1500);

        expect(container.querySelector<HTMLElement>(".summary-timeline-delta")?.style.opacity)
            .toBe("0");
    });
});

function _createConfig(
    settings: VisualSettings,
    thresholds: Record<string, number>,
    overrides: Partial<SummaryTimelineConfiguration> = {},
): SummaryTimelineConfiguration {
    return {
        scenarioName: "Test Scenario",
        thresholds,
        settings,
        oldRU: 2,
        newRU: 2.5,
        gain: 50,
        oldRankName: "Bronze",
        newRankName: "Silver",
        oldProgress: 0,
        newProgress: 50,
        totalSecondsSpent: 60,
        attempts: 1,
        ...overrides,
    };
}
