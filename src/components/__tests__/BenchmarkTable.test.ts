import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { BenchmarkTableComponent } from "../benchmark/BenchmarkTableComponent";
import { MockServiceFactory } from "./MockServiceFactory";
import { BenchmarkScenario } from "../../data/benchmarks";
import { ScenarioNameWidthManager } from "../benchmark/ScenarioNameWidthManager";
import { BenchmarkViewServices } from "../BenchmarkView";
import { AppStateService } from "../../services/AppStateService";

const CONST_REALISTIC_SCENARIOS: BenchmarkScenario[] = [
    {
        name: "VT 1w6ts Small",
        category: "Static",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 100, ["Silver"]: 110, ["Gold"]: 120 },
    },
    {
        name: "VT Dynamic Precise - Wide",
        category: "Dynamic",
        subcategory: "Flicking",
        thresholds: { ["Bronze"]: 90, ["Silver"]: 95, ["Gold"]: 100 },
    },
    {
        name: "VT Precise Tracking - Narrow Microcorrection 80% Easier",
        category: "Precise",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 3000, ["Silver"]: 3200, ["Gold"]: 3400 },
    },
    {
        name: "VT Smoothness Track 1 - Smooth",
        category: "Reactive",
        subcategory: "Tracking",
        thresholds: { ["Bronze"]: 1500, ["Silver"]: 1600, ["Gold"]: 1700 },
    },
];

describe("BenchmarkTable Presence", (): void => {
    let container: HTMLElement;

    beforeEach((): void => {
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "800px";
        container.style.position = "relative";
        document.body.appendChild(container);
    });

    afterEach((): void => {
        document.body.innerHTML = "";
    });

    test("all scenarios should be present in the rendered table", async (): Promise<void> => {
        await _renderRealisticBenchmarkTable(container);

        const names: string[] = CONST_REALISTIC_SCENARIOS.map(
            (scenario: BenchmarkScenario): string => scenario.name,
        );

        names.forEach((name: string): void => {
            const row: HTMLElement | null = container.querySelector(
                `[data-scenario-name="${name}"]`,
            );

            expect(row).not.toBeNull();
        });
    });
});

describe("BenchmarkTable Page Layout Tightness", (): void => {
    let container: HTMLElement;

    beforeEach((): void => {
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "800px";
        container.style.position = "relative";
        document.body.appendChild(container);
    });

    afterEach((): void => {
        document.body.innerHTML = "";
    });

    test("scenario name column should be tight to the maximum ink width", async (): Promise<void> => {
        await _renderRealisticBenchmarkTable(container);

        const inkWidthsPx: number[] = _calculateInkWidthsForScenarios(
            CONST_REALISTIC_SCENARIOS,
        );
        const maxInkWidthPx: number = Math.max(...inkWidthsPx);

        const reservedWidthsPx: number[] = _getScenarioNameReservedWidths(container);

        _assertTightness(reservedWidthsPx[0], maxInkWidthPx);
    });

    test("all scenario name columns should have identical reserved widths", async (): Promise<void> => {
        await _renderRealisticBenchmarkTable(container);

        const widths: number[] = _getScenarioNameReservedWidths(container);
        const firstWidth: number = widths[0];

        widths.forEach((width: number): void => {
            expect(width).toBe(firstWidth);
        });
    });
});

async function _renderRealisticBenchmarkTable(
    container: HTMLElement,
): Promise<void> {
    const table: BenchmarkTableComponent = _createBenchmarkTableWithMocks();

    container.appendChild(table.render(CONST_REALISTIC_SCENARIOS, {}, "Advanced"));

    await document.fonts.ready;
    await _waitForNextLayoutFrame();
}

function _calculateInkWidthsForScenarios(
    scenarios: BenchmarkScenario[],
): number[] {
    const font: string = _getScenarioNameFont();

    return scenarios.map((scenario: BenchmarkScenario): number => {
        return _measureTextInkWidthPx(scenario.name, font);
    });
}

