import { BenchmarkService } from "./BenchmarkService";
import { SessionService, SessionRankRecord } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";
import { RankEstimator } from "./RankEstimator";
import { SessionSettingsService } from "./SessionSettingsService";
import { IdentityService } from "./IdentityService";

export type RankedSessionStatus = "IDLE" | "ACTIVE" | "COMPLETED" | "SUMMARY";

/**
 * Encapsulates the state of a ranked session.
 */
export interface RankedSessionState {
    readonly status: RankedSessionStatus;
    readonly sequence: string[];
    readonly currentIndex: number;
    readonly difficulty: string | null;
    readonly startTime: string | null;
    readonly initialGauntletComplete: boolean;
    readonly rankedSessionId: number | null;
    readonly playedScenarios: string[];
    readonly initialEstimates: Record<string, number>;
    readonly previousSessionRanks: Record<string, number>;
    readonly scenarioStartTime: string | null;
    readonly accumulatedScenarioSeconds: Record<string, number>;
}

interface ScenarioMetric {
    scenario: BenchmarkScenario;
    current: number;
    peak: number;
    gap: number;
    penalty: number;
}

interface DifficultySessionState {
    sequence: string[];
    currentIndex: number;
    initialGauntletComplete: boolean;
    playedScenarios: string[];
    initialEstimates: Record<string, number>;
    previousSessionRanks: Record<string, number>;
    lastSessionAchievements?: Record<string, number>;
    accumulatedScenarioSeconds: Record<string, number>;
}

interface PersistentRankedState {
    status: RankedSessionStatus;
    difficulty: string | null;
    startTime: string | null;
    rankedSessionId: number | null;
    scenarioStartTime: string | null;
    difficultyStates: Record<string, DifficultySessionState>;
}

/**
 * Dependencies required by the RankedSessionService.
 */
export interface RankedSessionServiceDependencies {
    readonly benchmarkService: BenchmarkService;
    readonly sessionService: SessionService;
    readonly rankEstimator: RankEstimator;
    readonly sessionSettings: SessionSettingsService;
    readonly identityService: IdentityService;
}

/**
 * Service managing deterministic "Ranked Runs" with guided progression.
 */
export class RankedSessionService {
    private readonly _benchmarkService: BenchmarkService;
    private readonly _sessionService: SessionService;
    private readonly _rankEstimator: RankEstimator;
    private readonly _sessionSettings: SessionSettingsService;
    private readonly _identityService: IdentityService;
    private static readonly _legacyStorageKey: string = "ranked_session_state_v2";

    private _status: RankedSessionStatus = "IDLE";
    private _difficulty: string | null = null;
    private _startTime: string | null = null;
    private _rankedSessionId: number | null = null;
    private _scenarioStartTime: string | null = null;

    private _sequence: string[] = [];
    private _currentIndex: number = 0;
    private _initialGauntletComplete: boolean = false;
    private _playedScenarios: Set<string> = new Set();
    private _initialEstimates: Record<string, number> = {};
    private _previousSessionRanks: Record<string, number> = {};
    private _lastSessionAchievements: Record<string, number> = {};
    private _accumulatedScenarioSeconds: Map<string, number> = new Map();

    private _difficultyStates: Record<string, DifficultySessionState> = {};

    private _tickerHandle: number | null = null;

    private readonly _onStateChanged: (() => void)[] = [];

    /**
     * Initializes the service with its required dependencies.
     *
     * @param dependencies - The set of service dependencies.
     */
    public constructor(dependencies: RankedSessionServiceDependencies) {
        this._benchmarkService = dependencies.benchmarkService;
        this._sessionService = dependencies.sessionService;
        this._rankEstimator = dependencies.rankEstimator;
        this._sessionSettings = dependencies.sessionSettings;
        this._identityService = dependencies.identityService;

        this._loadFromLocalStorage();
        this._subscribeToSessionEvents();
        this._subscribeToProfileChanges();
        this._startTicker();
    }

