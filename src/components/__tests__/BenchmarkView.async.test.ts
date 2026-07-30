/* eslint-disable max-lines-per-function, @typescript-eslint/naming-convention */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenchmarkScenario } from "../../data/benchmarks";
import { AppStateService } from "../../services/AppStateService";
import { KovaaksBenchmarkCategory, KovaaksBenchmarkResponse } from "../../types/KovaaksApiTypes";
import { PlayerProfile } from "../../types/PlayerTypes";
import { BenchmarkView, BenchmarkViewServices } from "../BenchmarkView";
import { MockServiceFactory } from "./MockServiceFactory";

interface MockTableComponent {
  readonly destroy: ReturnType<typeof vi.fn>;
  readonly focusScenario: ReturnType<typeof vi.fn>;
  readonly render: ReturnType<typeof vi.fn>;
  readonly updateScenarioRow: ReturnType<typeof vi.fn>;
  readonly updateVisualSettings: ReturnType<typeof vi.fn>;
}

const tableMockState = vi.hoisted(() => ({
  instances: [] as unknown[],
}));

vi.mock("../benchmark/BenchmarkTableComponent", () => {
  class BenchmarkTableComponent {
    public readonly destroy = vi.fn();
    public readonly focusScenario = vi.fn();
    public readonly updateScenarioRow = vi.fn();
    public readonly updateVisualSettings = vi.fn((): boolean => false);

    public readonly render = vi.fn(
      (
        scenarios: BenchmarkScenario[],
        _highscores: Record<string, number>,
        difficulty: string,
      ): HTMLElement => {
        const table = document.createElement("div");
        table.className = "benchmark-table";
        table.dataset.difficulty = difficulty;
        table.textContent = scenarios.map((scenario) => scenario.name).join(",");

        return table;
      },
    );

    public constructor() {
      tableMockState.instances.push(this);
    }
  }

  return { BenchmarkTableComponent };
});

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

interface ViewDependencies extends BenchmarkViewServices {
  readonly appState: AppStateService;
}

const noviceScenario: BenchmarkScenario = {
  category: "Clicking",
  subcategory: "Static",
  name: "Novice Scenario",
  thresholds: { Bronze: 100 },
};

const advancedScenario: BenchmarkScenario = {
  category: "Tracking",
  subcategory: "Reactive",
  name: "Advanced Scenario",
  thresholds: { Bronze: 200 },
};

const alice: PlayerProfile = {
  username: "alice",
  pfpUrl: "",
  steamId: "",
};

const bob: PlayerProfile = {
  username: "bob",
  pfpUrl: "",
  steamId: "",
};

