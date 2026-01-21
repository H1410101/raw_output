import { expect, test, describe, beforeAll, vi } from "vitest";

import { BenchmarkTableComponent } from "../benchmark/BenchmarkTableComponent";
import { MockServiceFactory } from "./MockServiceFactory";
import { BenchmarkScenario } from "../../data/benchmarks";
import { ScenarioNameWidthManager } from "../benchmark/ScenarioNameWidthManager";
import { BenchmarkViewServices } from "../BenchmarkView";
import { AppStateService } from "../../services/AppStateService";
import { CosmeticOverrideService } from "../../services/CosmeticOverrideService";

const CONST_REALISTIC_SCENARIOS: BenchmarkScenario[] = [
    {
        name: "VT 1w6ts Small",
        category: "Static",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 100, ["Silver"]: 110, ["Gold"]: 120, ["Platinum"]: 130, ["Diamond"]: 140 },
    },
    {
        name: "VT Dynamic Precise - Wide",
        category: "Dynamic",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 90, ["Silver"]: 95, ["Gold"]: 100, ["Platinum"]: 105, ["Diamond"]: 110 },
    },
    {
        name: "VT Precise Tracking - Narrow Microcorrection",
        category: "Precise",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 3000, ["Silver"]: 3200, ["Gold"]: 3400, ["Platinum"]: 3600, ["Diamond"]: 3800 },
    },
    {
        name: "VT Smoothness Track 1 - Smooth",
        category: "Reactive",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 1500, ["Silver"]: 1600, ["Gold"]: 1700, ["Platinum"]: 1800, ["Diamond"]: 1900 },
    },
    {
        name: "VT Reactive Micro - Snap",
        category: "Reactive",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 80, ["Silver"]: 85, ["Gold"]: 90, ["Platinum"]: 95, ["Diamond"]: 100 },
    },
    {
        name: "VT Smoothness Track 2 - Wide",
        category: "Reactive",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 1800, ["Silver"]: 2000, ["Gold"]: 2200, ["Platinum"]: 2400, ["Diamond"]: 2600 },
    },
    {
        name: "VT Precise Micro - Snap",
        category: "Precise",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 70, ["Silver"]: 75, ["Gold"]: 80, ["Platinum"]: 85, ["Diamond"]: 90 },
    },
    {
        name: "VT Reactive Sphere 3 - Chaos",
        category: "Reactive",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 1200, ["Silver"]: 1400, ["Gold"]: 1600, ["Platinum"]: 1800, ["Diamond"]: 2000 },
    },
    {
        name: "VT Static Wall 6 - Wide",
        category: "Static",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 110, ["Silver"]: 120, ["Gold"]: 130, ["Platinum"]: 140, ["Diamond"]: 150 },
    },
    {
        name: "VT Tracking Sphere 2 - Float",
        category: "Reactive",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 2000, ["Silver"]: 2200, ["Gold"]: 2400, ["Platinum"]: 2600, ["Diamond"]: 2800 },
    },
    {
        name: "VT Dynamic Mini - Snap",
        category: "Dynamic",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 150, ["Silver"]: 160, ["Gold"]: 170, ["Platinum"]: 180, ["Diamond"]: 190 },
    },
    { name: "VT Smoothness Track 3 - Hard", category: "Reactive", subcategory: "Tracking", thresholds: { ["Bronze"]: 2200, ["Silver"]: 2400, ["Gold"]: 2600, ["Platinum"]: 2800, ["Diamond"]: 3000 } },
    { name: "VT Reactive Flick 1 - Pop", category: "Reactive", subcategory: "Flicking", thresholds: { ["Bronze"]: 90, ["Silver"]: 100, ["Gold"]: 110, ["Platinum"]: 120, ["Diamond"]: 130 } },
    { name: "VT Precise Tracking 2 - Glide", category: "Precise", subcategory: "Tracking", thresholds: { ["Bronze"]: 4000, ["Silver"]: 4200, ["Gold"]: 4400, ["Platinum"]: 4600, ["Diamond"]: 4800 } },
    { name: "VT Dynamic Mini - Fast", category: "Dynamic", subcategory: "Flicking", thresholds: { ["Bronze"]: 180, ["Silver"]: 190, ["Gold"]: 200, ["Platinum"]: 210, ["Diamond"]: 220 } },
    { name: "VT Static Wall 2x2 - Tiny", category: "Static", subcategory: "Flicking", thresholds: { ["Bronze"]: 80, ["Silver"]: 90, ["Gold"]: 100, ["Platinum"]: 110, ["Diamond"]: 120 } },
    { name: "VT Reactive Snap - Chaos", category: "Reactive", subcategory: "Flicking", thresholds: { ["Bronze"]: 70, ["Silver"]: 75, ["Gold"]: 80, ["Platinum"]: 85, ["Diamond"]: 90 } },
    { name: "VT Static Grid 6x6 - Mini", category: "Static", subcategory: "Flicking", thresholds: { ["Bronze"]: 150, ["Silver"]: 160, ["Gold"]: 170, ["Platinum"]: 180, ["Diamond"]: 190 } },
    { name: "VT Dynamic Precise - Fast", category: "Dynamic", subcategory: "Flicking", thresholds: { ["Bronze"]: 110, ["Silver"]: 120, ["Gold"]: 130, ["Platinum"]: 140, ["Diamond"]: 150 } },
];

