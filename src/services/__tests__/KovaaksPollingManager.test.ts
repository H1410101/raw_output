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
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        new KovaaksPollingManager(dependencies);
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
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
        new KovaaksPollingManager(dependencies);
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

describe("KovaaksPollingManager: Score Registration", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        dependencies = _createMockDependencies();
    });

    afterEach(() => {
        _teardown();
    });

    it("should update highscores when new scores are polled", async () => {
        const manager = new KovaaksPollingManager(dependencies);
        const newScore = {
            attributes: {
                score: 100,
                epoch: "2000"
            }
        };

        (dependencies.kovaaksApi.fetchScenarioLastScores as Mock).mockResolvedValue([newScore]);
        (dependencies.history.getLastScores as Mock).mockResolvedValue([]);

        // @ts-expect-error - accessing private method for testing
        await manager._pollScenario("Scenario A");

        expect(dependencies.history.recordKovaaksScores).toHaveBeenCalled();
        expect(dependencies.history.updateMultipleHighscores).toHaveBeenCalledWith(
            "testuser",
            [{ scenarioName: "Scenario A", score: 100 }]
        );
        expect(dependencies.session.registerMultipleRuns).toHaveBeenCalled();
        expect(dependencies.focus.focusScenario).toHaveBeenCalledWith("Scenario A", "NEW_SCORE");
    });
});

function _teardown(): void {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
        onStateChanged: vi.fn()
    } as unknown as RankedSessionService;
}

function _createSessionMock(): SessionService {
    return {
        getRankedPlaylist: vi.fn().mockReturnValue(null),
        registerMultipleRuns: vi.fn()
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
