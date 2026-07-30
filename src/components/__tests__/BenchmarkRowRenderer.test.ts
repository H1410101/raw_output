/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { afterEach, describe, expect, test, vi } from "vitest";
import { BenchmarkScenario } from "../../data/benchmarks";
import { VisualSettings } from "../../services/VisualSettingsService";
import { BenchmarkViewServices } from "../BenchmarkView";
import { BenchmarkRowRenderer } from "../benchmark/BenchmarkRowRenderer";
import { DotCloudComponent } from "../visualizations/DotCloudComponent";
import { ScoreEntry } from "../visualizations/ScoreProcessor";
import { MockServiceFactory } from "./MockServiceFactory";

interface RegistryAccess {
    readonly _dotCloudRegistry: Map<string, DotCloudComponent>;
}

interface RendererTestContext {
    readonly dependencies: BenchmarkViewServices;
    readonly renderer: BenchmarkRowRenderer;
    readonly settings: VisualSettings;
}

const scenario: BenchmarkScenario = {
    name: "Scenario A",
    category: "Static",
    subcategory: "Clicking",
    thresholds: { Bronze: 100, Silver: 200 },
};

describe("BenchmarkRowRenderer dot-cloud work", (): void => {
    afterEach((): void => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test("does not redraw a dot cloud when CSS row selection changes", (): void => {
        const context: RendererTestContext = _createRendererContext();
        context.settings.showDotCloud = false;
        context.settings.showRanks = false;
        const component: DotCloudComponent = _createDotCloud(context.settings);
        const requestUpdate = vi.spyOn(component, "requestUpdate");
        _getRegistry(context.renderer).set(scenario.name, component);

        const row: HTMLElement = context.renderer.renderRow(scenario, 0);
        row.click();

        expect(row).toHaveClass("selected");
        expect(requestUpdate).not.toHaveBeenCalled();
        context.renderer.destroyAll();
    });

    test("does not apply a refresh that completes after destroy", async (): Promise<void> => {
        let resolveScores: (entries: ScoreEntry[]) => void = (): void => undefined;
        const pendingScores = new Promise<ScoreEntry[]>((resolve): void => {
            resolveScores = resolve;
        });
        const getLastScores = vi.fn((): Promise<ScoreEntry[]> => pendingScores);
        const context: RendererTestContext = _createRendererContext(getLastScores);
        context.settings.showDotCloud = true;
        context.settings.showRanks = false;
        const component: DotCloudComponent = _createDotCloud(context.settings);
        const updateData = vi.spyOn(component, "updateData");
        _getRegistry(context.renderer).set(scenario.name, component);

        context.renderer.updateRow(document.createElement("div"), scenario, { highscore: 0 });
        context.renderer.destroyAll();
        resolveScores([{ score: 150, timestamp: 1000 }]);
        await pendingScores;
        await Promise.resolve();

        expect(getLastScores).toHaveBeenCalledTimes(1);
        expect(updateData).not.toHaveBeenCalled();
    });

    test("does not inject an initial load that completes after destroy", async (): Promise<void> => {
        let resolveScores: (entries: ScoreEntry[]) => void = (): void => undefined;
        const pendingScores = new Promise<ScoreEntry[]>((resolve): void => {
            resolveScores = resolve;
        });
        const getLastScores = vi.fn((): Promise<ScoreEntry[]> => pendingScores);
        const context: RendererTestContext = _createRendererContext(getLastScores);
        context.settings.showDotCloud = true;
        context.settings.showRanks = false;

        const row: HTMLElement = context.renderer.renderRow(scenario, 0);
        context.renderer.destroyAll();
        resolveScores([{ score: 150, timestamp: 1000 }]);
        await pendingScores;
        await Promise.resolve();

        expect(getLastScores).toHaveBeenCalledTimes(1);
        expect(_getRegistry(context.renderer).size).toBe(0);
        expect(row.querySelectorAll(".dot-cloud-dot")).toHaveLength(0);
    });

    test("disconnects pending intersection observers on destroy", (): void => {
        const disconnect = vi.fn();
        const observe = vi.fn();
        const observerConstructor = vi.fn(function ObserverMock(): IntersectionObserver {
            return {
                disconnect,
                observe,
                takeRecords: vi.fn(() => []),
                unobserve: vi.fn(),
                root: null,
                rootMargin: "0px",
                thresholds: [0],
            } as unknown as IntersectionObserver;
        });
        vi.stubGlobal("IntersectionObserver", observerConstructor);
        const context: RendererTestContext = _createRendererContext();
        context.settings.showDotCloud = true;
        context.settings.showRanks = false;

        context.renderer.renderRow(scenario, 0);
        context.renderer.destroyAll();

        expect(observe).toHaveBeenCalledOnce();
        expect(disconnect).toHaveBeenCalledOnce();
    });
});

function _createRendererContext(
    getLastScores?: () => Promise<ScoreEntry[]>,
): RendererTestContext {
    const dependencies: BenchmarkViewServices = MockServiceFactory.createViewDependencies(
        getLastScores === undefined ? {} : { history: { getLastScores } },
    );
    const settings: VisualSettings = dependencies.visualSettings.getSettings();
    const renderer = new BenchmarkRowRenderer({
        historyService: dependencies.history,
        rankService: dependencies.rank,
        sessionService: dependencies.session,
        audioService: dependencies.audio,
        visualSettings: settings,
        rankEstimator: dependencies.rankEstimator,
        cosmeticOverride: dependencies.cosmeticOverride,
        identityService: dependencies.identity,
    });

    return { dependencies, renderer, settings };
}

function _createDotCloud(settings: VisualSettings): DotCloudComponent {
    return new DotCloudComponent({
        entries: [],
        thresholds: scenario.thresholds,
        settings,
        isLatestInSession: false,
    });
}

function _getRegistry(renderer: BenchmarkRowRenderer): Map<string, DotCloudComponent> {
    return (renderer as unknown as RegistryAccess)._dotCloudRegistry;
}
