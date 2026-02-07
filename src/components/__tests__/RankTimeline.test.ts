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

        // With target off-screen, we focus on centering Achieved (25) or aligning to 80%.
        // minCenteredAchieved = 25 - 0.5 * 7.5 = 21.25.
        // minRightAlignedHighest = 25 - 0.8 * 7.5 = 19.0.
        // Math.min(21.25, 19.0) = 19.0 (leftmost).
        expect(ranges.minRU).toBeCloseTo(19.0);
        expect(ranges.maxRU).toBeCloseTo(26.5);

        // Verify achieved is at exactly 80% (aligned correctly for leftmost view)
        const achievedRelative = 25 - ranges.minRU;
        expect(achievedRelative / 7.5).toBeCloseTo(0.8);
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

        // Check for "TARGET" anchor snapped to 20% (Window Start)
        const targetAnchor = container.querySelector(".anchor-target.offscreen") as HTMLElement;
        expect(targetAnchor).toBeTruthy();
        expect(targetAnchor.style.left).toBe("20%");
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
            attempts: [
                { score: 250, timestamp: Date.now(), rankUnit: 2.5 },
                { score: 270, timestamp: Date.now(), rankUnit: 2.7 }
            ]
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

        // TargetRU 2, AchievedRU 2. Window 7.5.
        // ABSOLUTE Position: 2 * (100 / 7.5) = 26.66%.
        // The scroller will be translated by -minRU to center this at 50%.
        expect(parseFloat((markers[0] as HTMLElement).style.left)).toBeCloseTo(26.66, 1);
        expect(parseFloat((markers[1] as HTMLElement).style.left)).toBeCloseTo(26.66, 1);

        expect(parseFloat((anchors[0] as HTMLElement).style.left)).toBeCloseTo(26.66, 1);
        expect(parseFloat((anchors[1] as HTMLElement).style.left)).toBeCloseTo(26.66, 1);

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

        const labels = Array.from(container.querySelectorAll(".timeline-marker-label")) as HTMLElement[];
        const someShifted = labels.some(label => label.style.transform.includes("translateX"));
        expect(someShifted).toBe(true);

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

        // Position is now relative to RU 0. 
        // targetRU=2: 2 * (100 / 7.5) = 26.66%
        // expectedRU=3: 3 * (100 / 7.5) = 40%
        // width: 1 * (100 / 7.5) = 13.33%
        expect(parseFloat(progressLine.style.left)).toBeCloseTo(26.66, 1);
        expect(parseFloat(progressLine.style.width)).toBeCloseTo(13.33, 1);

    });

    it("should render notches for all runs, highlighting top 3, skipping achieved redundant", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 2,
            // Top 3 are 5, 4, 3
            attempts: [
                { score: 100, timestamp: Date.now(), rankUnit: 1 },
                // Matches achievedRU, should be skipped
                { score: 200, timestamp: Date.now(), rankUnit: 2 },
                { score: 300, timestamp: Date.now(), rankUnit: 3 },
                { score: 400, timestamp: Date.now(), rankUnit: 4 },
                { score: 500, timestamp: Date.now(), rankUnit: 5 }
            ]
        };
        const component = new RankTimelineComponent(config);
        const container = component.render();

        const allAttempts = container.querySelectorAll(".marker-attempt");
        // Total 5 attempts, but one matches achievedRU, so only 4 rendered in attempts layer
        expect(allAttempts.length).toBe(4);

        const accentNotches = container.querySelectorAll(".marker-attempt:not(.secondary)");
        // Should have 3 accent notches for 5, 4, 3
        expect(accentNotches.length).toBe(3);

        const secondaryNotches = container.querySelectorAll(".marker-attempt.secondary");
        // Should have 1 secondary notch for 1 (2 is skipped)
        expect(secondaryNotches.length).toBe(1);

        // Verify achieved notch also exists and is NOT a marker-attempt (it's marker-achieved)
        const achievedNotch = container.querySelector(".marker-achieved");
        expect(achievedNotch).toBeTruthy();
    });

    it("should use scrollAnchorRU for view bounds if provided", () => {
        // Target 2. Achieved 3 (where label is). ScrollAnchor 10 (far ahead).
        // Window 7.5. Clamp at 70%.
        // 0.7 * 7.5 = 5.25.
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 2,
            achievedRU: 3,
            scrollAnchorRU: 10
        };
        const component = new RankTimelineComponent(config);
        const ranges = (component as any)._calculateViewBounds();

        // TargetPct will be < 20%, so new logic triggers.
        // ScrollAnchor (achieved) 10. highestScore 10. w 7.5.
        // centered 10 - 3.75 = 6.25.
        // rightAligned 10 - 6.0 = 4.0.
        // min(6.25, 4.0) = 4.0 (leftmost).
        expect(ranges.minRU).toBeCloseTo(4.0);
        expect(ranges.maxRU).toBeCloseTo(11.5);
    });

    it("should spawn from targetRU if targetRU is within bounds on first render", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 10,
            expectedRU: 12
        };
        const component = new RankTimelineComponent(config);

        // Before rendering, manually confirm _currentMinRU is 0
        expect((component as any)._currentMinRU).toBe(0);

        // Render with paused = true to prevent immediate update to final position
        const container = component.render(false, true);
        const progressLine = container.querySelector(".timeline-progress-line") as HTMLElement;

        // On first render, calculateViewBounds will return minRU = 7.25 (centered on 11)
        // targetRU is 10. (10 - 7.25) = 2.75.
        // targetViewPct = 2.75 / 7.5 = 36.6%. This is "within bounds".

        // If FIXED, it should be targetRU * unitWidth = 10 * (100 / 7.5) = 133.33%.
        // If NOT FIXED (using wrong _currentMinRU or broken math), it will likely be 0.

        expect(parseFloat(progressLine.style.left)).toBeCloseTo(133.33, 1);
    });

    it("should spawn from left if targetRU is outside anchor width on first render", () => {
        const config: RankTimelineConfiguration = {
            thresholds: mockThresholds,
            settings: mockSettings,
            targetRU: 0,
            expectedRU: 12
        };
        const component = new RankTimelineComponent(config);

        // On first render:
        // targetRU = 0. expectedRU = 12.
        // highscore - target = 12 - 0 = 12. 0.6 * 7.5 = 4.5.
        // 12 > 4.5 -> case 3.
        // achievedRU is undefined. minRU = highscoreAt80 = 12 - 0.8 * 7.5 = 12 - 6 = 6.0.
        // minRU = 6.0. Viewport [6.0, 13.5].

        // targetRU is 0. targetViewPct = (0 - 6) / 7.5 = -80%.
        // This is definitely outside 20-80%.

        // So initialLeft should be viewportMinRU * unitWidth = 6.0 * (100 / 7.5) = 80%.

        const container = component.render(false, true);
        const progressLine = container.querySelector(".timeline-progress-line") as HTMLElement;

        // Verify it spawns from the viewport left edge (80% in scroller-space)
        expect(parseFloat(progressLine.style.left)).toBeCloseTo(80.0, 1);
    });
});
