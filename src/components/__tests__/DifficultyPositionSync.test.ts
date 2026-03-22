import { expect, test, afterEach } from "vitest";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";

import { AppStateService } from "../../services/AppStateService";
import { IdentityService } from "../../services/IdentityService";
import { MockServiceFactory } from "./MockServiceFactory";

test("difficultyTabsArePresentInBenchmarkView", async (): Promise<void> => {
    _applyLayoutConstraints();

    const dashboardContainer: HTMLDivElement = _prepareDashboardHost();
    document.body.appendChild(dashboardContainer);

    const identityService = {
        getKovaaksUsername: (): string | null => "testuser",
        onProfilesChanged: (): void => { }
    } as unknown as IdentityService;

    const appState: AppStateService = new AppStateService(identityService);
    const mockServices: BenchmarkViewServices = MockServiceFactory.createViewDependencies({
        appState,
        session: { isSessionActive: (): boolean => true }
    });

    const benchmarkTabs: HTMLElement = await _captureBenchmarkDifficultyTabs(
        dashboardContainer,
        mockServices,
        appState
    );

    expect(benchmarkTabs.children.length).toBeGreaterThan(0);
    expect(window.getComputedStyle(benchmarkTabs).display).toBe("flex");
});

afterEach((): void => {
    document.body.innerHTML = "";
});

async function _captureBenchmarkDifficultyTabs(
    host: HTMLElement,
    services: BenchmarkViewServices,
    state: AppStateService
): Promise<HTMLElement> {
    const viewMount: HTMLDivElement = _createViewContainer("view-benchmarks", "benchmark-view");
    host.appendChild(viewMount);

    const view: BenchmarkView = new BenchmarkView(viewMount, services, state);
    await view.render();

    return _getDifficultyTabsOrThrow();
}


function _getDifficultyTabsOrThrow(): HTMLElement {
    const tabs: HTMLElement | null = document.querySelector(".difficulty-tabs");

    if (!tabs) {
        throw new Error("Difficulty tabs element not found in DOM");
    }

    return tabs;
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