function _getScenarioNameReservedWidths(container: HTMLElement): number[] {
    const items: HTMLElement[] = Array.from(
        container.querySelectorAll(".scenario-name"),
    );

    return items.map((label: HTMLElement): number => {
        const style: CSSStyleDeclaration = window.getComputedStyle(label);

        return parseFloat(style.width) || 0;
    });
}

function _assertTightness(reservedPx: number, maxInkPx: number): void {
    const rootFontSize: number = _getRootFontSize();
    const paddingRem: number = ScenarioNameWidthManager.scenarioNamePaddingRem;
    const expectedPadding: number = paddingRem * rootFontSize;
    const tolerance: number = rootFontSize;

    const limit: number = maxInkPx + expectedPadding + tolerance;

    expect(
        reservedPx,
        `Scenario name column is too narrow (Reserved: ${reservedPx.toFixed(1)}px, Ink: ${maxInkPx.toFixed(1)}px). Text will be clipped.`,
    ).toBeGreaterThan(maxInkPx);

    expect(
        reservedPx,
        `Scenario name column has excessive empty space (Reserved: ${reservedPx.toFixed(1)}px, Expected Max: ${limit.toFixed(1)}px).`,
    ).toBeLessThan(limit);
}

interface MockDeps extends BenchmarkViewServices {
    appState: AppStateService;
}

function _createBenchmarkTableWithMocks(): BenchmarkTableComponent {
    const raw = MockServiceFactory.createViewDependencies({
        benchmark: {
            getScenarios: (): BenchmarkScenario[] => CONST_REALISTIC_SCENARIOS,
            getAvailableDifficulties: (): string[] => ["Advanced"],
            getRankNames: (): string[] => ["Bronze", "Silver", "Gold"],
            getDifficulty: (): string => "Advanced",
        },
    }) as unknown as MockDeps;

    return new BenchmarkTableComponent({
        historyService: raw.history,
        rankService: raw.rank,
        sessionService: raw.session,
        appStateService: raw.appState,
        visualSettings: raw.visualSettings.getSettings(),
        audioService: raw.audio,
        focusService: raw.focus,
        rankEstimator: raw.rankEstimator,
    });
}

function _measureTextInkWidthPx(text: string, font: string): number {
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    const context: CanvasRenderingContext2D = _getInitializedCanvasContext(
        canvas,
        text,
        font,
    );

    const imageData: Uint8ClampedArray = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
    ).data;

    return _scanForRightmostOpaquePixel(imageData, canvas.width, canvas.height);
}

function _getInitializedCanvasContext(
    canvas: HTMLCanvasElement,
    text: string,
    font: string,
): CanvasRenderingContext2D {
    const context: CanvasRenderingContext2D = canvas.getContext("2d", {
        willReadFrequently: true,
    })!;

    context.font = font;
    const metrics: TextMetrics = context.measureText(text);

    canvas.width = Math.ceil(metrics.width) + 20;
    canvas.height = 100;

    context.font = font;
    context.textBaseline = "top";
    context.fillText(text, 0, 0);

    return context;
}

function _scanForRightmostOpaquePixel(
    data: Uint8ClampedArray,
    width: number,
    height: number,
): number {
    for (let x: number = width - 1; x >= 0; x--) {
        for (let y: number = 0; y < height; y++) {
            const alphaIndex: number = (y * width + x) * 4 + 3;

            if (data[alphaIndex] > 0) {
                return x + 1;
            }
        }
    }

    return 0;
}

function _getScenarioNameFont(): string {
    const label: HTMLElement | null = document.querySelector(".scenario-name");

    if (!label) {
        return "500 16px Nunito";
    }

    const style: CSSStyleDeclaration = window.getComputedStyle(label);

    return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function _getRootFontSize(): number {
    const root: HTMLElement = document.documentElement;
    const style: CSSStyleDeclaration = window.getComputedStyle(root);

    return parseFloat(style.fontSize) || 16;
}

async function _waitForNextLayoutFrame(): Promise<void> {
    return new Promise((resolve: (value: unknown) => void): void => {
        requestAnimationFrame((): void => {
            requestAnimationFrame(resolve);
        });
    });
}
