import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { KovaaksPollingManager, KovaaksPollingDependencies } from "../KovaaksPollingManager";
import { KovaaksApiService } from "../KovaaksApiService";
import { IdentityService } from "../IdentityService";
import { AppStateService } from "../AppStateService";
import { VisualSettingsService } from "../VisualSettingsService";
import { RankedSessionService } from "../RankedSessionService";
import { SessionService } from "../SessionService";
import { FocusManagementService } from "../FocusManagementService";
import { HistoryService } from "../HistoryService";
import { BenchmarkService } from "../BenchmarkService";

let dependencies: KovaaksPollingDependencies;
let tabChangeCallback: () => void = () => { };
let difficultyChangeCallback: () => void = () => { };
let profileChangeCallback: () => void = () => { };
let rankedStateChangeCallback: () => void = () => { };

describe("KovaaksPollingManager: Initial Sync", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        new KovaaksPollingManager(dependencies);
    });

    afterEach(() => {
        _teardown();
    });

    it("should trigger polling on construction for initial difficulty", () => {
        const fetchSpy = dependencies.kovaaksApi.fetchScenarioLastScores;
        expect(fetchSpy).toHaveBeenCalledWith("testuser", "Scenario A");
        expect(fetchSpy).toHaveBeenCalledWith("testuser", "Scenario B");
    });
});

describe("KovaaksPollingManager: Difficulty Triggers", () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
    });

    afterEach(() => {
        _teardown();
    });

    it("should trigger polling when difficulty changes", async () => {
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();
        (dependencies.appState.getBenchmarkDifficulty as Mock).mockReturnValue("Advanced");

        difficultyChangeCallback();
        await vi.runAllTimersAsync();

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenCalledWith("testuser", "Scenario A");
    });

    it("should NOT trigger polling twice for the same difficulty", async () => {
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();

        difficultyChangeCallback();
        await vi.runAllTimersAsync();

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).not.toHaveBeenCalled();
    });
});

describe("KovaaksPollingManager: Tab/Profile Triggers", () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
    });

    afterEach(() => {
        _teardown();
    });

    it("should trigger polling when switching to benchmarks tab", async () => {
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();
        (dependencies.appState.getBenchmarkDifficulty as Mock).mockReturnValue("Advanced");
        (dependencies.appState.getActiveTabId as Mock).mockReturnValue("nav-benchmarks");

        tabChangeCallback();
        await vi.runAllTimersAsync();

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenCalled();
    });

    it("should clear synced difficulties when profile changes", async () => {
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();

        profileChangeCallback();

        difficultyChangeCallback();
        await vi.runAllTimersAsync();

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenCalled();
    });
});

const setupPoll = async (manager: KovaaksPollingManager): Promise<void> => {
    await vi.runAllTimersAsync();
    vi.setSystemTime(2_000_000);
    const newScore = { attributes: { score: 100, epoch: "2000" } };
    (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([newScore]);
    (dependencies.history.getLastScores as Mock).mockResolvedValue([]);
    await _pollScenarioForTest(manager, "Scenario A");
};

describe("KovaaksPollingManager: Score Recording", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
    });

    afterEach(_teardown);

    it("should record scores and update highscores", async () => {
        const manager = new KovaaksPollingManager(dependencies);
        await setupPoll(manager);

        expect(dependencies.history.recordKovaaksScores).toHaveBeenCalledWith(
            "testuser", "Scenario A", [{ score: 100, date: "2000000" }]
        );
        expect(dependencies.history.updateMultipleHighscores).toHaveBeenCalledWith(
            "testuser", [{ scenarioName: "Scenario A", score: 100 }]
        );
    });
});

describe("KovaaksPollingManager: Run Registration", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
    });

    afterEach(_teardown);

    it("should register runs and focus scenario", async () => {
        const manager = new KovaaksPollingManager(dependencies);
        await setupPoll(manager);

        const expectedRun = {
            scenarioName: "Scenario A",
            score: 100,
            scenario: { name: "Scenario A" },
            difficulty: "Intermediate",
            timestamp: new Date(2000000)
        };
        expect(dependencies.session.registerMultipleRuns).toHaveBeenCalledWith([expectedRun]);
        expect(dependencies.focus.focusScenario).toHaveBeenCalledWith("Scenario A", "NEW_SCORE");
    });
});

