import { KovaaksApiService } from "./KovaaksApiService";
import { IdentityService } from "./IdentityService";
import { AppStateService } from "./AppStateService";
import { VisualSettingsService, VisualSettings } from "./VisualSettingsService";
import { RankedSessionService } from "./RankedSessionService";
import { SessionService } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";
import { FocusManagementService } from "./FocusManagementService";
import { HistoryService } from "./HistoryService";
import { BenchmarkService } from "./BenchmarkService";
import { KovaaksScenarioScore } from "../types/KovaaksApiTypes";

/**
 * Dependencies for the KovaaksPollingManager.
 */
export interface KovaaksPollingDependencies {
    readonly kovaaksApi: KovaaksApiService;
    readonly identity: IdentityService;
    readonly appState: AppStateService;
    readonly visualSettings: VisualSettingsService;
    readonly rankedSession: RankedSessionService;
    readonly session: SessionService;
    readonly focus: FocusManagementService;
    readonly history: HistoryService;
    readonly benchmark: BenchmarkService;
}

/**
 * Manages the polling strategy for Kovaaks scores based on application state.
 */
export class KovaaksPollingManager {
    private static readonly _activeIntervalMs: number = 1000;
    private static readonly _inactiveBatchIntervalMs: number = 10000;
    private static readonly _backoffStartMs: number = 10000;
    private static readonly _sessionTimeoutMs: number = 15 * 60 * 1000;

    private readonly _kovaaksApi: KovaaksApiService;
    private readonly _identity: IdentityService;
    private readonly _appState: AppStateService;
    private readonly _visualSettings: VisualSettingsService;
    private readonly _rankedSession: RankedSessionService;
    private readonly _session: SessionService;
    private readonly _focus: FocusManagementService;
    private readonly _history: HistoryService;
    private readonly _benchmark: BenchmarkService;

    private _activeScenarioTimer: number | null = null;
    private _inactiveBatchTimer: number | null = null;
    private _backoffTimer: number | null = null;

    private _isWindowFocused: boolean = true;
    private _lastBenchmarkActivity: number = 0;
    private _currentBackoffMs: number = KovaaksPollingManager._backoffStartMs;
    private _suspectedActiveSession: boolean = false;
    private _lastLaunchedBenchmarkScenario: string | null = null;
    private _currentPollingActiveScenario: string | null = null;
    private _currentPollingActiveInterval: number | null = null;
    private readonly _lastPollValues: Map<string, string> = new Map();

    /**
     * Initializes the manager with required dependencies.
     * 
     * @param dependencies - Object containing required services.
     */
    public constructor(dependencies: KovaaksPollingDependencies) {
        this._kovaaksApi = dependencies.kovaaksApi;
        this._identity = dependencies.identity;
        this._appState = dependencies.appState;
        this._visualSettings = dependencies.visualSettings;
        this._rankedSession = dependencies.rankedSession;
        this._session = dependencies.session;
        this._focus = dependencies.focus;
        this._history = dependencies.history;
        this._benchmark = dependencies.benchmark;

        this._setupListeners();
    }

    /**
     * Notifies the manager that a benchmark scenario was launched.
     * 
     * @param scenarioName - The name of the launched scenario.
     */
    public notifyBenchmarkLaunched(scenarioName: string): void {
        this._lastLaunchedBenchmarkScenario = scenarioName;
        this._suspectedActiveSession = true;
        this._lastBenchmarkActivity = Date.now();
        this._currentBackoffMs = KovaaksPollingManager._backoffStartMs;
        this._rescheduleAll();
    }

    /**
     * Notifies the manager that a score was recorded locally.
     */
    public notifyLocalActivity(): void {
        this._lastBenchmarkActivity = Date.now();
        this._currentBackoffMs = KovaaksPollingManager._backoffStartMs;
        this._suspectedActiveSession = true;
        this._rescheduleAll();
    }

    private _setupListeners(): void {
        window.addEventListener("focus", () => this._handleFocusChange(true));
        window.addEventListener("blur", () => this._handleFocusChange(false));

        this._focus.subscribe(() => this._rescheduleAll());
        this._appState.onTabChanged(() => this._handleTabChange());
        this._rankedSession.onStateChanged(() => this._rescheduleAll());
        this._visualSettings.subscribe(() => this._rescheduleAll());
    }

    private _handleTabChange(): void {
        if (this._appState.getActiveTabId() === "nav-ranked") {
            this._suspectedActiveSession = true;
        }
        this._rescheduleAll();
    }

