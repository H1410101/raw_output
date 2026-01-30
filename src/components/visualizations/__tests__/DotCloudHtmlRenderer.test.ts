import { expect, test, describe, beforeEach } from "vitest";
import { DotCloudHtmlRenderer, RenderContext } from "../DotCloudHtmlRenderer";
import { RankScaleMapper } from "../RankScaleMapper";
import { VisualSettings } from "../../../services/VisualSettingsService";

describe("DotCloudHtmlRenderer", () => {
    let container: HTMLElement;
    let mockMapper: RankScaleMapper;
    let renderer: DotCloudHtmlRenderer;
    let mockSettings: VisualSettings;

    beforeEach(() => {
        container = document.createElement("div");
        // Mock mapper: linear mapping 1:1 for simplicity
        mockMapper = {
            calculateRankUnit: (score: number) => score,
            getHorizontalPosition: (
                rankUnit: number,
                minRU: number,
                maxRU: number,
                width: number
            ) => {
                // Return width for maxRU to simulate right edge
                if (rankUnit === 100) return width;
                return 10;
            },
            identifyRelevantThresholds: () => [0, 100], // Start and End
            calculateViewBounds: () => ({ minRU: 0, maxRU: 100 }),
            getHighestRankIndex: () => 10,
            calculateAlignedBounds: () => ({ minRU: 0, maxRU: 100 }),
        } as unknown as RankScaleMapper;

        renderer = new DotCloudHtmlRenderer(container, mockMapper);

        mockSettings = {
            visRankFontSize: "Normal",
            showRankNotches: true,
            dotOpacity: 100,
            highlightLatestRun: true,
            dotJitterIntensity: "Normal",
            scalingMode: "Standard",
        } as VisualSettings;
    });

    test("should render label at the right edge when padding is applied", () => {
        const paddingLeft = 5;
        const width = 100;
        const context: RenderContext = {
            scores: [50],
            timestamps: [Date.now()],
            sortedThresholds: [["Start", 0], ["End", 100]],
            bounds: { minRU: 0, maxRU: 100 },
            isLatestFromSession: true,
            settings: mockSettings,
            dimensions: {
                width: width,
                height: 10,
                dotRadius: 0.5,
                rootFontSize: 16,
            },
            paddingLeft: paddingLeft
        };

        // Mock mapper logic for this test to put one label at 0 (left) and one at 100% (right)
        mockMapper.getHorizontalPosition = (ru, min, max, w) => {
            if (ru === 1) return 0; // Index 0 (RankUnit 1)
            if (ru === 101) return w; // Index 100 (RankUnit 101) - let's adjust indices to match sortedThresholds
            // Thresholds are at index 0 and 1.
            // identifyRelevantThresholds returns indices.
            return ru === 0 ? 0 : w; // sloppy mock but sufficient if we align with what renderer calls
        };

        // identifyRelevantThresholds returns [0, 1]
        mockMapper.identifyRelevantThresholds = () => [0, 1];

        // _calculateThresholdX calls getHorizontalPosition with index+1.
        // So for index 0 (Start), it calls with 1.
        // For index 1 (End), it calls with 2.

        mockMapper.getHorizontalPosition = (ru, min, max, w) => {
            if (ru === 1) return 0;
            if (ru === 2) return w;
            return 50;
        };

        renderer.draw(context);

        const labels = container.querySelectorAll(".dot-cloud-label");
        // We expect "Start" and "End"

        const texts = Array.from(labels).map(l => l.textContent);
        expect(texts).toContain("START");
        expect(texts).toContain("END"); // This is expected to fail if right label is culled

        // Also check position of right anchor
        // xPos = width + padding = 100 + 5 = 105.
        // If it exists, check style.
        const anchors = container.querySelectorAll(".dot-cloud-label-anchor");
        const rightAnchor = Array.from(anchors).find(a => (a as HTMLElement).style.left === "105rem");
        expect(rightAnchor).toBeDefined();
    });
});