    private _subscribeToProfileChanges(): void {
        this._identityService.onProfilesChanged((): void => {
            this._loadFromLocalStorage();
            this._notifyListeners();
        });
    }

    private _getStorageKey(): string {
        const username = this._identityService.getKovaaksUsername();
        if (!username) {
            return RankedSessionService._legacyStorageKey;
        }

        return `${RankedSessionService._legacyStorageKey}_${username.toLowerCase()}`;
    }

    private _startTicker(): void {
        if (this._tickerHandle !== null) return;
        this._tickerHandle = window.setInterval(() => this.checkExpiration(), 1000);
    }

    /**
     * Retrieves the current state of the ranked session.
     *
     * @returns The combined status, sequence, and current index.
     */
    public get state(): RankedSessionState {
        return {
            status: this._status,
            sequence: [...this._sequence],
            currentIndex: this._currentIndex,
            difficulty: this._difficulty,
            startTime: this._startTime,
            initialGauntletComplete: this._initialGauntletComplete,
            rankedSessionId: this._rankedSessionId,
            playedScenarios: Array.from(this._playedScenarios),
            initialEstimates: { ...this._initialEstimates },
            previousSessionRanks: { ...this._previousSessionRanks },
            scenarioStartTime: this._scenarioStartTime,
            accumulatedScenarioSeconds: Object.fromEntries(this._accumulatedScenarioSeconds),
        };
    }

    /**
     * Returns the unique ID for the current ranked session.
     *
     * @returns The session ID or null if inactive.
     */
    public get sessionId(): number | null {
        return this._rankedSessionId;
    }

    /**
     * Returns whether the initial 3-scenario gauntlet has been completed at least once.
     *
     * @returns True if the summary screen has been passed.
     */
    public get initialGauntletComplete(): boolean {
        return this._initialGauntletComplete;
    }

    /**
     * Returns the name of the scenario the user should play next.
     *
     * @returns Scenario name, or null if session is inactive or completed.
     */
    public get currentScenarioName(): string | null {
        if (this._status !== "ACTIVE" || this._currentIndex >= this._sequence.length) {
            return null;
        }

        return this._sequence[this._currentIndex];
    }

    /**
     * Returns the elapsed time in seconds since the session started.
     *
     * @returns Seconds elapsed, or 0 if inactive.
     */
    public get elapsedSeconds(): number {
        if (!this._startTime || this._status === "IDLE") {
            return 0;
        }

        const start: number = new Date(this._startTime).getTime();
        const now: number = Date.now();

        return Math.floor((now - start) / 1000);
    }

    /**
     * Returns the elapsed time in seconds since the current scenario was entered.
     * 
     * @returns Seconds elapsed, or 0 if inactive.
     */
    public get scenarioElapsedSeconds(): number {
        if (this._status === "IDLE") {
            return 0;
        }

        const currentScenario = this.currentScenarioName;
        const accumulated = currentScenario ? (this._accumulatedScenarioSeconds.get(currentScenario) || 0) : 0;

        if (!this._scenarioStartTime) {
            return accumulated;
        }

        const start: number = new Date(this._scenarioStartTime).getTime();
        const now: number = Date.now();

        return accumulated + Math.floor((now - start) / 1000);
    }

    /**
     * Returns whether the session is considered active (ACTIVE, COMPLETED, or SUMMARY).
     * 
     * @returns True if the session is active.
     */
    public isSessionActive(): boolean {
        return (
            this._status === "ACTIVE" ||
            this._status === "COMPLETED" ||
            this._status === "SUMMARY"
        );
    }

    /**
     * Returns the remaining time in seconds for the current session.
     * 
     * @returns Seconds remaining, or 0 if inactive or expired.
     */
    public get remainingSeconds(): number {
        if (this._status !== "ACTIVE" && this._status !== "COMPLETED") {
            return 0;
        }

        const totalMinutes: number = this._sessionSettings.getSettings().rankedIntervalMinutes;
        const totalSeconds: number = totalMinutes * 60;
        const elapsed: number = this.elapsedSeconds;

        return Math.max(0, totalSeconds - elapsed);
    }