describe("KovaaksPollingManager: Overlap Safety", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        (dependencies.benchmark.getScenarios as Mock).mockReturnValue([]);
    });

    afterEach(_teardown);

    it("should coalesce overlapping polls for the same profile and scenario", async () => {
        let resolveFetch: (scores: never[]) => void = (): void => { };
        const pendingFetch = new Promise<never[]>((resolve): void => {
            resolveFetch = resolve;
        });
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockReturnValue(pendingFetch);
        const manager = new KovaaksPollingManager(dependencies);

        const firstPoll = _pollScenarioForTest(manager, "Scenario A");
        const secondPoll = _pollScenarioForTest(manager, "Scenario A");

        expect(secondPoll).toBe(firstPoll);
        expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenCalledTimes(1);

        resolveFetch([]);
        await Promise.all([firstPoll, secondPoll]);
    });
});

describe("KovaaksPollingManager: Profile Safety", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        (dependencies.benchmark.getScenarios as Mock).mockReturnValue([]);
    });

    afterEach(_teardown);

    it("should discard a response after the active profile changes", async () => {
        let resolveFetch: (scores: { attributes: { score: number; epoch: string } }[]) => void = (): void => { };
        const pendingFetch = new Promise<{ attributes: { score: number; epoch: string } }[]>((resolve): void => {
            resolveFetch = resolve;
        });
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockReturnValue(pendingFetch);
        const manager = new KovaaksPollingManager(dependencies);
        const poll = _pollScenarioForTest(manager, "Scenario A");

        (dependencies.identity.getActiveProfile as Mock).mockReturnValue({ username: "nextuser" });
        profileChangeCallback();
        resolveFetch([{ attributes: { score: 100, epoch: "2000" } }]);
        await poll;

        expect(dependencies.history.getLastScores).not.toHaveBeenCalled();
        expect(dependencies.history.recordKovaaksScores).not.toHaveBeenCalled();
        expect(dependencies.session.registerMultipleRuns).not.toHaveBeenCalled();
    });

    it("starts a separate same-scenario poll after the profile generation changes", _startsNewGenerationPoll);
});

describe("KovaaksPollingManager: Score Normalization", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
    });

    afterEach(_teardown);

    it("should reject non-finite scores and process accepted scores chronologically", async () => {
        const manager = new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
        vi.setSystemTime(3_000_000);
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([
            { attributes: { score: 200, epoch: "3000" } },
            { attributes: { score: "100", epoch: "2000" } },
            { attributes: { score: Infinity, epoch: "4000" } },
            { attributes: { score: 300, epoch: "Infinity" } }
        ]);
        (dependencies.history.getLastScores as Mock).mockResolvedValue([]);

        await _pollScenarioForTest(manager, "Scenario A");

        _expectChronologicalScores();
    });

    it("does not treat historical API backfills as current activity", _ignoresBackfilledActivity);
    it.each([
        [2, false],
        [30, true],
    ])("uses a %i-minute configured activity window", _usesConfiguredActivityWindow);
    it("rejects scores older than the active ranked operation", _respectsRankedBoundary);
});

async function _startsNewGenerationPoll(): Promise<void> {
    let resolveFirstFetch: (scores: never[]) => void = (): void => undefined;
    const firstFetch = new Promise<never[]>((resolve): void => {
        resolveFirstFetch = resolve;
    });
    (dependencies.kovaaksApi.fetchScenarioLastScores as Mock)
        .mockReturnValueOnce(firstFetch)
        .mockResolvedValueOnce([]);
    const manager = new KovaaksPollingManager(dependencies);

    const firstPoll: Promise<boolean> = _pollScenarioForTest(manager, "Scenario A");
    (dependencies.identity.getActiveProfile as Mock).mockReturnValue({ username: "nextuser" });
    profileChangeCallback();
    const nextPoll: Promise<boolean> = _pollScenarioForTest(manager, "Scenario A");

    expect(nextPoll).not.toBe(firstPoll);
    expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenNthCalledWith(
        2,
        "nextuser",
        "Scenario A",
    );

    resolveFirstFetch([]);
    await expect(firstPoll).resolves.toBe(false);
    await expect(nextPoll).resolves.toBe(true);
}

