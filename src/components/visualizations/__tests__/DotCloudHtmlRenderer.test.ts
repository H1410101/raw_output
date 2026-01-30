import { expect, test, describe, beforeEach } from "vitest";
import { DotCloudHtmlRenderer, RenderContext } from "../DotCloudHtmlRenderer";
import { RankScaleMapper } from "../RankScaleMapper";
import { VisualSettings } from "../../../services/VisualSettingsService";

describe("DotCloudHtmlRenderer", (): void => {
    let container: HTMLElement;
    let mockMapper: RankScaleMapper;
    let renderer: DotCloudHtmlRenderer;
    let mockSettings: VisualSettings;

    beforeEach((): void => {
        container = document.createElement("div");

        // Mock mapper: linear mapping 1:1 for simplicity
        mockMapper = _createMockMapper();
        renderer = new DotCloudHtmlRenderer(container, mockMapper);
        mockSettings = _createMockSettings();
    });

    test("should render label at the right edge when padding is applied", (): void => {
        _runRightEdgeLabelTest(container, mockMapper, renderer, mockSettings);
    });
});

function _runRightEdgeLabelTest(
    container: HTMLElement,
    mockMapper: RankScaleMapper,
    renderer: DotCloudHtmlRenderer,
    mockSettings: VisualSettings
): void {
    const paddingLeft = 5;
    const width = 100;

    const context: RenderContext = _createRenderContext(width, paddingLeft, mockSettings);

    _setupMockPositions(mockMapper);

    mockMapper.identifyRelevantThresholds = (): number[] => [0, 1];

    renderer.draw(context);

    const labels = container.querySelectorAll(".dot-cloud-label");
    const texts = Array.from(labels).map((label: Element): string | null => label.textContent);

    expect(texts).toContain("START");
    expect(texts).toContain("END");

    const anchors = container.querySelectorAll(".dot-cloud-label-anchor");
    const rightAnchor = Array.from(anchors).find((anchor: Element): boolean => {
        return (anchor as HTMLElement).style.left === "105rem";
    });

    expect(rightAnchor).toBeDefined();
}

function _setupMockPositions(mockMapper: RankScaleMapper): void {
    // Mock positions: Start at 0, End at width
    mockMapper.getHorizontalPosition = (rankUnit: number, minRU: number, maxRU: number, widthValue: number): number => {
        if (rankUnit === 1) {
            return 0;
        }

        if (rankUnit === 2) {
            return widthValue;
        }

        return 50;
    };
}

function _createMockMapper(): RankScaleMapper {
    return {
        calculateRankUnit: (score: number): number => score,
        getHorizontalPosition: (
            rankUnit: number,
            minRU: number,
            maxRU: number,
            width: number
        ): number => {
            if (rankUnit === 100) {
                return width;
            }

            return 10;
        },
        identifyRelevantThresholds: (): number[] => [0, 100],
        calculateViewBounds: (): { minRU: number; maxRU: number } => ({ minRU: 0, maxRU: 100 }),
        getHighestRankIndex: (): number => 10,
        calculateAlignedBounds: (): { minRU: number; maxRU: number } => ({ minRU: 0, maxRU: 100 }),
    } as unknown as RankScaleMapper;
}

function _createMockSettings(): VisualSettings {
    return {
        visRankFontSize: "Normal",
        showRankNotches: true,
        dotOpacity: 100,
        highlightLatestRun: true,
        dotJitterIntensity: "Normal",
        scalingMode: "Standard",
    } as VisualSettings;
}

function _createRenderContext(width: number, padding: number, settings: VisualSettings): RenderContext {
    return {
        scores: [50],
        timestamps: [Date.now()],
        sortedThresholds: [["Start", 0], ["End", 100]],
        bounds: { minRU: 0, maxRU: 100 },
        isLatestFromSession: true,
        settings: settings,
        dimensions: {
            width: width,
            height: 10,
            dotRadius: 0.5,
            rootFontSize: 16,
        },
        paddingLeft: padding,
    };
}
