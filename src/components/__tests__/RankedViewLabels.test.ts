import { describe, it, expect, beforeEach, vi } from "vitest";
import { RankedView, RankedViewDependencies } from "../RankedView";
import { MockServiceFactory } from "./MockServiceFactory";


interface ViewLabelElements {
    targetRank: HTMLElement;
    achievedRank: HTMLElement;
}

interface ViewProgressElements {
    targetProgress: HTMLElement;
    achievedProgress: HTMLElement;
}

const initializeTest = (container: HTMLElement): RankedViewDependencies => {
    _resetEnvironment();
    document.body.appendChild(container);

    const deps: RankedViewDependencies = MockServiceFactory.createViewDependencies() as unknown as RankedViewDependencies;

    Object.defineProperty(deps.rankedSession, "state", {
        value: {
            status: "ACTIVE",
            sequence: ["Scenario A"],
            currentIndex: 0,
            difficulty: "Advanced",
            startTime: new Date().toISOString(),
            initialGauntletComplete: false,
            rankedSessionId: "test-id"
        },
        writable: true
    });



    _configureMockScenarios(deps);
    _setupStyles();

    return deps;
};

describe("RankedView Labels basic", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeTest(container);
    });

    it("should display TARGET and ACHIEVED labels", async (): Promise<void> => {
        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const labelTexts: (string | null)[] = Array.from(container.querySelectorAll(".stat-item .label"))
            .map((element: Element) => element.textContent);

        expect(labelTexts).toContain("TARGET");
        expect(labelTexts).toContain("ACHIEVED");
    });

    it("should display target rank and progress", async (): Promise<void> => {
        _mockHolisticRank(mockDeps, "Silver", 50);

        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const targetValue: Element | null = container.querySelector(".stat-item.highlight .value");
        const textContent: string = targetValue?.textContent ?? "";

        expect(textContent).toContain("Silver");
        expect(textContent).toContain("+50%");
    });
});

describe("RankedView Unranked displays", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeTest(container);
    });

    it("should display Unranked for unscored bests", async (): Promise<void> => {
        vi.mocked(mockDeps.estimator.calculateOverallRank).mockReturnValue({
            rankName: "Unranked",
            progressToNext: 0,
            continuousValue: -1
        });

        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const value: Element | null = container.querySelector(".stat-item:not(.highlight) .value");
        expect(value?.textContent).toBe("Unranked");
    });
});

describe("RankedView Alignment checks", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeTest(container);
    });

    it("should have vertically aligned labels", async (): Promise<void> => {
        _prepareAlignmentContainer(container);

        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const hudLabels: Element[] = _getHudLabels(container);
        expect(hudLabels.length).toBe(2);

        const targetY: number = hudLabels[0].getBoundingClientRect().top;
        const achievedY: number = hudLabels[1].getBoundingClientRect().top;

        expect(targetY).toBeCloseTo(achievedY, 1);
    });
});

describe("RankedView Size checks", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeTest(container);
    });

    it("should have consistent rank name sizes", async (): Promise<void> => {
        _mockEstimateForValue(mockDeps, "Silver", 50);

        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const elements: ViewLabelElements = _getRankNameElements(container);
        const targetSize: string = window.getComputedStyle(elements.targetRank).fontSize;
        const achievedSize: string = window.getComputedStyle(elements.achievedRank).fontSize;

        expect(targetSize).toBe(achievedSize);
        expect(targetSize).toBe("14.4" + "p" + "x");
    });

    it("should have consistent progress label sizes", async (): Promise<void> => {
        _mockEstimateAndSessionBest(mockDeps, "Silver", 50);

        const view: RankedView = new RankedView(container, mockDeps);
        await view.render();

        const elements: ViewProgressElements = _getProgressElements(container);
        const targetSize: string = window.getComputedStyle(elements.targetProgress).fontSize;
        const achievedSize: string = window.getComputedStyle(elements.achievedProgress).fontSize;

        expect(targetSize).toBe(achievedSize);
        expect(targetSize).toBe("10.4" + "p" + "x");
    });
});

function _resetEnvironment(): void {
    document.body.innerHTML = "";
    document.documentElement.style.fontSize = "1rem";
}

function _configureMockScenarios(deps: RankedViewDependencies): void {
    const thresholds: Record<string, number> = {};
    thresholds["Silver"] = 10;
    thresholds["Gold"] = 20;

    vi.mocked(deps.benchmark.getScenarios).mockReturnValue([
        { name: "Scenario A", thresholds, category: "CAT", subcategory: "SUB" }
    ]);
}

function _mockHolisticRank(deps: RankedViewDependencies, rank: string, progress: number): void {
    vi.mocked(deps.estimator.calculateHolisticEstimateRank).mockReturnValue({
        rankName: rank,
        progressToNext: progress,
        continuousValue: 1.5
    });
}

function _mockEstimateForValue(deps: RankedViewDependencies, rank: string, progress: number): void {
    vi.mocked(deps.estimator.getEstimateForValue).mockReturnValue({
        rankName: rank,
        progressToNext: progress,
        continuousValue: 1.5
    });
}

function _mockEstimateAndSessionBest(deps: RankedViewDependencies, rank: string, progress: number): void {
    _mockEstimateForValue(deps, rank, progress);
    vi.mocked(deps.session.getAllScenarioSessionBests).mockReturnValue([
        { scenarioName: "Scenario A", bestScore: 15 }
    ]);
}

function _prepareAlignmentContainer(container: HTMLElement): void {
    container.innerHTML = "";
    container.style.width = "1000px";
}

function _getHudLabels(container: HTMLElement): Element[] {
    const allLabels: Element[] = Array.from(container.querySelectorAll(".stat-item .label"));

    return allLabels.filter((label: Element) => label.closest(".ranked-stats-bar"));
}

function _getRankNameElements(container: HTMLElement): ViewLabelElements {
    const targetRank: HTMLElement | null = container.querySelector(".stat-item.highlight .rank-name");
    const achievedRank: HTMLElement | null = container.querySelector(".stat-item:not(.highlight) .rank-name");

    if (!targetRank || !achievedRank) {
        throw new Error("Rank name elements not found");
    }

    return { targetRank, achievedRank };
}

function _getProgressElements(container: HTMLElement): ViewProgressElements {
    const targetProgress: HTMLElement | null = container.querySelector(".stat-item.highlight .rank-progress");
    const achievedProgress: HTMLElement | null = container.querySelector(".stat-item:not(.highlight) .rank-progress");

    if (!targetProgress || !achievedProgress) {
        throw new Error("Progress label elements not found");
    }

    return { targetProgress, achievedProgress };
}

function _setupStyles(): void {
    if (document.head.querySelector("#test-styles")) {
        return;
    }

    const style: HTMLStyleElement = document.createElement("style");
    style.setAttribute("id", "test-styles");
    style.innerHTML = `
        :root { --label-font-multiplier: 1; --header-font-multiplier: 1; }
        .ranked-stats-bar { display: flex; align-items: flex-start; justify-content: space-around; }
        .stat-item { display: flex; flex-direction: column; align-items: center; }
        .stat-item .label { font-size: 0.65rem; line-height: 1; margin: 0; }
        .stat-item .value { font-size: 1.1rem; line-height: 1; display: flex; align-items: center; }
        .stat-item .rank-name { font-size: 0.9rem; line-height: 1; }
        .stat-item .rank-progress { font-size: 0.65rem; line-height: 1; }
    `;
    document.head.appendChild(style);
}
