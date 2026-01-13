import { expect, test, afterEach } from "vitest";
import { BenchmarkView } from "../BenchmarkView";
import { RankedView } from "../RankedView";
import { AppStateService } from "../../services/AppStateService";
import { BenchmarkService } from "../../services/BenchmarkService";

/**
 * Technical Regression Test: Difficulty Selector Position Synchronization.
 * 
 * Verifies that the difficulty tabs occupy the exact same pixel coordinates
 * when switching between the Benchmark Table and the Ranked View.
 */
test("difficulty.children.position.ext.syncAcrossViews", async (): Promise<void> => {
    _applyGlobalStyles();

    const container = document.createElement("div");
    container.className = "dashboard-panel";
    container.style.width = "1000px";
    container.style.height = "800px";
    container.style.position = "relative";
    document.body.appendChild(container);

    const appState = new AppStateService();
    const benchmarkService = new BenchmarkService();

    const mockDeps: any = {
        benchmark: benchmarkService,
        history: {
            getBatchHighscores: async () => ({}),
            getLastCheckTimestamp: async () => 1,
            onHighscoreUpdated: () => { },
            onScoreRecorded: () => { },
            getHighscore: async () => 0,
            getLastScores: async () => [],
        },
        rank: {
            calculateRank: () => ({ currentRank: "Silver", color: "#C0C0C0", progressPercentage: 50 }),
        },
        session: {
            onSessionUpdated: () => { },
            getAllScenarioSessionBests: () => [],
            getScenarioSessionBest: () => null,
            getDifficultySessionBest: () => null,
            isSessionActive: () => true,
            sessionStartTimestamp: Date.now(),
        },
        sessionSettings: {
            subscribe: () => { },
        },
        focus: {
            subscribe: () => { },
            getFocusState: () => null,
            clearFocus: () => { },
            focusScenario: () => { },
        },
        directory: {
            currentFolderName: "test",
        },
        visualSettings: {
            getSettings: () => ({
                theme: "dark",
                scenarioFontSize: "medium",
                uiScaling: 1,
                showDotCloud: true,
                showSessionBest: true,
                showAllTimeBest: true,
                categorySpacing: "medium",
                headerFontMultiplier: 1,
                labelFontMultiplier: 1,
                visDotSize: 1,
            }),
            subscribe: () => { },
            updateSetting: () => { },
        },
        audio: {
            playLight: () => { },
            playHeavy: () => { },
        },
        cloudflare: {
            isConfigured: () => false,
        },
        identity: {
            getIdentity: () => null,
        },
        rankedSession: {
            state: { status: "IDLE", sequence: ["Scenario A"], currentIndex: 0 },
            onStateChanged: () => { },
            currentScenarioName: "Scenario A",
        },
        estimator: {
            getScenarioIdentity: () => ({ continuousValue: 0 }),
            getEstimateForValue: () => ({ rankName: "Unranked", color: "#FFFFFF", progressToNext: 0, continuousValue: 0 }),
            calculateOverallRank: () => ({ rankName: "Unranked", color: "#FFFFFF", progressToNext: 0, continuousValue: 0 }),
            getScenarioContinuousValue: () => 0,
            evolveScenarioIdentity: () => { },
            getIdentityMap: () => ({}),
            calculateHolisticIdentityRank: () => ({ rankName: "Unranked", color: "#FFFFFF", progressToNext: 0, continuousValue: 0 }),
        },
        rankEstimator: {
            getScenarioIdentity: () => ({ continuousValue: 0 }),
            getEstimateForValue: () => ({ rankName: "Unranked", color: "#FFFFFF", progressToNext: 0, continuousValue: 0 }),
            getIdentityMap: () => ({}),
            calculateHolisticIdentityRank: () => ({ rankName: "Unranked", color: "#FFFFFF", progressToNext: 0, continuousValue: 0 }),
        },
        appState: appState,
        folderActions: {
            onLinkFolder: async () => { },
            onForceScan: async () => { },
            onUnlinkFolder: () => { },
        }
    };

    // 1. Render Benchmark View and capture positions
    const benchmarkMount = document.createElement("div");
    benchmarkMount.id = "view-benchmarks";
    benchmarkMount.className = "benchmark-view";
    container.appendChild(benchmarkMount);

    const benchmarkView = new BenchmarkView(benchmarkMount, mockDeps, appState);
    await benchmarkView.render();

    const benchmarkTabs = document.querySelector(".benchmark-view .difficulty-tabs");
    if (!benchmarkTabs) throw new Error("Benchmark difficulty tabs not found");
    const benchmarkRect = benchmarkTabs.getBoundingClientRect();

    // 2. Render Ranked View and capture positions
    container.innerHTML = ""; // Clear benchmark view
    const rankedMount = document.createElement("div");
    rankedMount.id = "view-ranked";
    rankedMount.className = "ranked-view";
    container.appendChild(rankedMount);

    const rankedView = new RankedView(rankedMount, mockDeps);
    await rankedView.render();

    const rankedTabs = document.querySelector(".ranked-view .difficulty-tabs");
    if (!rankedTabs) throw new Error("Ranked difficulty tabs not found");
    const rankedRect = rankedTabs.getBoundingClientRect();

    // 3. Assert exact synchronization
    expect(rankedRect.top).toBe(benchmarkRect.top);
    expect(rankedRect.left).toBe(benchmarkRect.left);
});

afterEach(() => {
    document.body.innerHTML = "";
});

function _applyGlobalStyles(): void {
    const style = document.createElement("style");
    style.innerHTML = `
        :root {
            --margin-spacing-multiplier: 1;
            --ui-scale: 1;
        }
        .dashboard-panel {
            padding: 1.5rem;
            box-sizing: border-box;
            position: absolute;
            top: 0;
            left: 0;
        }
        .benchmark-view, .ranked-view {
            width: 100%;
            height: 100%;
        }
        .difficulty-tabs {
            display: flex;
            gap: 0.4rem;
        }
        .tab-button {
            padding: 0.4rem 1rem;
            font-size: 1rem;
        }
        .benchmark-header-controls {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
        }
        .ranked-container {
            padding: 2rem;
        }
        .ranked-header {
            margin-bottom: 2rem;
        }
        .ranked-header h2 {
            margin: 0;
            font-size: 2rem;
        }
    `;
    document.head.appendChild(style);
}