    /**
     * Checks if the given timestamp corresponds to today's date.
     *
     * @param timestamp - The timestamp to check.
     * @returns True if the timestamp is from today.
     */
    private _isToday(timestamp: number | null): boolean {
        if (!timestamp) {
            return false;
        }

        const date = new Date(timestamp);
        const now = new Date();

        return (
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
        );
    }

    /**
     * Starts a new ranked session for the given difficulty.
     *
     * @param difficulty - The difficulty tier to play.
     */
    public startSession(difficulty: string): void {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        if (scenarios.length === 0) {
            return;
        }

        this._prepareSessionStart(difficulty);
        if (this._difficultyStates[difficulty]) {
            this._rankEstimator.initializePeakRanks();
            this._resumeExistingSession();

            return;
        }

        this._rankEstimator.initializePeakRanks();
        this._initializeNewSession(difficulty);
    }

    private _prepareSessionStart(difficulty: string): void {
        const isToday = this._isToday(this._rankedSessionId);

        if (!isToday) {
            this._difficultyStates = {};
            this._rankedSessionId = Date.now();
        }

        if (this._difficulty && this._difficulty !== difficulty) {
            this._snapshotScenarioTime();
            this._snapshotCurrentDifficultyState();
        }

        this._difficulty = difficulty;
    }