    private _handleFocusChange(focused: boolean): void {
        const wasFocused = this._isWindowFocused;
        this._isWindowFocused = focused;

        if (wasFocused !== focused) {
            this._rescheduleAll();
        }
    }

    private _rescheduleAll(): void {
        const settings = this._visualSettings.getSettings();
        const allowPolling = settings.allowBackgroundPolling || this._isWindowFocused;
        const activeProfile = this._identity.getActiveProfile();

        if (!allowPolling || !activeProfile) {
            this._stopAllTimers();

            return;
        }

        this._scheduleActiveScenarioPolling();
        this._scheduleInactiveBatchPolling();
    }

    private _stopAllTimers(): void {
        if (this._activeScenarioTimer) window.clearInterval(this._activeScenarioTimer);
        if (this._inactiveBatchTimer) window.clearInterval(this._inactiveBatchTimer);
        if (this._backoffTimer) window.clearTimeout(this._backoffTimer);

        this._activeScenarioTimer = null;
        this._inactiveBatchTimer = null;
        this._backoffTimer = null;
        this._currentPollingActiveScenario = null;
        this._currentPollingActiveInterval = null;
    }

    private _scheduleActiveScenarioPolling(): void {
        const scenario = this._getActiveScenario();

        if (!scenario) {
            this._clearActivePollingState();

            return;
        }

        if (this._isSessionActive()) {
            this._updateActiveScenarioPolling(scenario);
        } else if (this._appState.getActiveTabId() === "nav-benchmarks") {
            this._startBenchmarkBackoff(scenario);
        }
    }

    private _clearActivePollingState(): void {
        if (this._activeScenarioTimer) {
            window.clearInterval(this._activeScenarioTimer);
            this._activeScenarioTimer = null;
            this._currentPollingActiveScenario = null;
            this._currentPollingActiveInterval = null;
        }
    }

    private _updateActiveScenarioPolling(scenario: string): void {
        const settings = this._visualSettings.getSettings();
        const interval = this._calculateActiveInterval(settings);

        if (this._isPollingUnchanged(scenario, interval)) {
            return;
        }

        this._restartActiveTimer(scenario, interval);
    }

    private _calculateActiveInterval(settings: VisualSettings): number {
        const isLazy = !this._isWindowFocused && !settings.playAnimationsUnfocused;

        return isLazy ? KovaaksPollingManager._inactiveBatchIntervalMs : KovaaksPollingManager._activeIntervalMs;
    }

    private _isPollingUnchanged(scenario: string, interval: number): boolean {
        return (
            this._activeScenarioTimer !== null &&
            this._currentPollingActiveScenario === scenario &&
            this._currentPollingActiveInterval === interval
        );
    }

    private _restartActiveTimer(scenario: string, interval: number): void {
        if (this._activeScenarioTimer) {
            window.clearInterval(this._activeScenarioTimer);
        }

        if (this._backoffTimer) {
            window.clearTimeout(this._backoffTimer);
            this._backoffTimer = null;
        }

        this._currentPollingActiveScenario = scenario;
        this._currentPollingActiveInterval = interval;
        this._activeScenarioTimer = window.setInterval(
            () => this._pollScenario(scenario),
            interval
        );
    }

    private _startBenchmarkBackoff(scenario: string): void {
        if (this._activeScenarioTimer) {
            window.clearInterval(this._activeScenarioTimer);
            this._activeScenarioTimer = null;
        }

        this._scheduleBenchmarkBackoff(scenario);
    }

    private _scheduleInactiveBatchPolling(): void {
        const isActive = this._isSessionActive();

        if (!isActive) {
            if (this._inactiveBatchTimer) {
                window.clearInterval(this._inactiveBatchTimer);
                this._inactiveBatchTimer = null;
            }

            return;
        }

        if (this._inactiveBatchTimer) {
            return;
        }

        this._inactiveBatchTimer = window.setInterval(
            () => this._pollInactiveScenarios(),
            KovaaksPollingManager._inactiveBatchIntervalMs
        );
    }

    private _scheduleBenchmarkBackoff(scenario: string): void {
        if (this._currentBackoffMs > KovaaksPollingManager._sessionTimeoutMs) {
            return;
        }

        this._backoffTimer = window.setTimeout(async () => {
            await this._pollScenario(scenario);
            this._currentBackoffMs *= 1.5;
            this._scheduleBenchmarkBackoff(scenario);
        }, this._currentBackoffMs);
    }

