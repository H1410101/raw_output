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
    private readonly _syncedDifficulties: Set<string> = new Set();
    private _hasSeenActiveSession: boolean = false;
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
        this._rescheduleAll();
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
        this._appState.onDifficultyChanged(() => this._handleDifficultyChange());
        this._identity.onProfilesChanged(() => this._handleProfileChange());
        this._rankedSession.onStateChanged(() => this._rescheduleAll());
        this._visualSettings.subscribe(() => this._rescheduleAll());
    }

    private _handleTabChange(): void {
        const activeTab = this._appState.getActiveTabId();
        if (activeTab === "nav-ranked") {
            this._suspectedActiveSession = true;
        }

        if (activeTab === "nav-benchmarks") {
            this._syncCurrentBenchmarksIfNeeded();
        }

        this._rescheduleAll();
    }

    private _handleDifficultyChange(): void {
        this._syncCurrentBenchmarksIfNeeded();
        this._rescheduleAll();
    }

    private _handleProfileChange(): void {
        this._syncedDifficulties.clear();
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
        const activeProfile = this._identity.getActiveProfile();

        if (!activeProfile) {
            this._stopAllTimers();

            return;
        }

        const allowPolling = settings.allowBackgroundPolling || this._isWindowFocused;

        if (!allowPolling) {
            this._stopAllTimers();
            this._syncCurrentBenchmarksIfNeeded();

            return;
        }

        this._scheduleActiveScenarioPolling();
        this._scheduleInactiveBatchPolling();
    }

    private _syncCurrentBenchmarksIfNeeded(): void {
        const difficulty = this._appState.getBenchmarkDifficulty();
        const profile = this._identity.getActiveProfile();

        if (!profile) {
            return;
        }

        const syncKey = `${profile.username}:${difficulty}`;

        if (!this._syncedDifficulties.has(syncKey)) {
            this._syncedDifficulties.add(syncKey);
            this._pollInactiveScenarios(true);
        }
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
        } else if (this._hasSeenActiveSession && this._appState.getActiveTabId() === "nav-benchmarks") {
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
        this._clearActivePollingState();
        this._scheduleBenchmarkBackoff(scenario);
    }

    private _scheduleInactiveBatchPolling(): void {
        const isActive = this._isSessionActive();

        if (!isActive) {
            this._syncCurrentBenchmarksIfNeeded();

            if (this._inactiveBatchTimer) {
                window.clearInterval(this._inactiveBatchTimer);
                this._inactiveBatchTimer = null;
            }

            return;
        }

        if (this._inactiveBatchTimer) {
            return;
        }

        // When a session is active, we perform periodic batch polling to catch all played scenarios.
        this._pollInactiveScenarios();

        this._inactiveBatchTimer = window.setInterval(
            () => this._pollInactiveScenarios(),
            KovaaksPollingManager._inactiveBatchIntervalMs
        );
    }

    private _scheduleBenchmarkBackoff(scenario: string): void {
        if (this._backoffTimer) {
            window.clearTimeout(this._backoffTimer);
        }

        if (this._currentBackoffMs > KovaaksPollingManager._sessionTimeoutMs) {
            return;
        }

        this._backoffTimer = window.setTimeout(async (): Promise<void> => {
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

            const isActive = status !== "IDLE" || this._suspectedActiveSession;
            if (isActive) {
                this._hasSeenActiveSession = true;
            }

            return isActive;
        }

        if (activeTab === "nav-benchmarks") {
            const timeSinceActivity = Date.now() - this._lastBenchmarkActivity;
            const isActive = this._suspectedActiveSession &&
                timeSinceActivity < KovaaksPollingManager._sessionTimeoutMs;

            if (isActive) {
                this._hasSeenActiveSession = true;
            }

            return isActive;
        }

        return false;
    }

    private async _pollScenario(scenarioName: string): Promise<void> {
        const profile = this._identity.getActiveProfile();
        if (!profile) return;

        try {
            const kovaaksScores = await this._kovaaksApi.fetchScenarioLastScores(profile.username, scenarioName);
            this._logOnChange(scenarioName, kovaaksScores);

            const newScores = await this._filterNewScores(profile.username, scenarioName, kovaaksScores);
            if (newScores.length === 0) return;

            await this._processNewScores(profile.username, scenarioName, newScores);
        } catch (error) {
            console.error(`[KovaaksPolling] Failed to poll scenario ${scenarioName}: `, error);
        }
    }

    private async _processNewScores(username: string, scenarioName: string, newScores: KovaaksScenarioScore[]): Promise<void> {
        const difficulty = this._benchmark.getDifficulty(scenarioName);
        const scenario = this._findBenchmarkScenario(scenarioName, difficulty);

        await this._history.recordKovaaksScores(username, scenarioName, newScores.map((score: KovaaksScenarioScore) => ({
            score: score.attributes.score,
            date: score.attributes.epoch
        })));

        await this._history.updateMultipleHighscores(username, newScores.map((score: KovaaksScenarioScore) => ({
            scenarioName,
            score: score.attributes.score
        })));

        this._focus.focusScenario(scenarioName, "NEW_SCORE");

        this._session.registerMultipleRuns(newScores.map((score: KovaaksScenarioScore) => ({
            scenarioName,
            score: score.attributes.score,
            scenario: scenario || null,
            difficulty,
            timestamp: new Date(Number(score.attributes.epoch))
        })));
    }

    private _logOnChange(scenarioName: string, scores: KovaaksScenarioScore[]): void {
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
        const lastScores: { score: number; timestamp: number }[] =
            await this._history.getLastScores(playerId, scenarioName, 1);
        let lastTimestamp: number = lastScores.length > 0 ? lastScores[0].timestamp : 0;

        if (isNaN(lastTimestamp)) {
            lastTimestamp = 0;
        }

        return scores.filter((score: KovaaksScenarioScore) => {
            const scoreEpoch = Number(score.attributes?.epoch);
            const scoreValue = Number(score.attributes?.score);

            // Strict validation: Reject if timestamp or score is missing or NaN
            if (isNaN(scoreEpoch) || isNaN(scoreValue)) {
                return false;
            }

            const isNew = scoreEpoch > lastTimestamp;

            return isNew;
        });
    }

    private _findBenchmarkScenario(name: string, difficulty: string | null): BenchmarkScenario | undefined {
        const activeDifficulty = this._rankedSession.state.difficulty;
        const targetDifficulty = activeDifficulty || difficulty;

        if (!targetDifficulty) return undefined;

        return this._benchmark.getScenarios(targetDifficulty).find((scenarioDef: BenchmarkScenario) => scenarioDef.name === name);
    }

    private async _pollInactiveScenarios(force: boolean = false): Promise<void> {
        const profile = this._identity.getActiveProfile();
        if (!profile) return;

        const activeScenario = this._getActiveScenario();
        const difficulty = this._appState.getBenchmarkDifficulty();
        const scenarios = this._benchmark.getScenarios(difficulty);
        const playlist = this._session.getRankedPlaylist();

        const targets = scenarios
            .map((scenario: BenchmarkScenario) => scenario.name)
            .filter((name: string) => {
                const isNotActive = name !== activeScenario;
                const isInPlaylist = !playlist || playlist.has(name);

                return isNotActive && isInPlaylist;
            });

        if (targets.length === 0) return;

        try {
            // Use concurrency limiting to avoid overwhelming the API and UI
            const concurrencyLimit = 3;
            for (let i = 0; i < targets.length; i += concurrencyLimit) {
                // If the session is no longer active or the user switched tabs, stop polling
                if (!force && !this._isSessionActive()) break;

                const batch = targets.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map((name: string) => this._pollScenario(name)));
            }
        } catch (error) {
            console.error(`[KovaaksPolling] Failed batched sequential poll: `, error);
        }
    }
}
