/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RankedSessionState } from "../../services/RankedSessionService";
import { RankedView, RankedViewDependencies } from "../RankedView";
import { MockServiceFactory } from "./MockServiceFactory";

vi.mock("../benchmark/BenchmarkScrollController", () => ({
  BenchmarkScrollController: class {
    public destroy(): void {}
    public initialize(): void {}
  },
}));

vi.mock("../visualizations/SummaryTimelineComponent", () => ({
  SummaryTimelineComponent: class {
    public destroy(): void {}
    public hasStarted(): boolean { return false; }
    public play(): void {}
    public render(): HTMLElement { return document.createElement("div"); }
    public resolveCollisions(): void {}
  },
}));

describe("RankedView summary queue", (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    document.body.innerHTML = "";

    if (typeof CSS.escape !== "function") {
      Object.defineProperty(CSS, "escape", {
        configurable: true,
        value: (value: string): string => value,
      });
    }
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.classList.remove("ranked-mode-active");
  });

  it("retries a summary item whose insertion timer was cancelled by blur", async (): Promise<void> => {
    let isFocused = true;
    vi.spyOn(document, "hasFocus").mockImplementation((): boolean => isFocused);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const dependencies = MockServiceFactory.createViewDependencies({
      appState: {
        getActiveTabId: vi.fn((): string => "nav-ranked"),
      },
      audio: {
        playSuccessPerc: vi.fn(),
      },
      estimator: {
        getScenarioEstimate: vi.fn(() => ({
          continuousValue: 2,
          highestAchieved: 2,
          lastUpdated: "",
          penalty: 0,
          lastPlayed: "",
          lastDecayed: "",
        })),
      },
      rankedSession: {
        state: _summaryState(),
      },
      session: {
        getAllRankedSessionRuns: vi.fn(() => [{
          scenarioName: "Scenario A",
          score: 120,
          timestamp: Date.now(),
        }]),
      },
    }) as unknown as RankedViewDependencies;
    const view = new RankedView(container, dependencies);

    await view.render();
    vi.advanceTimersByTime(500);

    isFocused = false;
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(100);
    expect(container.querySelectorAll(".scenario-summary-item")).toHaveLength(0);

    isFocused = true;
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(100);

    expect(container.querySelectorAll(".scenario-summary-item")).toHaveLength(1);
    expect(container.querySelector("#item-Scenario-A")).not.toBeNull();

    view.destroy();
  });
});

function _summaryState(): RankedSessionState {
  return {
    status: "SUMMARY",
    sequence: ["Scenario A"],
    currentIndex: 0,
    difficulty: "Advanced",
    startTime: null,
    initialGauntletComplete: true,
    rankedSessionId: 1,
    playedScenarios: ["Scenario A"],
    initialEstimates: { "Scenario A": 1 },
    previousSessionRanks: {},
    scenarioStartTime: null,
    accumulatedScenarioSeconds: { "Scenario A": 30 },
  };
}
