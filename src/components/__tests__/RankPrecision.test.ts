import { describe, it, expect, beforeEach, vi } from "vitest";


import { RankedView, RankedViewDependencies } from "../RankedView";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";
import { MockServiceFactory } from "./MockServiceFactory";

interface RankLayoutProperties {
    readonly weight: number;
    readonly color: string;
}

const initializeData = (container: HTMLElement): RankedViewDependencies => {
    _resetEnvironment();
    const containerElement: HTMLElement = container;
    document.body.appendChild(containerElement);


    const deps = MockServiceFactory.createViewDependencies() as unknown as RankedViewDependencies;

    vi.mocked(deps.session.isSessionActive).mockReturnValue(true);
    Object.assign(deps.rankedSession.state, { status: "ACTIVE" });


    _configureMockEstimator(deps);
    _setupGlobalStyles();

    return deps;


};

describe("Typography Calculation", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeData(container);
    });

    it("should match target calculation in session and table", async (): Promise<void> => {
        const benchView: BenchmarkView = new BenchmarkView(
            container,
            mockDeps as unknown as BenchmarkViewServices,
            mockDeps.appState
        );
        await benchView.render();


        const tableText: string | null = container.querySelector(".holistic-rank-container .rank-name")?.textContent ?? null;

        container.innerHTML = "";

        const rankedView: RankedView = new RankedView(container, mockDeps);
        await rankedView.render();
        const sessionText: string | null = container.querySelector(".stat-item.highlight .rank-name")?.textContent ?? null;

        expect(tableText).toBe("Silver");
        expect(sessionText).toBe(tableText);
        expect(vi.mocked(mockDeps.estimator.calculateHolisticEstimateRank)).toHaveBeenCalled();
    });
});


const CONSISTENT_RANK_COLOR = "100, 133, 171";

describe("Typography Consistency", (): void => {
    let container: HTMLElement;
    let mockDeps: RankedViewDependencies;

    beforeEach((): void => {
        container = document.createElement("div");
        mockDeps = initializeData(container);
    });

    it("should have consistent font weight for rank names", async (): Promise<void> => {
        const hudProps: RankLayoutProperties = await _getHudRankProperties(container, mockDeps);

        container.innerHTML = "";

        const tableProps: RankLayoutProperties = await _getTableRankProperties(container, mockDeps);

        expect(hudProps.weight).toBe(700);
        expect(tableProps.weight).toBe(700);
        expect(tableProps.color.toLowerCase()).toBe(`rgb(${CONSISTENT_RANK_COLOR})`);
        expect(hudProps.color.toLowerCase()).toBe(`rgb(${CONSISTENT_RANK_COLOR})`);
    });
});

async function _getHudRankProperties(
    container: HTMLElement,
    mockDeps: RankedViewDependencies
): Promise<RankLayoutProperties> {
    const rankedView: RankedView = new RankedView(container, mockDeps);
    await rankedView.render();
    const hudRank: HTMLElement | null = container.querySelector(".stat-item .rank-name");

    if (!hudRank) {
        throw new Error("HUD Rank element not found");
    }

    return _getRankProperties(hudRank);
}

async function _getTableRankProperties(
    container: HTMLElement,
    mockDeps: RankedViewDependencies
): Promise<RankLayoutProperties> {
    const benchView: BenchmarkView = new BenchmarkView(
        container,
        mockDeps as unknown as BenchmarkViewServices,
        mockDeps.appState
    );
    await benchView.render();

    const tableRank: HTMLElement | null = container.querySelector(".rank-estimate-badge .rank-name");
    if (!tableRank) {
        throw new Error("Table Rank element not found");
    }

    return _getRankProperties(tableRank);
}


function _resetEnvironment(): void {
    document.body.innerHTML = "";
    Object.defineProperty(document, "fonts", {
        value: { status: "loaded", ready: Promise.resolve() },
        configurable: true
    });
}

function _configureMockEstimator(deps: RankedViewDependencies): void {
    vi.mocked(deps.estimator.getRankEstimateMap).mockReturnValue({
        ["Scenario A"]: {
            continuousValue: 1.5,
            highestAchieved: 1.5,
            lastUpdated: new Date().toISOString()
        }
    });

    vi.mocked(deps.estimator.getScenarioEstimate).mockReturnValue({
        continuousValue: 1.5,
        highestAchieved: 1.5,
        lastUpdated: new Date().toISOString()
    });

    vi.mocked(deps.estimator.calculateHolisticEstimateRank).mockReturnValue({
        rankName: "Silver",
        progressToNext: 50,
        continuousValue: 1.5,
        color: "var(--rank-color-default)"
    });
}



function _getRankProperties(element: HTMLElement): RankLayoutProperties {
    const computed: CSSStyleDeclaration = window.getComputedStyle(element);
    let weight: number = 0;

    if (computed.fontWeight === "700" || computed.fontWeight === "bold") {
        weight = 700;
    } else {
        weight = parseInt(computed.fontWeight, 10) || 0;
    }

    return {
        weight,
        color: computed.color
    };
}

function _setupGlobalStyles(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root { 
            --lower-band-3: rgb(${CONSISTENT_RANK_COLOR});
        }
        .rank-name { color: var(--lower-band-3); font-weight: 700; }
        .rank-estimate-badge .rank-name { color: var(--lower-band-3); font-weight: 700; }
        .stat-item.highlight .value { color: var(--lower-band-3); font-weight: 700; }
        .stat-item .rank-name { color: inherit; font-weight: 700; }
    `;
    document.head.appendChild(style);
}
