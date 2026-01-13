import { describe, it, expect, beforeEach, vi } from "vitest";
import { RankedView } from "../RankedView";

describe("RankedView Labels and Stats", () => {
    let container: HTMLElement;
    let mockDeps: any;

    beforeEach(() => {
        document.body.innerHTML = "";
        document.documentElement.style.fontSize = "16px";
        container = document.createElement("div");
        document.body.appendChild(container);
        mockDeps = {
            rankedSession: {
                state: { status: "ACTIVE", sequence: ["Scenario A"], currentIndex: 0 },
                currentScenarioName: "Scenario A",
                onStateChanged: vi.fn()
            },
            session: {
                onSessionUpdated: vi.fn(),
                getAllScenarioSessionBests: vi.fn().mockReturnValue([]),
                getScenarioSessionBest: vi.fn().mockReturnValue(null),
                sessionStartTimestamp: Date.now()
            },
            benchmark: {
                getAvailableDifficulties: vi.fn().mockReturnValue(["Advanced"]),
                getScenarios: vi.fn().mockReturnValue([{ name: "Scenario A", thresholds: { "Silver": 10, "Gold": 20 }, category: "CAT", subcategory: "SUB" }]),
                getRankNames: vi.fn().mockReturnValue(["Silver", "Gold"])
            },
            estimator: {
                getIdentityMap: vi.fn().mockReturnValue({}),
                getScenarioIdentity: vi.fn().mockReturnValue({ continuousValue: -1 }),
                getScenarioContinuousValue: vi.fn().mockReturnValue(-1),
                getEstimateForValue: vi.fn().mockReturnValue({ rankName: "Unranked", progressToNext: 0, continuousValue: -1 }),
                calculateOverallRank: vi.fn().mockReturnValue({ rankName: "Unranked", progressToNext: 0, continuousValue: -1 }),
                calculateHolisticIdentityRank: vi.fn().mockReturnValue({ rankName: "Unranked", progressToNext: 0, continuousValue: -1 })
            },
            appState: {
                getBenchmarkDifficulty: vi.fn().mockReturnValue("Advanced"),
                setBenchmarkDifficulty: vi.fn()
            },
            history: {
                getLastScores: vi.fn().mockResolvedValue([])
            },
            visualSettings: {
                getSettings: vi.fn().mockReturnValue({
                    uiScaling: 1,
                    headerFontMultiplier: 1,
                    labelFontMultiplier: 1
                })
            },
            audio: {
                playLight: vi.fn(),
                playHeavy: vi.fn()
            }
        };

        _setupStyles();
    });

    function _setupStyles() {
        if (document.head.querySelector("#test-styles")) return;
        const style = document.createElement("style");
        style.id = "test-styles";
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

    it("should display TARGET and ACHIEVED labels instead of TARGET RANK and SESSION RANK", async () => {
        const view = new RankedView(container, mockDeps);
        await view.render();

        const labels = Array.from(container.querySelectorAll(".stat-item .label")).map(el => el.textContent);
        expect(labels).toContain("TARGET");
        expect(labels).toContain("ACHIEVED");
        expect(labels).not.toContain("TARGET RANK");
        expect(labels).not.toContain("SESSION RANK");
    });

    it("should display target as rank name + progress without the word Rank", async () => {
        mockDeps.estimator.calculateHolisticIdentityRank.mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 });
        const view = new RankedView(container, mockDeps);
        await view.render();

        const targetValue = container.querySelector(".stat-item.highlight .value");
        const text = targetValue?.textContent || "";

        expect(text).toContain("Silver");
        expect(text).toContain("+50%");
        expect(text).not.toContain("Rank");
    });

    it("should display Unranked for unscored session bests", async () => {
        const view = new RankedView(container, mockDeps);
        await view.render();

        const achievedValue = container.querySelector(".stat-item:not(.highlight) .value");
        expect(achievedValue?.textContent).toBe("Unranked");
    });

    it("should have vertically aligned TARGET and ACHIEVED labels", async () => {
        container.innerHTML = "";
        container.style.width = "1000px";

        // Force active state
        mockDeps.rankedSession.state.status = "ACTIVE" as any;
        const view = new RankedView(container, mockDeps);
        await view.render();

        const labels = Array.from(container.querySelectorAll(".stat-item .label"));
        if (labels.length < 2) throw new Error("Labels not found");

        // Filter for the actual HUD labels
        const hudLabels = labels.filter(l => l.closest(".ranked-stats-bar"));
        expect(hudLabels.length).toBe(2);

        const targetY = hudLabels[0].getBoundingClientRect().top;
        const achievedY = hudLabels[1].getBoundingClientRect().top;

        expect(targetY, `Labels mismatch: ${hudLabels[0].textContent}(${targetY}) vs ${hudLabels[1].textContent}(${achievedY})`).toBeCloseTo(achievedY, 1);
    });

    it("should have standardized font size for Target and Achieved rank names", async () => {
        mockDeps.estimator.getEstimateForValue.mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 });
        const view = new RankedView(container, mockDeps);
        await view.render();

        const targetRank = container.querySelector(".stat-item.highlight .rank-name");
        const achievedRank = container.querySelector(".stat-item:not(.highlight) .rank-name");

        if (!targetRank || !achievedRank) throw new Error("Rank name elements not found");

        const targetSize = window.getComputedStyle(targetRank).fontSize;
        const achievedSize = window.getComputedStyle(achievedRank).fontSize;

        expect(targetSize).toBe(achievedSize);
        // Should be 0.9rem (14.4px at 16px base)
        expect(targetSize).toBe("14.4px");
    });

    it("should have standardized font size for Target and Achieved progress labels", async () => {
        mockDeps.estimator.getEstimateForValue.mockReturnValue({ rankName: "Silver", progressToNext: 50, continuousValue: 1.5 });
        mockDeps.session.getAllScenarioSessionBests.mockReturnValue([{ scenarioName: "Scenario A", bestScore: 15 }]);
        const view = new RankedView(container, mockDeps);
        await view.render();

        const targetProgress = container.querySelector(".stat-item.highlight .rank-progress");
        const achievedProgress = container.querySelector(".stat-item:not(.highlight) .rank-progress");

        if (!targetProgress || !achievedProgress) throw new Error("Progress label elements not found");

        const targetSize = window.getComputedStyle(targetProgress).fontSize;
        const achievedSize = window.getComputedStyle(achievedProgress).fontSize;

        expect(targetSize).toBe(achievedSize);
        // Should be 0.65rem (10.4px at 16px base)
        expect(targetSize).toBe("10.4px");
    });
});
