import { expect, test, afterEach } from "vitest";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";

import { RankedView, RankedViewDependencies } from "../RankedView";

import { AppStateService } from "../../services/AppStateService";
import { MockServiceFactory } from "./MockServiceFactory";

/**
 * Technical Regression Test: Difficulty Selector Position Synchronization.
 * 
 * Verifies that the difficulty tabs occupy the exact same pixel coordinates
 * when switching between the Benchmark Table and the Ranked View.
 */
test("difficulty.children.position.ext.syncAcrossViews", async (): Promise<void> => {
    _applyGlobalStyles();

    const container: HTMLDivElement = _createDashboardContainer();
    document.body.appendChild(container);

    const appState: AppStateService = new AppStateService();
    const mockDependencies: BenchmarkViewServices = MockServiceFactory.createViewDependencies({

        appState,
        session: { isSessionActive: (): boolean => true }
    });


    const benchmarkRect: DOMRect = await _getBenchmarkTabsRect(container, mockDependencies, appState);
    const rankedRect: DOMRect = await _getRankedTabsRect(container, mockDependencies);

    expect(rankedRect.top).toBe(benchmarkRect.top);
    expect(rankedRect.left).toBe(benchmarkRect.left);
});

afterEach((): void => {
    document.body.innerHTML = "";
});

async function _getBenchmarkTabsRect(
    container: HTMLElement,
    dependencies: BenchmarkViewServices,
    appState: AppStateService
): Promise<DOMRect> {

    const benchmarkMount: HTMLDivElement = document.createElement("div");
    benchmarkMount.setAttribute("id", "view-benchmarks");
    benchmarkMount.className = "benchmark-view";

    container.appendChild(benchmarkMount);

    const benchmarkView: BenchmarkView = new BenchmarkView(benchmarkMount, dependencies, appState);
    await benchmarkView.render();

    const tabs: Element | null = document.querySelector(".benchmark-view .difficulty-tabs");
    if (!tabs) {
        throw new Error("Benchmark difficulty tabs not found");
    }

    return tabs.getBoundingClientRect();
}

async function _getRankedTabsRect(container: HTMLElement, dependencies: BenchmarkViewServices): Promise<DOMRect> {

    container.innerHTML = "";

    const rankedMount: HTMLDivElement = document.createElement("div");
    rankedMount.setAttribute("id", "view-ranked");
    rankedMount.className = "ranked-view";

    container.appendChild(rankedMount);

    const rankedView: RankedView = new RankedView(rankedMount, dependencies as unknown as RankedViewDependencies);

    await rankedView.render();

    const tabs: Element | null = document.querySelector(".ranked-view .difficulty-tabs");
    if (!tabs) {
        throw new Error("Ranked difficulty tabs not found");
    }

    return tabs.getBoundingClientRect();
}

function _createDashboardContainer(): HTMLDivElement {
    const container: HTMLDivElement = document.createElement("div");
    container.className = "dashboard-panel";
    container.style.width = "1000px";
    container.style.height = "800px";
    container.style.position = "relative";

    return container;
}

function _applyGlobalStyles(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = _getGlobalStylesContent();

    document.head.appendChild(style);
}

function _getGlobalStylesContent(): string {
    return `
        :root { --margin-spacing-multiplier: 1; --ui-scale: 1; }
        .dashboard-panel { padding: 1.5rem; box-sizing: border-box; position: absolute; top: 0; left: 0; }
        .benchmark-view, .ranked-view { width: 100%; height: 100%; }
        .difficulty-tabs { display: flex; gap: 0.4rem; }
        .tab-button { padding: 0.4rem 1rem; font-size: 1rem; }
        .benchmark-header-controls { display: flex; justify-content: center; margin-bottom: 1.5rem; }
    `;
}