describe("BenchmarkTable Scenario Name Area", (): void => {
    let containerElement: HTMLElement;

    beforeAll(async (): Promise<void> => {
        containerElement = await _initializeTestEnvironment();
    });

    test("all scenarios should be present in the rendered table", async (): Promise<void> => {
        _verifyAllScenariosPresent(containerElement);
    });

    test("scenario name column should be tight to the maximum ink width", (): void => {
        _verifyColumnTightness(containerElement);
    });

    test("all scenario name columns should have identical reserved widths", (): void => {
        _verifyColumnUniformity(containerElement);
    });
});

async function _initializeTestEnvironment(): Promise<HTMLElement> {
    const container = _setupPersistentContainer();
    await _renderRealisticBenchmarkTable(container);
    await _waitForVisualizationHydration();
    _verifyContainerDimensions(container);

    return container;
}

function _verifyContainerDimensions(container: HTMLElement): void {
    const tableContainerSelector = ".benchmark-table-container";
    const tableContainer: HTMLElement | null = document.querySelector(tableContainerSelector);

    expect(container.clientHeight, "Container height is invalid.").toBeGreaterThan(500);
    expect(tableContainer?.clientHeight, "BenchmarkTable has 0 height.").toBeGreaterThan(0);
}

function _verifyAllScenariosPresent(container: HTMLElement): void {
    const scenarioNames: string[] = CONST_REALISTIC_SCENARIOS.map(
        (scenarioData: BenchmarkScenario): string => scenarioData.name,
    );

    scenarioNames.forEach((targetName: string): void => {
        const scenarioRow: HTMLElement | null = container.querySelector(
            `[data-scenario-name="${targetName}"]`,
        );

        expect(
            scenarioRow,
            `BenchmarkTable is missing a row for scenario: "${targetName}".`,
        ).not.toBeNull();
    });
}

function _verifyColumnTightness(container: HTMLElement): void {
    const textInkWidthsPx: number[] = _calculateInkWidthsForScenarios(
        CONST_REALISTIC_SCENARIOS,
    );
    const maximumInkWidthPx: number = Math.max(...textInkWidthsPx);
    const scenarioReservedWidthsPx: number[] = _getScenarioNameReservedWidths(container);

    _assertTightness(scenarioReservedWidthsPx[0], maximumInkWidthPx);
}

function _verifyColumnUniformity(container: HTMLElement): void {
    const columnWidthsPx: number[] = _getScenarioNameReservedWidths(container);
    const baselineWidthPx: number = columnWidthsPx[0];

    columnWidthsPx.forEach((currentWidthPx: number): void => {
        expect(
            currentWidthPx,
            `Scenario name columns must have identical reserved widths. Found ${currentWidthPx}px, but expected ${baselineWidthPx}px.`,
        ).toBe(baselineWidthPx);
    });
}

async function _renderRealisticBenchmarkTable(
    targetContainer: HTMLElement,
): Promise<void> {
    const tableInstance: BenchmarkTableComponent = _createBenchmarkTableWithMocks();
    const mockHighscores: Record<string, number> = {};

    CONST_REALISTIC_SCENARIOS.forEach((scenarioSnippet: BenchmarkScenario): void => {
        mockHighscores[scenarioSnippet.name] = (scenarioSnippet.thresholds["Silver"] || 0) + 5;
    });

    targetContainer.appendChild(tableInstance.render(CONST_REALISTIC_SCENARIOS, mockHighscores, "Advanced"));

    await document.fonts.ready;
    await _waitForNextLayoutFrame();
}

async function _waitForVisualizationHydration(): Promise<void> {
    for (let retryCount: number = 0; retryCount < 50; retryCount++) {
        const canvasNodes: NodeList = document.querySelectorAll(".dot-cloud-container canvas");
        if (canvasNodes.length >= CONST_REALISTIC_SCENARIOS.length) {
            await _waitForNextLayoutFrame();

            return;
        }
        await new Promise<void>((resolveCallback: (value: void) => void): void => {
            setTimeout((): void => resolveCallback(), 20);
        });
    }
}

