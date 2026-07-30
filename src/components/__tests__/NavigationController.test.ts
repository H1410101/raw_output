import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NavigationController,
  NavDependencies,
} from "../NavigationController";
import { BenchmarkView } from "../BenchmarkView";
import { RankedView } from "../RankedView";
import { AppStateService } from "../../services/AppStateService";
import { RankedSessionService } from "../../services/RankedSessionService";
import { FocusManagementService } from "../../services/FocusManagementService";
import { IdentityService } from "../../services/IdentityService";

interface NavigationTestFixture {
  readonly controller: NavigationController;
  readonly benchmarksButton: HTMLButtonElement;
  readonly rankedButton: HTMLButtonElement;
  readonly benchmarksView: HTMLElement;
  readonly rankedView: HTMLElement;
  readonly benchmarkRender: ReturnType<typeof vi.fn>;
  readonly rankedRender: ReturnType<typeof vi.fn>;
}

interface ActiveTabState {
  value: string;
}

describe("NavigationController", (): void => {
  afterEach(resetNavigationDom);

  it(
    "initializes once while preserving the selected-tab behavior",
    verifyIdempotentInitialization,
  );

  it("restores the active view without reattaching listeners", async (): Promise<void> => {
    const fixture: NavigationTestFixture = createNavigationFixture();
    fixture.controller.initialize();
    fixture.benchmarksButton.click();
    await Promise.resolve();

    fixture.controller.restoreActiveView();
    fixture.rankedButton.click();
    await Promise.resolve();

    expect(fixture.rankedRender).toHaveBeenCalledTimes(2);
  });
});

async function verifyIdempotentInitialization(): Promise<void> {
  const fixture: NavigationTestFixture = createNavigationFixture();

  fixture.controller.initialize();
  fixture.controller.initialize();

  expect(fixture.rankedRender).toHaveBeenCalledTimes(1);
  expect(fixture.benchmarkRender).not.toHaveBeenCalled();
  expect(fixture.rankedButton).toHaveClass("active");
  expect(fixture.rankedView).not.toHaveClass("hidden-view");

  fixture.benchmarksButton.click();
  await Promise.resolve();

  expect(fixture.benchmarkRender).toHaveBeenCalledTimes(1);
  expect(fixture.rankedRender).toHaveBeenCalledTimes(1);
  expect(fixture.benchmarksButton).toHaveClass("active");
  expect(fixture.benchmarksView).not.toHaveClass("hidden-view");
}

function createNavigationFixture(): NavigationTestFixture {
  const benchmarksButton: HTMLButtonElement = document.createElement("button");
  const rankedButton: HTMLButtonElement = document.createElement("button");
  const benchmarksView: HTMLElement = document.createElement("div");
  const rankedView: HTMLElement = document.createElement("div");
  const accountSelectionView: HTMLElement = document.createElement("div");
  const benchmarkRender = vi.fn().mockResolvedValue(undefined);
  const rankedRender = vi.fn().mockResolvedValue(undefined);
  const activeTabState: ActiveTabState = { value: "nav-ranked" };
  const dependencies: NavDependencies = createDependencies(
    activeTabState,
    benchmarkRender,
    rankedRender,
  );
  const controller: NavigationController = new NavigationController(
    { benchmarksButton, rankedButton },
    { benchmarksView, rankedView, accountSelectionView },
    dependencies,
  );

  return {
    controller,
    benchmarksButton,
    rankedButton,
    benchmarksView,
    rankedView,
    benchmarkRender,
    rankedRender,
  };
}

function createDependencies(
  activeTabState: ActiveTabState,
  benchmarkRender: ReturnType<typeof vi.fn>,
  rankedRender: ReturnType<typeof vi.fn>,
): NavDependencies {
  const appStateService = {
    getActiveTabId: vi.fn((): string => activeTabState.value),
    setActiveTabId: vi.fn((tabId: string): void => {
      activeTabState.value = tabId;
    }),
  } as unknown as AppStateService;
  const rankedSession = {
    currentScenarioName: null,
    state: { status: "IDLE" },
    onStateChanged: vi.fn(),
  } as unknown as RankedSessionService;

  return {
    benchmarkView: { render: benchmarkRender } as unknown as BenchmarkView,
    appStateService,
    rankedSession,
    rankedView: { render: rankedRender } as unknown as RankedView,
    focusService: { focusScenario: vi.fn() } as unknown as FocusManagementService,
    identityService: {
      hasLinkedAccount: vi.fn((): boolean => true),
    } as unknown as IdentityService,
  };
}

function resetNavigationDom(): void {
  document.body.innerHTML = "";
  document.body.className = "";
}
