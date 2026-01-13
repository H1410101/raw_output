import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";
import { RankedView, RankedViewDependencies } from "../RankedView";
import { MockServiceFactory } from "./MockServiceFactory";
import { EstimatedRank } from "../../services/RankEstimator";


const MOCK_CSS: string = `
  :root {
    --lower-band-3: rgb(100, 100, 100);
    --lower-band-1: rgb(50, 50, 50);
  }
  .rank-name {
    color: var(--lower-band-3);
    font-weight: 700;
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

describe("RankUniformity: HUD Standard", (): void => {
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

    it("should match standard HUD colors", async (): Promise<void> => {
        await _testHudRanks(container, dependencies);
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

        const view: BenchmarkView = new BenchmarkView(container, dependencies, dependencies.appState);
        await view.render();

        const elements: HTMLElement[] = await _getUnrankedTableElements(container);
        elements.forEach((element: HTMLElement) => {
            const styles: ComputedStyles = _getStyles(element);
            expect(styles.color).toBe("rgb(50, 50, 50)");
            expect(styles.fontWeight).toBe("600");
        });
    });
});

describe("RankUniformity: Unranked HUD", (): void => {
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

    it("should match unranked HUD color", async (): Promise<void> => {
        _setupUnrankedMocks(dependencies);
        _setActiveStatus(dependencies);

        const rankedDeps: RankedViewDependencies = dependencies as unknown as RankedViewDependencies;
        const rankedView: RankedView = new RankedView(container, rankedDeps);
        await rankedView.render();

        const element: HTMLElement = await _waitForSelector(container, ".stat-item:not(.highlight) .rank-name");
        const styles: ComputedStyles = _getStyles(element);

        expect(styles.color).toBe("rgb(50, 50, 50)");
        expect(styles.fontWeight).toBe("600");
    });
});

async function _testBenchmarkRanks(container: HTMLElement, dependencies: BenchmarkViewServices): Promise<void> {
    const view: BenchmarkView = new BenchmarkView(container, dependencies, dependencies.appState);
    await view.render();

    const elements: HTMLElement[] = await Promise.all([
        _waitForSelector(container, ".rank-badge-container:not(.session-badge):not(.rank-estimate-badge) .rank-name"),
        _waitForSelector(container, ".session-badge .rank-name"),
        _waitForSelector(container, ".rank-estimate-badge .rank-name"),
        _waitForSelector(container, ".holistic-rank-container .rank-name")
    ]);

    elements.forEach((element: HTMLElement) => {
        const styles: ComputedStyles = _getStyles(element);
        expect(styles.color).toBe("rgb(100, 100, 100)");
        expect(styles.fontWeight).toBe("700");
    });
}

function _setActiveStatus(dependencies: BenchmarkViewServices): void {
    const session = (dependencies as unknown as RankedViewDependencies).rankedSession;


    session.state = {
        status: "ACTIVE",
        sequence: ["Scenario A"],
        currentIndex: 0,
        difficulty: "Advanced",
        startTime: new Date().toISOString(),
        initialGauntletComplete: false,
        rankedSessionId: "test-id"
    };

    vi.mocked(dependencies.session.isSessionActive).mockReturnValue(true);
}

async function _testHudRanks(container: HTMLElement, dependencies: BenchmarkViewServices): Promise<void> {
    container.innerHTML = "";
    _setActiveStatus(dependencies);

    const rankedDeps: RankedViewDependencies = dependencies as unknown as RankedViewDependencies;
    const rankedView: RankedView = new RankedView(container, rankedDeps);
    await rankedView.render();

    const elements: HTMLElement[] = await Promise.all([
        _waitForSelector(container, ".stat-item.highlight .rank-name"),
        _waitForSelector(container, ".stat-item:not(.highlight) .rank-name")
    ]);

    elements.forEach((element: HTMLElement) => {
        const styles: ComputedStyles = _getStyles(element);
        expect(styles.color).toBe("rgb(100, 100, 100)");
        expect(styles.fontWeight).toBe("700");
    });
}

function _setupUnrankedMocks(dependencies: BenchmarkViewServices): void {
    const unranked: unknown = { rankName: "Unranked", progressToNext: 0, continuousValue: 0 };

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