function _calculateInkWidthsForScenarios(
    benchmarkScenarios: BenchmarkScenario[],
): number[] {
    const scenarioFontString: string = _getScenarioNameFont();

    return benchmarkScenarios.map((scenarioItem: BenchmarkScenario): number => {
        return _measureTextInkWidthPx(scenarioItem.name, scenarioFontString);
    });
}

function _getScenarioNameReservedWidths(rootElement: HTMLElement): number[] {
    const labelElements: HTMLElement[] = Array.from(
        rootElement.querySelectorAll(".scenario-name"),
    );

    expect(labelElements.length, "Failed to find scenario labels.").toBeGreaterThan(0);

    return labelElements.map((labelNode: HTMLElement): number => {
        const computedStyle: CSSStyleDeclaration = window.getComputedStyle(labelNode);

        return parseFloat(computedStyle.width) || 0;
    });
}

function _assertTightness(reservedLayoutPx: number, maximumTextInkPx: number): void {
    const rootFontScale: number = _getRootFontSize();
    const paddingRemValue: number = ScenarioNameWidthManager.scenarioNamePaddingRem;
    const expectedPaddingPx: number = paddingRemValue * rootFontScale;
    const measurementTolerancePx: number = rootFontScale;

    const upperWidthLimitPx: number = maximumTextInkPx + expectedPaddingPx + measurementTolerancePx;

    expect(
        reservedLayoutPx,
        `Scenario name column is too narrow.`,
    ).toBeGreaterThan(maximumTextInkPx);

    expect(
        reservedLayoutPx,
        `Scenario name column has excessive empty space.`,
    ).toBeLessThan(upperWidthLimitPx);
}

interface MockViewDependencies extends BenchmarkViewServices {
    appState: AppStateService;
}

function _createBenchmarkTableWithMocks(): BenchmarkTableComponent {
    const mockScoresMap: Record<string, { score: number; timestamp: number }[]> = _generateAllScenarioScores();
    const dependencyContainer: MockViewDependencies = _buildMockDependencies(mockScoresMap);

    return _instantiateBenchmarkTable(dependencyContainer);
}

function _generateAllScenarioScores(): Record<string, { score: number; timestamp: number }[]> {
    const mockScoresMap: Record<string, { score: number; timestamp: number }[]> = {};
    const currentTimeMs: number = Date.now();

    CONST_REALISTIC_SCENARIOS.forEach((scenarioRef: BenchmarkScenario): void => {
        mockScoresMap[scenarioRef.name] = _generateSingleScenarioScores(scenarioRef, currentTimeMs);
    });

    return mockScoresMap;
}

function _generateSingleScenarioScores(
    scenarioRef: BenchmarkScenario,
    currentTimeMs: number,
): { score: number; timestamp: number }[] {
    const scenarioScores: { score: number; timestamp: number }[] = [];
    const baseScore: number = scenarioRef.thresholds["Silver"] || 100;

    for (let scoreIndex: number = 0; scoreIndex < 40; scoreIndex++) {
        scenarioScores.push({
            score: baseScore + (Math.random() * 20 - 10),
            timestamp: currentTimeMs - scoreIndex * 3600000,
        });
    }

    return scenarioScores;
}

function _buildMockDependencies(
    mockScoresMap: Record<string, { score: number; timestamp: number }[]>
): MockViewDependencies {
    return MockServiceFactory.createViewDependencies({
        benchmark: {
            getScenarios: (): BenchmarkScenario[] => CONST_REALISTIC_SCENARIOS,
            getAvailableDifficulties: (): string[] => ["Advanced"],
            getRankNames: (): string[] => ["Bronze", "Silver", "Gold", "Platinum", "Diamond"],
            getDifficulty: (): string => "Advanced",
        },
        history: {
            getLastScores: vi.fn((name: string): Promise<{ score: number; timestamp: number }[]> => {
                return Promise.resolve(mockScoresMap[name] || []);
            }),
        }
    }) as unknown as MockViewDependencies;
}

function _instantiateBenchmarkTable(dependencyContainer: MockViewDependencies): BenchmarkTableComponent {
    return new BenchmarkTableComponent({
        historyService: dependencyContainer.history,
        rankService: dependencyContainer.rank,
        sessionService: dependencyContainer.session,
        appStateService: dependencyContainer.appState,
        visualSettings: dependencyContainer.visualSettings.getSettings(),
        audioService: dependencyContainer.audio,
        focusService: dependencyContainer.focus,
        rankEstimator: dependencyContainer.rankEstimator,
        cosmeticOverride: { isActiveFor: () => false } as unknown as CosmeticOverrideService,
    });
}