async function _ignoresBackfilledActivity(): Promise<void> {
    const manager = new KovaaksPollingManager(dependencies);
    await vi.runAllTimersAsync();
    vi.setSystemTime(20 * 60 * 1000);
    const activitySpy = vi.spyOn(manager, "notifyLocalActivity");
    (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([
        { attributes: { score: 100, epoch: "1" } },
    ]);

    await _pollScenarioForTest(manager, "Scenario A");

    expect(activitySpy).not.toHaveBeenCalled();
    expect(dependencies.focus.focusScenario).not.toHaveBeenCalled();
    expect(dependencies.history.recordKovaaksScores).toHaveBeenCalledOnce();
    expect(dependencies.session.registerMultipleRuns).not.toHaveBeenCalled();
}

async function _usesConfiguredActivityWindow(timeoutMinutes: number, shouldRegister: boolean): Promise<void> {
    Object.defineProperty(dependencies.session, "sessionTimeoutMilliseconds", {
        configurable: true,
        value: timeoutMinutes * 60 * 1000,
    });
    const manager = new KovaaksPollingManager(dependencies);
    await vi.runAllTimersAsync();
    vi.setSystemTime(30 * 60 * 1000);
    (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([
        { attributes: { score: 100, epoch: "600" } },
    ]);

    await _pollScenarioForTest(manager, "Scenario A");

    if (shouldRegister) {
        expect(dependencies.session.registerMultipleRuns).toHaveBeenCalledOnce();
    } else {
        expect(dependencies.session.registerMultipleRuns).not.toHaveBeenCalled();
    }
}

async function _respectsRankedBoundary(): Promise<void> {
    Object.defineProperty(dependencies.session, "sessionTimeoutMilliseconds", { value: 30 * 60 * 1000 });
    Object.defineProperty(dependencies.session, "rankedStartTime", { value: 20 * 60 * 1000 });
    (dependencies.rankedSession as unknown as { state: { status: string } }).state = { status: "ACTIVE" };
    const manager = new KovaaksPollingManager(dependencies);
    await vi.runAllTimersAsync();
    vi.setSystemTime(30 * 60 * 1000);
    (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([
        { attributes: { score: 100, epoch: "1000" } },
    ]);

    await _pollScenarioForTest(manager, "Scenario A");

    expect(dependencies.session.registerMultipleRuns).not.toHaveBeenCalled();
}

describe("KovaaksPollingManager: Initial Sync Retry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        (dependencies.benchmark.getScenarios as Mock).mockReturnValue([{ name: "Scenario A" }]);
    });

    afterEach(_teardown);

    it("should retry a difficulty sync after its first request fails", async () => {
        vi.spyOn(console, "error").mockImplementation((): void => undefined);
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock)
            .mockRejectedValueOnce(new Error("temporary failure"))
            .mockResolvedValueOnce([]);

        new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
        difficultyChangeCallback();
        await vi.runAllTimersAsync();

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).toHaveBeenCalledTimes(2);
    });
});

describe("KovaaksPollingManager: Idle Ranked Polling", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        (dependencies.appState.getActiveTabId as Mock).mockReturnValue("nav-ranked");
        (dependencies.focus.getFocusState as Mock).mockReturnValue({ scenarioName: "Scenario A" });
    });

    afterEach(_teardown);

    it("does not repeatedly poll merely because the ranked tab is open", async () => {
        new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();

        await vi.advanceTimersByTimeAsync(30_000);

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).not.toHaveBeenCalled();
    });
});

describe("KovaaksPollingManager: Active Timer Lifecycle", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        (dependencies.appState.getActiveTabId as Mock).mockReturnValue("nav-ranked");
        (dependencies.focus.getFocusState as Mock).mockReturnValue({ scenarioName: "Scenario A" });
        (dependencies.benchmark.getScenarios as Mock).mockReturnValue([]);
        (dependencies.rankedSession as unknown as { state: { status: string } }).state = { status: "ACTIVE" };
    });

    afterEach(_teardown);

    it("stops active and batch timers when the ranked session becomes idle", async () => {
        new KovaaksPollingManager(dependencies);
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockClear();

        (dependencies.rankedSession as unknown as { state: { status: string } }).state = { status: "IDLE" };
        rankedStateChangeCallback();
        await vi.advanceTimersByTimeAsync(30_000);

        expect(dependencies.kovaaksApi.fetchScenarioLastScores).not.toHaveBeenCalled();
    });
});

describe("KovaaksPollingManager: Persistence Retry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
    });

    afterEach(_teardown);

    it("does not advance score history when the highscore update fails", async () => {
        vi.spyOn(console, "error").mockImplementation((): void => undefined);
        const manager = new KovaaksPollingManager(dependencies);
        await vi.runAllTimersAsync();
        vi.setSystemTime(2_000_000);
        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([
            { attributes: { score: 100, epoch: "2000" } },
        ]);
        (dependencies.history.updateMultipleHighscores as Mock)
            .mockRejectedValueOnce(new Error("temporary failure"))
            .mockResolvedValueOnce(undefined);

        await _pollScenarioForTest(manager, "Scenario A");
        await _pollScenarioForTest(manager, "Scenario A");

        expect(dependencies.history.recordKovaaksScores).toHaveBeenCalledOnce();
        expect(dependencies.session.registerMultipleRuns).toHaveBeenCalledOnce();
    });
});

