/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { DotCloudHtmlRenderer, RenderContext } from "../DotCloudHtmlRenderer";
import { RankScaleMapper } from "../RankScaleMapper";
import { VisualSettings } from "../../../services/VisualSettingsService";

interface DensityCalculator {
    readonly _calculateLocalDensities: (rankUnits: number[]) => number[];
}

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

    afterEach((): void => {
        vi.restoreAllMocks();
    });

    test("should render label at the right edge when padding is applied", (): void => {
        _runRightEdgeLabelTest(container, mockMapper, renderer, mockSettings);
    });

    test("matches the legacy finite local-density output", (): void => {
        const rankUnits: number[] = [2, 1.5, 2.5, 1.75, 2.5000001, -1, -0.5, 2];
        const expected: number[] = _calculateLegacyDensities(rankUnits);
        const densityCalculator = renderer as unknown as DensityCalculator;

        const actual: number[] = densityCalculator._calculateLocalDensities(rankUnits);

        actual.forEach((density: number, index: number): void => {
            expect(density).toBeCloseTo(expected[index], 10);
        });
    });

    test("filters non-finite points and commits a render once", (): void => {
        const context: RenderContext = {
            ..._createRenderContext(100, 5, mockSettings),
            scores: [Infinity, 50, -Infinity],
            timestamps: [1, 2, 3],
        };
        const replaceChildren = vi.spyOn(container, "replaceChildren");

        renderer.draw(context);

        const dots: NodeListOf<HTMLElement> = container.querySelectorAll(".dot-cloud-dot");
        expect(dots).toHaveLength(1);
        expect(dots[0].dataset.score).toBe("50.00");
        expect(replaceChildren).toHaveBeenCalledTimes(1);
    });

    test("rejects non-finite bounds before entering notch loops", (): void => {
        const context: RenderContext = {
            ..._createRenderContext(100, 5, mockSettings),
            bounds: { minRU: 0, maxRU: Infinity },
        };

        expect((): void => renderer.draw(context)).not.toThrow();
        expect(container.childElementCount).toBe(0);
    });

    test("reuses one measurement context and cached widths", (): void => {
        const measureText = vi.fn((): TextMetrics => ({ width: 10 } as TextMetrics));
        const measurementContext = { font: "", measureText } as unknown as CanvasRenderingContext2D;
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockReturnValue(measurementContext);
        const mapper: RankScaleMapper = _createMockMapper();
        _setupMockPositions(mapper);
        mapper.identifyRelevantThresholds = (): number[] => [0, 1];
        const cachedRenderer = new DotCloudHtmlRenderer(document.createElement("div"), mapper);
        const context: RenderContext = _createRenderContext(100, 5, mockSettings);

        cachedRenderer.draw(context);
        cachedRenderer.draw(context);

        expect(getContext).toHaveBeenCalledTimes(1);
        expect(measureText).toHaveBeenCalledTimes(2);
    });

    test("hides overlays and ignores interactions from replaced dots", (): void => {
        const context: RenderContext = _createRenderContext(100, 5, mockSettings);
        renderer.draw(context);
        const replacedDot: HTMLElement = container.querySelector(".dot-cloud-dot")!;
        replacedDot.dispatchEvent(new MouseEvent("mouseenter"));

        const overlay: HTMLElement = document.querySelector(".dot-inspection-overlay")!;
        expect(overlay).toHaveClass("visible");

        renderer.draw(context);
        expect(overlay).not.toHaveClass("visible");
        replacedDot.dispatchEvent(new MouseEvent("mouseenter"));
        expect(overlay).not.toHaveClass("visible");

        container.querySelector<HTMLElement>(".dot-cloud-dot")
            ?.dispatchEvent(new MouseEvent("mouseenter"));
        expect(overlay).toHaveClass("visible");
        renderer.destroy();
        expect(overlay).not.toHaveClass("visible");
    });
});

function _calculateLegacyDensities(rankUnits: number[]): number[] {
    const windowSizeInRu: number = 0.5;

    return rankUnits.map((target: number): number => {
        return rankUnits
            .filter((rankUnit: number): boolean => Math.abs(rankUnit - target) <= windowSizeInRu)
            .map((rankUnit: number): number => Math.abs(rankUnit - target) / windowSizeInRu)
            .reduce((total: number, distance: number): number => total + distance, 0);
    });
}

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
    mockMapper.getHorizontalPosition = (rankUnit: number, _minRU: number, _maxRU: number, widthValue: number): number => {
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
            _minRU: number,
            _maxRU: number,
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
    const settings: VisualSettings = {
        ..._getDefaultVisualSettings(),
        scalingMode: "Floating",
        dotOpacity: 100,
        highlightLatestRun: true,
        dotJitterIntensity: "Normal",
        allowBackgroundPolling: true,
    };

    return settings;
}

function _getDefaultVisualSettings(): VisualSettings {
    const baseSettings = _createBaseVisualSettings();
    const displaySettings = _createDisplayVisualSettings();
    const visibilitySettings = _createVisibilityVisualSettings();

    return {
        ...baseSettings,
        ...displaySettings,
        ...visibilitySettings,
        audioVolume: 80,
        showIntervalsSettings: true,
        playAnimationsUnfocused: false,
        allowBackgroundPolling: true,
    } as VisualSettings;
}

function _createBaseVisualSettings(): Partial<VisualSettings> {
    return {
        theme: "dark",
        showDotCloud: true,
        dotOpacity: 50,
        scalingMode: "Aligned",
        dotSize: "Normal",
        visDotSize: "Normal",
        uiScaling: "Normal",
        marginSpacing: "Normal",
        verticalSpacing: "Normal",
    };
}

function _createDisplayVisualSettings(): Partial<VisualSettings> {
    return {
        scenarioFontSize: "Normal",
        rankFontSize: "Normal",
        launchButtonSize: "Normal",
        headerFontSize: "Normal",
        labelFontSize: "Normal",
        categorySpacing: "Normal",
        dotCloudSize: "Normal",
        dotCloudWidth: "Normal",
        visRankFontSize: "Normal",
    };
}

function _createVisibilityVisualSettings(): Partial<VisualSettings> {
    return {
        showSessionBest: true,
        showAllTimeBest: true,
        dotJitterIntensity: "Normal",
        showRankNotches: true,
        highlightLatestRun: true,
        showRankEstimate: true,
        showRanks: true,
    };
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