function _measureTextInkWidthPx(textContent: string, fontDescription: string): number {
    const measurementCanvas: HTMLCanvasElement = document.createElement("canvas");
    const renderingContext: CanvasRenderingContext2D = _getRequiredCanvasContext(
        measurementCanvas,
        textContent,
        fontDescription,
    );

    const pixelBuffer: Uint8ClampedArray = renderingContext.getImageData(
        0,
        0,
        measurementCanvas.width,
        measurementCanvas.height,
    ).data;

    return _scanForRightmostOpaquePixel(pixelBuffer, measurementCanvas.width, measurementCanvas.height);
}

function _getRequiredCanvasContext(
    targetCanvas: HTMLCanvasElement,
    rawText: string,
    fontSpec: string,
): CanvasRenderingContext2D {
    const drawingContext: CanvasRenderingContext2D | null = targetCanvas.getContext("2d", {
        willReadFrequently: true,
    });

    if (!drawingContext) {
        throw new Error(
            "Failed to get 2D context from canvas. This is required for measuring text ink width in tests.",
        );
    }

    return _initializeCanvasContext(drawingContext, rawText, fontSpec, targetCanvas);
}

function _initializeCanvasContext(
    contextAccessor: CanvasRenderingContext2D,
    textData: string,
    fontFamilyString: string,
    canvasHandle: HTMLCanvasElement,
): CanvasRenderingContext2D {
    contextAccessor.font = fontFamilyString;
    const textMetricsData: TextMetrics = contextAccessor.measureText(textData);

    canvasHandle.width = Math.ceil(textMetricsData.width) + 20;
    canvasHandle.height = 100;

    contextAccessor.font = fontFamilyString;
    contextAccessor.textBaseline = "top";
    contextAccessor.fillText(textData, 0, 0);

    return contextAccessor;
}

function _scanForRightmostOpaquePixel(
    pixelColorArray: Uint8ClampedArray,
    canvasWidthPx: number,
    canvasHeightPx: number,
): number {
    for (let columnX: number = canvasWidthPx - 1; columnX >= 0; columnX--) {
        for (let rowY: number = 0; rowY < canvasHeightPx; rowY++) {
            const alphaChannelIndex: number = (rowY * canvasWidthPx + columnX) * 4 + 3;

            if (pixelColorArray[alphaChannelIndex] > 0) {
                return columnX + 1;
            }
        }
    }

    return 0;
}

function _getScenarioNameFont(): string {
    const labelNode: HTMLElement | null = document.querySelector(".scenario-name");

    if (!labelNode) {
        return "500 16px Nunito";
    }

    const computedStyles: CSSStyleDeclaration = window.getComputedStyle(labelNode);
    const fontShorthand: string =
        `${computedStyles.fontWeight} ${computedStyles.fontSize} ${computedStyles.fontFamily}`.trim();

    expect(fontShorthand).not.toBe("");

    return fontShorthand;
}

function _getRootFontSize(): number {
    const documentRootElement: HTMLElement = document.documentElement;
    const rootStyles: CSSStyleDeclaration = window.getComputedStyle(documentRootElement);

    return parseFloat(rootStyles.fontSize) || 16;
}

async function _waitForNextLayoutFrame(): Promise<void> {
    return new Promise<void>((resolveCallback: (value: void) => void): void => {
        requestAnimationFrame((): void => {
            requestAnimationFrame((): void => resolveCallback());
        });
    });
}

function _setupPersistentContainer(): HTMLElement {
    _resetGlobalStyles();

    return _createAndMountContainer();
}

function _resetGlobalStyles(): void {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.fontSize = "20px";
    document.body.style.background = "#020203";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.innerHTML = "";
}

function _createAndMountContainer(): HTMLElement {
    const mountContainer: HTMLElement = document.createElement("div");

    _applyContainerStyles(mountContainer);
    document.body.appendChild(mountContainer);

    return mountContainer;
}

function _applyContainerStyles(container: HTMLElement): void {
    container.style.width = "1600px";
    container.style.height = "2200px";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.position = "relative";
    container.style.margin = "0 auto";

    container.style.background = "linear-gradient(to bottom, #130f1a, #020203)";
    container.style.border = "1px solid #3d527a";
    container.style.borderRadius = "24px";
    container.style.overflow = "visible";
}