    private _initializeNewSession(difficulty: string): void {
        this._status = "ACTIVE";
        this._startTime = new Date().toISOString();
        this._currentIndex = 0;
        this._sequence = [];
        this._initialGauntletComplete = false;
        this._playedScenarios.clear();
        this._initialEstimates = {};
        this._previousSessionRanks = {};
        this._lastSessionAchievements = {};
        this._accumulatedScenarioSeconds.clear();

        const batch = this._generateNextBatch(difficulty, []);
        this._sequence.push(...batch);

        this._sessionService.startRankedSession(Date.now());
        this._sessionService.setRankedPlaylist(this._sequence);
        this._recordInitialEstimates(batch);
        this._scenarioStartTime = new Date().toISOString();

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    private _resumeExistingSession(): void {
        if (!this._difficulty || !this._difficultyStates[this._difficulty]) {
            return;
        }

        this._applyDifficultyStateSnapshot(this._difficultyStates[this._difficulty]);
        this._status = "ACTIVE";
        this._startTime = new Date().toISOString();

        this._jumpToNextUnplayedScenario();
        if (this._status === "ACTIVE") {
            this._scenarioStartTime = new Date().toISOString();
        }

        this._sessionService.startRankedSession(Date.now());
        this._sessionService.setRankedPlaylist(this._sequence);
        this._saveToLocalStorage();
        this._notifyListeners();
    }

    private _snapshotCurrentDifficultyState(): void {
        if (!this._difficulty) return;

        this._difficultyStates[this._difficulty] = {
            sequence: [...this._sequence],
            currentIndex: this._currentIndex,
            initialGauntletComplete: this._initialGauntletComplete,
            playedScenarios: Array.from(this._playedScenarios),
            initialEstimates: { ...this._initialEstimates },
            previousSessionRanks: { ...this._previousSessionRanks },
            lastSessionAchievements: { ...this._lastSessionAchievements },
            accumulatedScenarioSeconds: Object.fromEntries(this._accumulatedScenarioSeconds),
        };
    }

    private _applyDifficultyStateSnapshot(state: DifficultySessionState): void {
        this._sequence = state.sequence;
        this._currentIndex = state.currentIndex;
        this._initialGauntletComplete = state.initialGauntletComplete;
        this._playedScenarios = new Set(state.playedScenarios);
        this._initialEstimates = state.initialEstimates;
        this._previousSessionRanks = state.previousSessionRanks || {};
        this._lastSessionAchievements = state.lastSessionAchievements || {};
        this._accumulatedScenarioSeconds = new Map(Object.entries(state.accumulatedScenarioSeconds));
    }

    private _jumpToNextUnplayedScenario(): void {
        let maxPlayedIndex = -1;
        for (let i = 0; i < this._sequence.length; i++) {
            if (this._playedScenarios.has(this._sequence[i])) {
                maxPlayedIndex = i;
            }
        }

        this._currentIndex = maxPlayedIndex + 1;

        if (this._currentIndex >= this._sequence.length) {
            if (this._initialGauntletComplete || this._currentIndex >= 3) {
                this.extendSession();
            } else {
                this._status = "COMPLETED";
            }
        }
    }

    /**
     * Manually retreats the sequence to the previous scenario.
     */
    public retreat(): void {
        if (this._status === "IDLE" || this._currentIndex <= 0) {
            return;
        }

        this._snapshotScenarioTime();
        this._currentIndex--;
        this._scenarioStartTime = new Date().toISOString();
        // If we were in COMPLETED, going back makes us ACTIVE
        this._status = "ACTIVE";

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Manually advances the sequence to the next scenario.
     */
    public advance(): void {
        if (this._status !== "ACTIVE" || this._currentIndex >= this._sequence.length) {
            return;
        }

        this._snapshotScenarioTime();
        this._currentIndex++;
        this._scenarioStartTime = new Date().toISOString();

        if (this._currentIndex >= this._sequence.length) {
            if (this._initialGauntletComplete) {
                this.extendSession();
            } else {
                this._status = "COMPLETED";
            }
        }

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Extends a completed or near-complete session by adding a new batch.
     */
    public extendSession(): void {
        if (!this._difficulty || !this._startTime) {
            return;
        }

        this._initialGauntletComplete = true;

        const excludeList = this._sequence.slice(-3);
        const batch = this._generateNextBatch(this._difficulty, excludeList);

        this._sequence.push(...batch);
        this._status = "ACTIVE";

        this._sessionService.setRankedPlaylist(this._sequence);
        this._recordInitialEstimates(batch);
        this._snapshotScenarioTime();
        this._scenarioStartTime = new Date().toISOString();

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Gracefully transitions the session to a summary state.
     * This stops the timer and marks the session as ready for review.
     */
    public endSession(): void {
        if (this._status === "IDLE" || this._status === "SUMMARY") {
            return;
        }

        this._snapshotScenarioTime();
        this._status = "SUMMARY";

        this._evolveRanksForPlayedScenarios();

        this._sessionService.stopRankedSession();

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Checks if the session timer has expired and transitions to summary if so.
     */
    public checkExpiration(): void {
        const isToday = this._isToday(this._rankedSessionId);

        if (!isToday && !this.isSessionActive()) {
            if (this._rankedSessionId === null && Object.keys(this._difficultyStates).length === 0) {
                return;
            }

            this._difficultyStates = {};
            this._rankedSessionId = null;
            this._saveToLocalStorage();
            this._notifyListeners();

            return;
        }

        if (this._status !== "ACTIVE" && this._status !== "COMPLETED") {
            return;
        }

        if (this.remainingSeconds <= 0) {
            this.endSession();
        }
    }

    /**
     * Resets the ranked session state to idle.
     */
    public reset(): void {
        const wasSessionConcluded: boolean = this._status === "SUMMARY";

        if (this._difficulty) {
            if (wasSessionConcluded) {
                this._playedScenarios.clear();
                this._accumulatedScenarioSeconds.clear();
                this._currentIndex = 0;
                this._scenarioStartTime = null;
                this._initialGauntletComplete = false;

                // Transfer last session achievements to previous session ranks
                this._previousSessionRanks = {
                    ...this._previousSessionRanks,
                    ...this._lastSessionAchievements
                };
                this._lastSessionAchievements = {};
            }
            this._snapshotCurrentDifficultyState();
        }


        this._status = "IDLE";
        this._difficulty = null;

        this._sessionService.stopRankedSession();

        this._saveToLocalStorage();
        this._notifyListeners();
    }


    /**
     * Checks if the user has played the current target scenario in this session.
     *
     * @returns True if a score has been recorded.
     */
    public hasPlayedCurrent(): boolean {
        const current: string | null = this.currentScenarioName;
        if (!current) {
            return false;
        }

        const bests: SessionRankRecord[] = this._sessionService.getAllRankedScenarioBests();

        return bests.some((record: SessionRankRecord): boolean => record.scenarioName === current);
    }

    /**
     * Subscribes to changes in the ranked session state.
     *
     * @param callback - Function to call on state change.
     */
    public onStateChanged(callback: () => void): void {
        this._onStateChanged.push(callback);
    }

    /**
     * Generates a deterministic batch of three scenarios based on skill gap and current strength.
     *
     * @param difficulty - The difficulty tier to pull scenarios from.
     * @param excludeScenarios - List of scenario names to exclude from the batch.
     * @returns An array containing exactly three scenario names, or fewer if the pool is exhausted.
     */
    /**
     * Generates a deterministic batch of three scenarios based on Strong-Weak-Mid strategy.
     *
     * @param difficulty - The difficulty tier to pull scenarios from.
     * @param excludeScenarios - List of scenario names to exclude from the batch.
     * @returns An array containing exactly three scenario names, or fewer if the pool is exhausted.
     */
    private _generateNextBatch(difficulty: string, excludeScenarios: string[]): string[] {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        const rankNames: string[] = this._benchmarkService.getRankNames(difficulty);
        const maxRank: number = rankNames.length;

        const pool: BenchmarkScenario[] = scenarios.filter((scenario: BenchmarkScenario) => !excludeScenarios.includes(scenario.name));

        if (pool.length < 3) {
            console.log(`[Ranked] Pool too small (${pool.length}), using fallback batch`);

            return this._getFallbackBatch(pool);
        }

        let metrics: ScenarioMetric[] = this._calculateScenarioMetrics(pool, maxRank);

        const strongCandidates = this._getWeightedStrongScenarios(metrics);
        if (strongCandidates.length === 0) {
            return this._getFallbackBatch(pool);
        }
        this._logTopCandidates("Strong", strongCandidates);
        const strongMetric = strongCandidates[0].metric;

        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== strongMetric.scenario.name);

        const weakCandidates = this._getWeightedWeakScenarios(metrics);
        if (weakCandidates.length === 0) {
            return [strongMetric.scenario.name, ...this._getFallbackBatch(pool.filter((scenario: BenchmarkScenario) => scenario.name !== strongMetric.scenario.name))];
        }
        this._logTopCandidates("Weak", weakCandidates);
        const weakMetric = weakCandidates[0].metric;

        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== weakMetric.scenario.name);

        const midCandidates = this._getWeightedMidScenarios(metrics, [strongMetric, weakMetric]);
        this._logTopCandidates("Mid", midCandidates);
        const midMetric = midCandidates[0].metric;

        return [strongMetric.scenario.name, weakMetric.scenario.name, midMetric.scenario.name];
    }

    private _logTopCandidates(type: string, candidates: { metric: ScenarioMetric; weight: number }[]): void {
        console.log(`[Ranked] Top 3 ${type} Candidates:`);
        candidates.slice(0, 3).forEach((candidate, index) => {
            const metric = candidate.metric;
            console.log(`  ${index + 1}. ${metric.scenario.name} (Peak: ${metric.peak.toFixed(2)}, Current: ${metric.current.toFixed(2)}, Gap: ${metric.gap.toFixed(2)}, Penalty: ${metric.penalty.toFixed(2)}) -> Weight: ${candidate.weight.toFixed(2)}`);
        });
    }

    private _getFallbackBatch(pool: BenchmarkScenario[]): string[] {
        return pool
            .sort((scenarioA: BenchmarkScenario, scenarioB: BenchmarkScenario) =>
                scenarioA.name.localeCompare(scenarioB.name)
            )
            .slice(0, 3)
            .map((scenario: BenchmarkScenario) => scenario.name);
    }

    private _calculateScenarioMetrics(pool: BenchmarkScenario[], maxRank: number): ScenarioMetric[] {
        return pool.map((scenario: BenchmarkScenario) => {
            const estimate = this._rankEstimator.getScenarioEstimate(scenario.name);
            const rawCurrent: number = estimate.continuousValue === -1 ? 0 : estimate.continuousValue;
            const rawPeak: number = estimate.highestAchieved === -1 ? 0 : estimate.highestAchieved;
            const penalty: number = estimate.penalty || 0;

            const current = Math.min(rawCurrent, maxRank);
            const peak = Math.min(rawPeak, maxRank);

            const gap = peak - current;

            return {
                scenario,
                current,
                peak,
                gap,
                penalty
            };
        });
    }

    private _getWeightedStrongScenarios(metrics: ScenarioMetric[]): { metric: ScenarioMetric; weight: number }[] {
        return metrics
            .filter(metric => metric.current <= metric.peak)
            .map(metric => ({ metric, weight: metric.peak + (metric.peak - metric.current) - metric.penalty }))
            // Sort by weight descending. Stable sort preserves original pool order for ties.
            .sort((a, b) => b.weight - a.weight);
    }

    private _getWeightedWeakScenarios(metrics: ScenarioMetric[]): { metric: ScenarioMetric; weight: number }[] {
        return metrics
            .map(metric => ({ metric, weight: Math.max(metric.current - (metric.peak - metric.current), 0) + metric.penalty }))
            // Sort by weight ascending. Original code used localeCompare for ties.
            .sort((a, b) => a.weight - b.weight || a.metric.scenario.name.localeCompare(b.metric.scenario.name));
    }

    private _getWeightedMidScenarios(metrics: ScenarioMetric[], chosen: ScenarioMetric[]): { metric: ScenarioMetric; weight: number }[] {
        return metrics.map(metric => {
            let diversityPenalty = 0;
            for (const other of chosen) {
                if (other.scenario.subcategory === metric.scenario.subcategory) diversityPenalty += 0.5;
                else if (other.scenario.category === metric.scenario.category) diversityPenalty += 0.25;
            }

            const weight = (metric.peak - metric.current) - diversityPenalty - metric.penalty;

            return { metric, weight };
        })
            // Sort by weight descending. Stable sort preserves original pool order for ties.
            .sort((a, b) => b.weight - a.weight);
    }


    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((updatedScenarioNames?: string[]): void => {
            if (updatedScenarioNames && updatedScenarioNames.length > 0) {
                this._resetTimerOnScore();

                if (this._status === "ACTIVE") {
                    this._rankEstimator.applyPenaltyLift();

                    updatedScenarioNames.forEach(name => {
                        const isInSequence = this._sequence.includes(name);

                        if (isInSequence) {
                            this._playedScenarios.add(name);
                            this._rankEstimator.recordPlay(name);
                        }
                    });
                }
            }

            this._notifyListeners();
        });
    }

    private _evolveRanksForPlayedScenarios(): void {
        const difficulty = this._difficulty;
        if (!difficulty) return;

        const allRuns = this._sessionService.getAllRankedSessionRuns();
        const scenarios = this._benchmarkService.getScenarios(difficulty);

        this._playedScenarios.forEach(scenarioName => {
            const scenario = scenarios.find((ref) => ref.name === scenarioName);
            if (!scenario) return;

            const runs = allRuns
                .filter((run) => run.scenarioName === scenarioName)
                .map((run) => run.score);

            if (runs.length === 0) return;

            const sorted = runs.sort((a, b) => b - a);
            const effectiveScore = sorted.length >= 3 ? sorted[2] : 0;

            const sessionValue = this._rankEstimator.getScenarioContinuousValue(effectiveScore, scenario);
            const initialValue = this._initialEstimates[scenarioName];
            this._lastSessionAchievements[scenarioName] = sessionValue;

            this._rankEstimator.evolveScenarioEstimate(scenarioName, sessionValue, initialValue);
        });
    }

    private _resetTimerOnScore(): void {
        if (this._status !== "ACTIVE" && this._status !== "COMPLETED") {
            return;
        }

        const allRuns = this._sessionService.getAllRankedSessionRuns();
        if (allRuns.length === 0) return;

        // Extract the latest timestamp, treating missing timestamps as 0
        const latestTimestamp = Math.max(...allRuns.map(run => run.timestamp || 0));
        if (latestTimestamp === 0) return;

        const latestTime = new Date(latestTimestamp).toISOString();

        if (!this._startTime || latestTime > this._startTime) {
            this._startTime = latestTime;
            this._saveToLocalStorage();
        }
    }

    private _saveToLocalStorage(): void {
        this._snapshotCurrentDifficultyState();

        const state: PersistentRankedState = {
            status: this._status,
            difficulty: this._difficulty,
            startTime: this._startTime,
            rankedSessionId: this._rankedSessionId,
            scenarioStartTime: this._scenarioStartTime,
            difficultyStates: this._difficultyStates,
        };

        localStorage.setItem(this._getStorageKey(), JSON.stringify(state));
    }

    private _loadFromLocalStorage(): void {
        const key = this._getStorageKey();
        const raw: string | null = localStorage.getItem(key);
        if (!raw) {
            this._resetToIdle();

            return;
        }

        try {
            const state = JSON.parse(raw) as PersistentRankedState;
            this._applyPersistentState(state);
        } catch {
            this._resetToIdle();
        }
    }

    private _resetToIdle(): void {
        this._status = "IDLE";
        this._difficulty = null;
        this._startTime = null;
        this._rankedSessionId = null;
        this._scenarioStartTime = null;
        this._sequence = [];
        this._currentIndex = 0;
        this._initialGauntletComplete = false;
        this._playedScenarios = new Set();
        this._initialEstimates = {};
        this._previousSessionRanks = {};
        this._lastSessionAchievements = {};
        this._accumulatedScenarioSeconds = new Map();
        this._difficultyStates = {};
    }

    private _applyPersistentState(state: PersistentRankedState): void {
        this._status = state.status;
        this._difficulty = state.difficulty;
        this._startTime = state.startTime;
        this._rankedSessionId = state.rankedSessionId;
        this._scenarioStartTime = state.scenarioStartTime;
        this._difficultyStates = state.difficultyStates || {};

        if (this._difficulty && this._difficultyStates[this._difficulty]) {
            this._applyDifficultyStateSnapshot(this._difficultyStates[this._difficulty]);
        } else {
            this._sequence = [];
            this._currentIndex = 0;
            this._initialGauntletComplete = false;
            this._playedScenarios = new Set();
            this._initialEstimates = {};
            this._previousSessionRanks = {};
            this._lastSessionAchievements = {};
            this._accumulatedScenarioSeconds = new Map();
        }
    }

    private _recordInitialEstimates(scenarioNames: string[]): void {
        for (const name of scenarioNames) {
            if (!(name in this._initialEstimates)) {
                this._initialEstimates[name] = this._rankEstimator.getScenarioEstimate(name).continuousValue;
            }
        }
    }

    private _notifyListeners(): void {
        this._onStateChanged.forEach((callback: () => void): void => callback());
    }

    private _snapshotScenarioTime(): void {
        const current = this.currentScenarioName;
        if (!current || !this._scenarioStartTime) return;

        const start: number = new Date(this._scenarioStartTime).getTime();
        const now: number = Date.now();
        const elapsed = Math.floor((now - start) / 1000);

        const existing = this._accumulatedScenarioSeconds.get(current) || 0;
        this._accumulatedScenarioSeconds.set(current, existing + elapsed);
        this._scenarioStartTime = null;
    }
}
