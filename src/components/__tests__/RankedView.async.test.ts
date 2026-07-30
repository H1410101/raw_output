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

describe("RankedView async and pause states", (): void => {
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
    document.body.classList.remove("ranked-session-paused");
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

  it("renders only paused text with resume and end icon actions", async (): Promise<void> => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const resume = vi.fn();
    const endSession = vi.fn();
    const dependencies = MockServiceFactory.createViewDependencies({
      rankedSession: {
        state: _pausedState(),
        activeElapsedSeconds: 45,
        scenarioElapsedSeconds: 30,
        resume,
        endSession,
      },
      session: {
        getAllRankedSessionRuns: vi.fn(() => []),
      },
    }) as unknown as RankedViewDependencies;
    const view = new RankedView(container, dependencies);

    await view.render();

    const overlay = container.querySelector(".ranked-pause-overlay") as HTMLElement;
    const buttons = overlay.querySelectorAll("button");
    expect(overlay.textContent?.trim()).toBe("PAUSED");
    expect(buttons).toHaveLength(2);
    expect(container.querySelector(".ranked-active-content")).toHaveAttribute("inert");
    expect(document.body).toHaveClass("ranked-session-paused");

    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(buttons[0]);

    (buttons[0] as HTMLButtonElement).click();
    expect(resume).toHaveBeenCalledOnce();

    buttons[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    vi.advanceTimersByTime(620);
    expect(endSession).toHaveBeenCalledOnce();

    view.destroy();
  });

  it("supports keyboard hold-to-end and cancels holds on destroy", async (): Promise<void> => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const endSession = vi.fn();
    const dependencies = MockServiceFactory.createViewDependencies({
      rankedSession: { state: _pausedState(), endSession },
      session: { getAllRankedSessionRuns: vi.fn(() => []) },
    }) as unknown as RankedViewDependencies;
    const view = new RankedView(container, dependencies);
    await view.render();
    const endButton = container.querySelector<HTMLButtonElement>(".end-ranked-btn")!;

    endButton.focus();
    endButton.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    endButton.dispatchEvent(new FocusEvent("blur"));
    vi.advanceTimersByTime(620);
    expect(endSession).not.toHaveBeenCalled();

    endButton.focus();
    endButton.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    vi.advanceTimersByTime(620);
    expect(endSession).toHaveBeenCalledOnce();

    endSession.mockClear();
    endButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    view.destroy();
    vi.advanceTimersByTime(620);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("keeps cumulative active time in the ticking HUD", async (): Promise<void> => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dependencies = MockServiceFactory.createViewDependencies({
      rankedSession: {
        state: { ..._pausedState(), isPaused: false },
        activeElapsedSeconds: 45,
        scenarioElapsedSeconds: 30,
      },
      session: { getAllRankedSessionRuns: vi.fn(() => []) },
    }) as unknown as RankedViewDependencies;
    const view = new RankedView(container, dependencies);

    await view.render();
    vi.advanceTimersByTime(1_000);

    const rankedContainer = container.querySelector<HTMLElement>(".ranked-view-container")!;
    const timelineContainer = container.querySelector<HTMLElement>(".rank-timeline-container")!;
    expect(timelineContainer.getBoundingClientRect().width)
      .toBeCloseTo(rankedContainer.getBoundingClientRect().width);
    expect(container.querySelector(".ranked-title-row #ranked-help-btn")).not.toBeNull();
    expect(container.querySelector("#hud-session-stats")?.textContent).toBe("0 | 0:45");
    view.destroy();
  });
});

function _summaryState(): RankedSessionState {
  return {
    status: "SUMMARY",
    isPaused: false,
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

function _pausedState(): RankedSessionState {
  return {
    ..._summaryState(),
    status: "ACTIVE",
    isPaused: true,
    initialGauntletComplete: false,
    playedScenarios: [],
  };
}