function _teardown(): void {
    vi.restoreAllMocks();
    vi.useRealTimers();
}

function _pollScenarioForTest(manager: KovaaksPollingManager, scenarioName: string): Promise<boolean> {
    // @ts-expect-error - exercising private polling orchestration directly
    return manager._pollScenario(scenarioName);
}

function _expectChronologicalScores(): void {
    expect(dependencies.history.recordKovaaksScores).toHaveBeenCalledWith(
        "testuser",
        "Scenario A",
        [
            { score: 100, date: "2000000" },
            { score: 200, date: "3000000" }
        ]
    );
    expect(dependencies.session.registerMultipleRuns).toHaveBeenCalledWith([
        expect.objectContaining({ score: 200, timestamp: new Date(3000000) })
    ]);
}

function _createMockDependencies(): KovaaksPollingDependencies {
    return {
        kovaaksApi: _createKovaaksApiMock(),
        identity: _createIdentityMock(),
        appState: _createAppStateMock(),
        visualSettings: _createVisualSettingsMock(),
        rankedSession: _createRankedSessionMock(),
        session: _createSessionMock(),
        focus: _createFocusMock(),
        history: _createHistoryMock(),
        benchmark: _createBenchmarkMock(),
    };
}

function _createKovaaksApiMock(): KovaaksApiService {
    return {
        fetchScenarioLastScores: vi.fn().mockResolvedValue([])
    } as unknown as KovaaksApiService;
}

function _createIdentityMock(): IdentityService {
    return {
        getActiveProfile: vi.fn().mockReturnValue({ username: "testuser" }),
        onProfilesChanged: vi.fn().mockImplementation((callback: () => void) => {
            profileChangeCallback = callback;
        })
    } as unknown as IdentityService;
}

function _createAppStateMock(): AppStateService {
    return {
        getActiveTabId: vi.fn().mockReturnValue("nav-benchmarks"),
        getBenchmarkDifficulty: vi.fn().mockReturnValue("Intermediate"),
        onTabChanged: vi.fn().mockImplementation((callback: () => void) => {
            tabChangeCallback = callback;
        }),
        onDifficultyChanged: vi.fn().mockImplementation((callback: () => void) => {
            difficultyChangeCallback = callback;
        })
    } as unknown as AppStateService;
}

function _createVisualSettingsMock(): VisualSettingsService {
    return {
        getSettings: vi.fn().mockReturnValue({ allowBackgroundPolling: true }),
        subscribe: vi.fn()
    } as unknown as VisualSettingsService;
}

function _createRankedSessionMock(): RankedSessionService {
    return {
        state: { status: "IDLE" },
        onStateChanged: vi.fn().mockImplementation((callback: () => void) => {
            rankedStateChangeCallback = callback;
        })
    } as unknown as RankedSessionService;
}

function _createSessionMock(): SessionService {
    return {
        getRankedPlaylist: vi.fn().mockReturnValue(null),
        registerMultipleRuns: vi.fn(),
        isSessionActive: vi.fn().mockReturnValue(false),
        sessionTimeoutMilliseconds: 15 * 60 * 1000,
        rankedStartTime: null,
    } as unknown as SessionService;
}

function _createFocusMock(): FocusManagementService {
    return {
        subscribe: vi.fn(),
        getFocusState: vi.fn().mockReturnValue(null),
        focusScenario: vi.fn()
    } as unknown as FocusManagementService;
}

function _createHistoryMock(): HistoryService {
    return {
        getLastScores: vi.fn().mockResolvedValue([]),
        recordKovaaksScores: vi.fn().mockResolvedValue(undefined),
        updateMultipleHighscores: vi.fn().mockResolvedValue(undefined)
    } as unknown as HistoryService;
}

function _createBenchmarkMock(): BenchmarkService {
    return {
        getScenarios: vi.fn().mockReturnValue([{ name: "Scenario A" }, { name: "Scenario B" }]),
        getDifficulty: vi.fn().mockReturnValue("Intermediate")
    } as unknown as BenchmarkService;
}