    private _getActiveScenario(): string | null {
        const activeTab = this._appState.getActiveTabId();
        const state = this._focus.getFocusState();

        if (activeTab === "nav-ranked") {
            const rankedActive = this._rankedSession.currentScenarioName;
            const focusState = state?.scenarioName || null;

            return rankedActive || focusState;
        }

        if (activeTab === "nav-benchmarks") {
            const lastPlayed = state?.scenarioName || null;

            return this._lastLaunchedBenchmarkScenario || lastPlayed;
        }

        return null;
    }

    private _isSessionActive(): boolean {
        const activeTab = this._appState.getActiveTabId();

        if (activeTab === "nav-ranked") {
            const status = this._rankedSession.state.status;
            if (status === "SUMMARY") {
                return false;
            }

            return status !== "IDLE" || this._suspectedActiveSession;
        }

        if (activeTab === "nav-benchmarks") {
            const timeSinceActivity = Date.now() - this._lastBenchmarkActivity;

            return (this._suspectedActiveSession &&
                timeSinceActivity < KovaaksPollingManager._sessionTimeoutMs);
        }

        return false;
    }

    private async _pollScenario(scenarioName: string): Promise<void> {
        const profile = this._identity.getActiveProfile();
        if (!profile) return;

        const username = profile.username;

        try {
            const kovaaksScores = await this._kovaaksApi.fetchScenarioLastScores(username, scenarioName);
            this._logOnChange(scenarioName, kovaaksScores);

            const newScores = await this._filterNewScores(username, scenarioName, kovaaksScores);

            if (newScores.length === 0) return;

            const difficulty = this._benchmark.getDifficulty(scenarioName);
            const scenario = this._findBenchmarkScenario(scenarioName, difficulty);

            await this._history.recordKovaaksScores(username, scenarioName, newScores.map(s => ({
                score: s.attributes.score,
                date: s.attributes.epoch
            })));

            this._focus.focusScenario(scenarioName, "NEW_SCORE");

            this._session.registerMultipleRuns(newScores.map(score => ({
                scenarioName,
                score: score.attributes.score,
                scenario: scenario || null,
                difficulty,
                timestamp: new Date(Number(score.attributes.epoch))
            })));
        } catch (error) {
            console.error(`[KovaaksPolling] Failed to poll scenario ${scenarioName}:`, error);
        }
    }

    private _logOnChange(scenarioName: string, scores: any[]): void {
        const serialized = JSON.stringify(scores);
        const lastValue = this._lastPollValues.get(scenarioName);

        if (serialized !== lastValue) {
            this._lastPollValues.set(scenarioName, serialized);
        }
    }

    private async _filterNewScores(
        playerId: string,
        scenarioName: string,
        scores: KovaaksScenarioScore[]
    ): Promise<KovaaksScenarioScore[]> {
        const lastScores = await this._history.getLastScores(playerId, scenarioName, 1);
        let lastTimestamp = lastScores.length > 0 ? lastScores[0].timestamp : 0;

        if (isNaN(lastTimestamp)) {
            lastTimestamp = 0;
        }

        return scores.filter(score => {
            const scoreEpoch = Number(score.attributes?.epoch || 0);

            return scoreEpoch > lastTimestamp;
        });
    }

    private _findBenchmarkScenario(name: string, difficulty: string | null): BenchmarkScenario | undefined {
        const activeDifficulty = this._rankedSession.state.difficulty;
        const targetDifficulty = activeDifficulty || difficulty;

        if (!targetDifficulty) return undefined;

        return this._benchmark.getScenarios(targetDifficulty).find(scenarioDef => scenarioDef.name === name);
    }

    private async _pollInactiveScenarios(): Promise<void> {
        const profile = this._identity.getActiveProfile();
        if (!profile) return;

        const activeScenario = this._getActiveScenario();
        const difficulty = this._appState.getBenchmarkDifficulty();
        const scenarios = this._benchmark.getScenarios(difficulty);
        const playlist = this._session.getRankedPlaylist();

        const targets = scenarios
            .map(scenario => scenario.name)
            .filter(name => {
                const isNotActive = name !== activeScenario;
                const isInPlaylist = !playlist || playlist.has(name);

                return isNotActive && isInPlaylist;
            });

        if (targets.length === 0) return;

        try {
            await Promise.all(targets.map(name => this._pollScenario(name)));
        } catch (error) {
            console.error(`[KovaaksPolling] Failed batched concurrent poll:`, error);
        }
    }
}