describe("BenchmarkView async rendering", (): void => {
  beforeEach((): void => {
    tableMockState.instances = [];
    document.body.innerHTML = "";
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it("renders the latest queued profile and difficulty without clearing the visible table early", async (): Promise<void> => {
    const firstHighscores = _createDeferred<Record<string, number>>();
    let activeProfile = alice;
    let batchRequestCount = 0;

    const getBatchHighscores = vi.fn(
      (): Promise<Record<string, number>> => {
        batchRequestCount++;

        return batchRequestCount === 1
          ? firstHighscores.promise
          : Promise.resolve({ [advancedScenario.name]: 220 });
      },
    );
    const getActiveProfile = vi.fn((): PlayerProfile => activeProfile);
    const { mount, parent, view } = _createView({
      history: { getBatchHighscores },
      identity: { getActiveProfile },
    });

    mount.innerHTML = '<div data-visible-table="true">Existing table</div>';
    parent.style.opacity = "0";

    const firstRender = view.render();
    await vi.waitFor((): void => {
      expect(getBatchHighscores).toHaveBeenCalledTimes(1);
    });

    activeProfile = bob;
    view.updateDifficulty("Advanced");
    const queuedRender = view.render();

    expect(queuedRender).toBe(firstRender);
    expect(mount.querySelector("[data-visible-table]")).not.toBeNull();

    firstHighscores.resolve({ [noviceScenario.name]: 110 });
    await queuedRender;

    expect(getBatchHighscores).toHaveBeenNthCalledWith(
      1,
      alice.username,
      [noviceScenario.name],
    );
    expect(getBatchHighscores).toHaveBeenNthCalledWith(
      2,
      bob.username,
      [advancedScenario.name],
    );
    expect(_tableInstances()).toHaveLength(1);
    expect(_tableInstances()[0].render).toHaveBeenCalledWith(
      [advancedScenario],
      { [advancedScenario.name]: 220 },
      "Advanced",
      {},
    );
    expect(mount.querySelector(".benchmark-table")?.textContent).toBe(
      advancedScenario.name,
    );
    expect(parent.style.opacity).toBe("1");

    view.destroy();
  });

  it("does not let cached enrichment from an old generation update a replacement table", async (): Promise<void> => {
    const firstCache = _createDeferred<HighscoreCache | null>();
    const secondCache = _createDeferred<HighscoreCache | null>();
    let cacheRequestCount = 0;
    const profile = { ...alice, steamId: "steam-alice" };
    const getCachedKovaaksHighscores = vi.fn(
      (): Promise<HighscoreCache | null> => {
        cacheRequestCount++;

        return cacheRequestCount === 1 ? firstCache.promise : secondCache.promise;
      },
    );
    const fetchBenchmarkHighscores = vi.fn(
      (): Promise<KovaaksBenchmarkResponse> => Promise.resolve(_response()),
    );
    const { view } = _createView({
      history: {
        getCachedKovaaksHighscores,
        cacheKovaaksHighscores: vi.fn((): Promise<void> => Promise.resolve()),
      },
      identity: { getActiveProfile: vi.fn((): PlayerProfile => profile) },
      kovaaksApi: { fetchBenchmarkHighscores },
    });

    await view.render();
    await vi.waitFor((): void => {
      expect(getCachedKovaaksHighscores).toHaveBeenCalledTimes(1);
    });

    await view.render();
    await vi.waitFor((): void => {
      expect(getCachedKovaaksHighscores).toHaveBeenCalledTimes(2);
    });

    const currentTable = _tableInstances()[1];
    firstCache.resolve({
      categories: _categories(noviceScenario.name, 9900),
      timestamp: Date.now(),
    });
    await _flushAsyncWork();

    expect(currentTable.updateScenarioRow).not.toHaveBeenCalled();
    expect(fetchBenchmarkHighscores).not.toHaveBeenCalled();

    secondCache.resolve(null);
    await vi.waitFor((): void => {
      expect(fetchBenchmarkHighscores).toHaveBeenCalledTimes(1);
    });

    view.destroy();
  });

  it("uses each generation's captured difficulty for remote enrichment", async (): Promise<void> => {
    const noviceResponse = _createDeferred<KovaaksBenchmarkResponse>();
    const advancedResponse = _createDeferred<KovaaksBenchmarkResponse>();
    let fetchCount = 0;
    const profile = { ...alice, steamId: "steam-alice" };
    const fetchBenchmarkHighscores = vi.fn(
      (): Promise<KovaaksBenchmarkResponse> => {
        fetchCount++;

        return fetchCount === 1 ? noviceResponse.promise : advancedResponse.promise;
      },
    );
    const cacheKovaaksHighscores = vi.fn((): Promise<void> => Promise.resolve());
    const { view } = _createView({
      history: {
        getBatchHighscores: vi.fn(
          (_username: string, names: string[]): Promise<Record<string, number>> =>
            Promise.resolve({ [names[0]]: names[0] === noviceScenario.name ? 10 : 20 }),
        ),
        getCachedKovaaksHighscores: vi.fn(
          (): Promise<null> => Promise.resolve(null),
        ),
        cacheKovaaksHighscores,
      },
      identity: { getActiveProfile: vi.fn((): PlayerProfile => profile) },
      kovaaksApi: { fetchBenchmarkHighscores },
    });

    await view.render();
    await vi.waitFor((): void => {
      expect(fetchBenchmarkHighscores).toHaveBeenCalledTimes(1);
    });

    view.updateDifficulty("Advanced");
    await view.render();
    await vi.waitFor((): void => {
      expect(fetchBenchmarkHighscores).toHaveBeenCalledTimes(2);
    });

    expect(fetchBenchmarkHighscores).toHaveBeenNthCalledWith(
      1,
      profile.steamId,
      "benchmark-Novice",
    );
    expect(fetchBenchmarkHighscores).toHaveBeenNthCalledWith(
      2,
      profile.steamId,
      "benchmark-Advanced",
    );

    const currentTable = _tableInstances()[1];
    noviceResponse.resolve(_response(noviceScenario.name, 9900));
    await _flushAsyncWork();
    expect(currentTable.updateScenarioRow).not.toHaveBeenCalled();

    advancedResponse.resolve(_response(advancedScenario.name, 12300));
    await vi.waitFor((): void => {
      expect(currentTable.updateScenarioRow).toHaveBeenCalledWith(
        advancedScenario,
        20,
        123,
      );
    });
    expect(cacheKovaaksHighscores).toHaveBeenNthCalledWith(
      1,
      profile.steamId,
      "benchmark-Novice",
      _categories(noviceScenario.name, 9900),
    );

    view.destroy();
  });

  it("does not apply a delayed scenario update to a replacement table", async (): Promise<void> => {
    const delayedHighscore = _createDeferred<number>();
    const scoreRecordedCallbacks: ((scenarioName: string) => void)[] = [];
    const getHighscore = vi.fn((): Promise<number> => delayedHighscore.promise);
    const { view } = _createView({
      history: {
        getHighscore,
        onScoreRecorded: vi.fn((callback: (scenarioName: string) => void): void => {
          scoreRecordedCallbacks.push(callback);
        }),
      },
    });

    await view.render();
    await _flushAsyncWork();
    scoreRecordedCallbacks[0](noviceScenario.name);
    await vi.waitFor((): void => {
      expect(getHighscore).toHaveBeenCalledTimes(1);
    });

    await view.render();
    await _flushAsyncWork();
    const replacementTable = _tableInstances()[1];
    replacementTable.updateScenarioRow.mockClear();

    delayedHighscore.resolve(777);
    await _flushAsyncWork();

    expect(replacementTable.updateScenarioRow).not.toHaveBeenCalled();

    view.destroy();
  });
});

interface HighscoreCache {
  readonly categories: Record<string, KovaaksBenchmarkCategory>;
  readonly timestamp: number;
}

function _createView(
  overrides: Record<string, unknown> = {},
): { mount: HTMLElement; parent: HTMLElement; view: BenchmarkView } {
  const services = MockServiceFactory.createViewDependencies({
    appState: {
      getBenchmarkDifficulty: vi.fn((): string => "Novice"),
    },
    benchmark: {
      getAvailableDifficulties: vi.fn((): string[] => ["Novice", "Advanced"]),
      getBenchmarkId: vi.fn(
        (difficulty: string): string => `benchmark-${difficulty}`,
      ),
      getScenarios: vi.fn((difficulty: string): BenchmarkScenario[] =>
        difficulty === "Novice" ? [noviceScenario] : [advancedScenario],
      ),
    },
    ...overrides,
  }) as unknown as ViewDependencies;
  const parent = document.createElement("div");
  const mount = document.createElement("div");
  parent.appendChild(mount);
  document.body.appendChild(parent);

  return {
    mount,
    parent,
    view: new BenchmarkView(mount, services, services.appState),
  };
}

function _createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = (): void => undefined;
  const promise = new Promise<T>((resolve): void => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

function _tableInstances(): MockTableComponent[] {
  return tableMockState.instances as MockTableComponent[];
}

function _categories(
  scenarioName?: string,
  score: number = 0,
): Record<string, KovaaksBenchmarkCategory> {
  if (!scenarioName) {
    return {};
  }

  return {
    Category: {
      benchmark_progress: 0,
      category_rank: 0,
      rank_maxes: [],
      scenarios: {
        [scenarioName]: {
          score,
          scenario_rank: 0,
          rank_maxes: [],
          leaderboard_rank: 0,
          leaderboard_id: 0,
        },
      },
    },
  };
}

function _response(
  scenarioName?: string,
  score: number = 0,
): KovaaksBenchmarkResponse {
  return {
    benchmark_progress: 0,
    overall_rank: 0,
    categories: _categories(scenarioName, score),
    ranks: [],
  };
}

async function _flushAsyncWork(): Promise<void> {
  for (let iteration = 0; iteration < 5; iteration++) {
    await Promise.resolve();
  }
}
