import { expect, test, afterEach } from "vitest";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";
import { RankedView, RankedViewDependencies } from "../RankedView";
import { AppStateService } from "../../services/AppStateService";
import { MockServiceFactory } from "./MockServiceFactory";

test("difficultyTabsMaintainPixelPerfectSynchronizationAcrossViewTransitions", async (): Promise<void> => {
    _applyLayoutConstraints();

    const dashboardContainer: HTMLDivElement = _prepareDashboardHost();
    document.body.appendChild(dashboardContainer);

    const appState: AppStateService = new AppStateService();
    const mockServices: BenchmarkViewServices = MockServiceFactory.createViewDependencies({
        appState,
        session: { isSessionActive: (): boolean => true }
    });

    const benchmarkTabCoordinates: DOMRect = await _captureBenchmarkDifficultyBounds(
        dashboardContainer,
        mockServices,
        appState
    );

    const rankedTabCoordinates: DOMRect = await _captureRankedDifficultyBounds(
        dashboardContainer,
        mockServices
    );

    expect(rankedTabCoordinates.top).toBe(benchmarkTabCoordinates.top);
    expect(rankedTabCoordinates.left).toBe(benchmarkTabCoordinates.left);
});

afterEach((): void => {
    document.body.innerHTML = "";
});

async function _captureBenchmarkDifficultyBounds(
    host: HTMLElement,
    services: BenchmarkViewServices,
    state: AppStateService
): Promise<DOMRect> {
    const viewMount: HTMLDivElement = _createViewContainer("view-benchmarks", "benchmark-view");
    host.appendChild(viewMount);

    const view: BenchmarkView = new BenchmarkView(viewMount, services, state);
    await view.render();

    return _getDifficultyTabsBoundsOrThrow();
}

async function _captureRankedDifficultyBounds(
    host: HTMLElement,
    services: BenchmarkViewServices
): Promise<DOMRect> {
    host.innerHTML = "";

    const viewMount: HTMLDivElement = _createViewContainer("view-ranked", "ranked-view");
    host.appendChild(viewMount);

    const view: RankedView = new RankedView(viewMount, services as unknown as RankedViewDependencies);
    await view.render();

    return _getDifficultyTabsBoundsOrThrow();
}

function _getDifficultyTabsBoundsOrThrow(): DOMRect {
    const tabs: Element | null = document.querySelector(".difficulty-tabs");

    if (!tabs) {
        throw new Error("Difficulty tabs element not found in DOM");
    }

    return tabs.getBoundingClientRect();
}

function _createViewContainer(containerId: string, className: string): HTMLDivElement {
    const container: HTMLDivElement = document.createElement("div");
    container.setAttribute("id", containerId);
    container.className = className;
    container.style.width = "100%";
    container.style.height = "100%";

    return container;
}

function _prepareDashboardHost(): HTMLDivElement {
    const host: HTMLDivElement = document.createElement("div");
    host.className = "dashboard-panel";
    host.style.width = "1000px";
    host.style.height = "800px";
    host.style.position = "relative";

    return host;
}

function _applyLayoutConstraints(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root { --margin-spacing-multiplier: 1; --ui-scale: 1; }
        .dashboard-panel { padding: 1.5rem; box-sizing: border-box; position: absolute; top: 0; left: 0; }
        .benchmark-header-controls { display: flex; justify-content: center; margin-bottom: 1.5rem; }
        .difficulty-tabs { display: flex; gap: 0.4rem; }
        .tab-button { padding: 0.4rem 1rem; font-size: 1rem; }
    `;

    document.head.appendChild(style);
}
