import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";
import { MockServiceFactory } from "./MockServiceFactory";
import { EstimatedRank } from "../../services/RankEstimator";
import { AppStateService } from "../../services/AppStateService";

type BenchmarkViewTestDeps = BenchmarkViewServices & { appState: AppStateService };


const MOCK_CSS: string = `
  :root {
    --lower-band-3: rgb(100, 100, 100);
    --lower-band-1: rgb(50, 50, 50);
    --accent-color: rgb(193, 230, 227);
  }
  .rank-name {
    color: var(--lower-band-3);
    font-weight: 700;
  }
  .rank-estimate-badge .rank-name:not(.unranked-text) {
    color: var(--accent-color);
  }
  .holistic-rank-container .rank-name:not(.unranked-text) {
    color: var(--accent-color);
  }
  .unranked-text {
    color: var(--lower-band-1) !important;
    font-weight: 600;
  }
`;

interface ComputedStyles {
    readonly color: string;
    readonly fontWeight: string;
}

const initializeData = (): BenchmarkViewServices => {
    _setupEnvironment();

    return MockServiceFactory.createViewDependencies();
};

describe("RankUniformity: Table Standard", (): void => {
    let container: HTMLElement;
    let dependencies: BenchmarkViewServices;

    beforeEach((): void => {
        container = document.createElement("div");
        document.body.appendChild(container);
        dependencies = initializeData();
    });

    afterEach((): void => {
        _teardownEnvironment(container);
    });

    it("should match standard table colors", async (): Promise<void> => {
        await _testBenchmarkRanks(container, dependencies);
    });
});



describe("RankUniformity: Unranked Bench", (): void => {
    let container: HTMLElement;
    let dependencies: BenchmarkViewServices;

    beforeEach((): void => {
        container = document.createElement("div");
        document.body.appendChild(container);
        dependencies = initializeData();
    });

    afterEach((): void => {
        _teardownEnvironment(container);
    });

    it("should match unranked table color", async (): Promise<void> => {
        _setupUnrankedMocks(dependencies);

        const view: BenchmarkView = new BenchmarkView(container, dependencies, (dependencies as BenchmarkViewTestDeps).appState);
        await view.render();

        const elements: HTMLElement[] = await _getUnrankedTableElements(container);
        elements.forEach((element: HTMLElement) => {
            const styles: ComputedStyles = _getStyles(element);
            expect(styles.color).toBe("rgb(50, 50, 50)");
            expect(styles.fontWeight).toBe("600");
        });
    });
});



async function _testBenchmarkRanks(container: HTMLElement, dependencies: BenchmarkViewServices): Promise<void> {
    const view: BenchmarkView = new BenchmarkView(container, dependencies, (dependencies as BenchmarkViewTestDeps).appState);
    await view.render();

    const allTime = await _waitForSelector(container, ".rank-badge-container:not(.session-badge):not(.rank-estimate-badge) .rank-name");
    const session = await _waitForSelector(container, ".session-badge .rank-name");
    const estimate = await _waitForSelector(container, ".rank-estimate-badge .rank-name");
    const holistic = await _waitForSelector(container, ".holistic-rank-container .rank-name");

    const standardColor = "rgb(100, 100, 100)";
    const accentColor = "rgb(193, 230, 227)";

    expect(_getStyles(allTime).color).toBe(standardColor);
    expect(_getStyles(session).color).toBe(standardColor);
    expect(_getStyles(estimate).color).toBe(accentColor);
    expect(_getStyles(holistic).color).toBe(accentColor);

    [allTime, session, estimate, holistic].forEach(element => {
        expect(_getStyles(element).fontWeight).toBe("700");
    });
}



function _setupUnrankedMocks(dependencies: BenchmarkViewServices): void {
    const unranked: unknown = { rankName: "Unranked", progressToNext: 0, continuousValue: 0, color: "grey" };

    vi.mocked(dependencies.rankEstimator.getRankEstimateMap).mockReturnValue({});
    vi.mocked(dependencies.rankEstimator.calculateHolisticEstimateRank).mockReturnValue(unranked as EstimatedRank);
    vi.mocked(dependencies.rankEstimator.getEstimateForValue).mockReturnValue(unranked as EstimatedRank);
    vi.mocked(dependencies.rankEstimator.calculateOverallRank).mockReturnValue(unranked as EstimatedRank);
    vi.mocked(dependencies.history.getBatchHighscores).mockResolvedValue({});
    vi.mocked(dependencies.session.getScenarioSessionBest).mockReturnValue(null);
    vi.mocked(dependencies.rank.calculateRank).mockReturnValue({
        currentRank: "Unranked",
        progressPercentage: 0,
        nextRank: null,
        rankLevel: -1
    });

}

async function _getUnrankedTableElements(container: HTMLElement): Promise<HTMLElement[]> {
    return Promise.all([
        _waitForSelector(container, ".rank-badge-container:not(.session-badge):not(.rank-estimate-badge) .rank-name"),
        _waitForSelector(container, ".holistic-rank-container .rank-name")
    ]);
}

function _setupEnvironment(): void {
    Object.defineProperty(document, "fonts", {
        value: { status: "loaded", ready: Promise.resolve() },
        configurable: true
    });

    const style: HTMLStyleElement = document.createElement("style");
    style.setAttribute("id", "mock-styles");
    style.innerHTML = MOCK_CSS;
    document.head.appendChild(style);
}

function _teardownEnvironment(container: HTMLElement): void {
    if (container.parentNode) {
        document.body.removeChild(container);
    }
    document.getElementById("mock-styles")?.remove();
}

function _getStyles(element: HTMLElement): ComputedStyles {
    const styles: CSSStyleDeclaration = window.getComputedStyle(element);

    return {
        color: styles.color,
        fontWeight: styles.fontWeight
    };
}

async function _waitForSelector(container: HTMLElement, selector: string): Promise<HTMLElement> {
    for (let index: number = 0; index < 50; index++) {
        const element: Element | null = container.querySelector(selector);
        if (element) {
            return element as HTMLElement;
        }
        await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 20));
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
}
