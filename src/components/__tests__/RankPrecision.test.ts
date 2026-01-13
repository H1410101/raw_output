import { describe, it, expect, beforeEach, vi } from "vitest";
import { RankedView } from "../RankedView";
import { BenchmarkView } from "../BenchmarkView";
import { AppStateService } from "../../services/AppStateService";

describe("Typography and Calculation Consistency", () => {
    let container: HTMLElement;
    let mockDeps: any;

    beforeEach(() => {
        document.body.innerHTML = "";
        container = document.createElement("div");
        document.body.appendChild(container);

        // Mock document.fonts
        Object.defineProperty(document, 'fonts', {
            value: { status: 'loaded', ready: Promise.resolve() },
            configurable: true
        });

        mockDeps = {
            rankedSession: {
                state: { status: "ACTIVE", sequence: ["Scenario A"], currentIndex: 0 },
                currentScenarioName: "Scenario A",
                onStateChanged: vi.fn(),
                startSession: vi.fn(),
                advance: vi.fn(),
                endSession: vi.fn(),
                retreat: vi.fn()
            },
            session: {
                on: vi.fn(),
                off: vi.fn(),
                onSessionUpdated: vi.fn(),
                onSessionUpdatedFiltered: vi.fn(),
                getAllScenarioSessionBests: vi.fn().mockReturnValue([]),
                getScenarioSessionBest: vi.fn().mockReturnValue(null),
                sessionStartTimestamp: Date.now(),
                isSessionActive: vi.fn().mockReturnValue(true)
            },
            benchmark: {
                getAvailableDifficulties: vi.fn().mockReturnValue(["Advanced"]),
                getScenarios: vi.fn().mockReturnValue([{
                    name: "Scenario A",
                    thresholds: { "Silver": 10, "Gold": 20 },
                    category: "CAT",
                    subcategory: "SUB"
                }]),
                getRankNames: vi.fn().mockReturnValue(["Silver", "Gold"]),
                getDifficulty: vi.fn().mockReturnValue("Advanced")
            },
            rankEstimator: {
                getEstimateMap: vi.fn().mockReturnValue({
                    "Scenario A": { continuousValue: 1.5, highestAchieved: 1.5, lastUpdated: new Date().toISOString() }
                }),
                getScenarioEstimate: vi.fn().mockReturnValue({ continuousValue: 1.5 }),
                getScenarioContinuousValue: vi.fn().mockReturnValue(1.5),
                getEstimateForValue: (val: number) => ({
                    rankName: val >= 1 ? "Silver" : "Unranked",
                    progressToNext: 50,
                    continuousValue: val
                }),
                calculateHolisticEstimateRank: vi.fn().mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 }),
                calculateOverallRank: vi.fn().mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 })
            },
            rank: {
                calculateRank: vi.fn().mockReturnValue({ currentRank: "Silver", progressPercentage: 50 })
            },
            appState: {
                getBenchmarkDifficulty: vi.fn().mockReturnValue("Advanced"),
                setBenchmarkDifficulty: vi.fn(),
                getIsFolderViewOpen: vi.fn().mockReturnValue(false),
                getIsSettingsMenuOpen: vi.fn().mockReturnValue(false),
                getBenchmarkScrollTop: vi.fn().mockReturnValue(0),
                on: vi.fn(),
                off: vi.fn()
            },
            history: {
                getHighscores: vi.fn().mockResolvedValue({ "Scenario A": 15 }),
                getBatchHighscores: vi.fn().mockResolvedValue({ "Scenario A": 15 }),
                getLastScores: vi.fn().mockResolvedValue([]),
                getLastCheckTimestamp: vi.fn().mockResolvedValue(1000),
                onHighscoreUpdated: vi.fn(),
                onScoreRecorded: vi.fn()
            },
            visualSettings: {
                getSettings: vi.fn().mockReturnValue({
                    uiScaling: 1,
                    headerFontMultiplier: 1,
                    labelFontMultiplier: 1,
                    rankFontMultiplier: 1,
                    showDotCloud: false,
                    showSessionBest: true,
                    showAllTimeBest: true,
                    scenarioFontSize: "Medium"
                }),
                subscribe: vi.fn(),
                on: vi.fn(),
                off: vi.fn()
            },
            audio: {
                playLight: vi.fn(),
                playHeavy: vi.fn()
            },
            directory: {
                currentFolderName: "test",
                originalSelectionName: "test",
                on: vi.fn()
            },
            sessionSettings: {
                subscribe: vi.fn(),
                getSettings: vi.fn()
            },
            focus: {
                subscribe: vi.fn(),
                getFocusState: vi.fn().mockReturnValue(null),
                clearFocus: vi.fn(),
                on: vi.fn()
            },
            cloudflare: {},
            identity: {
                on: vi.fn()
            },
            folderActions: {
                onLinkFolder: vi.fn(),
                onForceScan: vi.fn(),
                onUnlinkFolder: vi.fn()
            },
            estimator: null // Will be assigned below
        };

        mockDeps.estimator = mockDeps.rankEstimator;

        _setupGlobalStyles();
    });

    function _setupGlobalStyles() {
        const style = document.createElement("style");
        style.innerHTML = `
            :root { 
                --lower-band-3: rgb(100, 133, 171);
            }
            .rank-name { color: var(--lower-band-3); font-weight: 700; }
            .estimate-badge .rank-name { color: var(--lower-band-3); font-weight: 700; }
            
            /* The HUD styles we are testing */
            .stat-item.highlight .value { color: var(--lower-band-3); font-weight: 700; }
            .stat-item .rank-name { color: inherit; font-weight: 700; }
        `;
        document.head.appendChild(style);
    }

    it("should use the same calculation for Target in Session and Table Header", async () => {
        // Render BenchmarkView
        const benchmarkView = new BenchmarkView(container, mockDeps, mockDeps.appState as any);
        benchmarkView.refresh();

        // Wait for render
        await new Promise(r => setTimeout(r, 100));

        const tableLabel = container.querySelector(".holistic-rank-container .rank-name")?.textContent;

        container.innerHTML = "";

        // Render RankedView
        const rankedView = new RankedView(container, mockDeps);
        await rankedView.render();
        const sessionLabel = container.querySelector(".stat-item.highlight .rank-name")?.textContent;

        expect(tableLabel).toBe("Silver");
        expect(sessionLabel).toBe(tableLabel);
        expect(mockDeps.rankEstimator.calculateHolisticEstimateRank).toHaveBeenCalled();
    });

    it("should have consistent font weight for rank names in HUD vs Estimate Badges", async () => {
        // Render RankedView (HUD)
        const rankedView = new RankedView(container, mockDeps);
        await rankedView.render();
        const hudRank = container.querySelector(".stat-item .rank-name");
        if (!hudRank) throw new Error("HUD Rank element not found");

        const getWeight = (el: Element) => {
            const computed = window.getComputedStyle(el).fontWeight;
            if (computed === "700" || computed === "bold") return 700;
            return parseInt(computed) || 0;
        };
        const getColor = (el: Element) => window.getComputedStyle(el).color;

        const hudWeight = getWeight(hudRank);
        const hudColor = getColor(hudRank);

        container.innerHTML = "";

        // Render BenchmarkView (Table)
        const benchmarkView = new BenchmarkView(container, mockDeps, mockDeps.appState as any);
        benchmarkView.refresh();
        await new Promise(r => setTimeout(r, 100));

        const tableRank = container.querySelector(".estimate-badge .rank-name");
        if (!tableRank) throw new Error("Table Rank element not found");

        const tableWeight = getWeight(tableRank);
        const tableColor = getColor(tableRank);

        const expectedColor = "rgb(100, 133, 171)";

        expect(hudWeight).toBe(700);
        expect(tableWeight).toBe(700);

        expect(tableColor.toLowerCase()).toBe(expectedColor);
        expect(hudColor.toLowerCase()).toBe(expectedColor);
    });
});
