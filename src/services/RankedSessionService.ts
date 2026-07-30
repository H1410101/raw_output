import { BenchmarkService } from "./BenchmarkService";
import { SessionService, SessionRankRecord } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";
import { RankEstimateMap, RankEstimator, ScenarioEstimateEvolution } from "./RankEstimator";
import { SessionSettingsService } from "./SessionSettingsService";
import { IdentityService } from "./IdentityService";

export type RankedSessionStatus = "IDLE" | "ACTIVE" | "COMPLETED" | "SUMMARY";

/**
 * Encapsulates the state of a ranked session.
 */
export interface RankedSessionState {
    readonly status: RankedSessionStatus;
    readonly isPaused: boolean;
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
    scaledGap: number;
    penalty: number;
}

interface ScenarioMetricContext {
    readonly maxRank: number;
    readonly overallRank: number;
    readonly estimateMap: RankEstimateMap;
}

interface GeneratedScenarioBatch {
    readonly names: string[];
    readonly estimateMap: RankEstimateMap;
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
    isPaused?: boolean;
    difficulty: string | null;
    startTime: string | null;
    lastActivityTime?: string | null;
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
    private _isPaused: boolean = false;
    private _difficulty: string | null = null;
    private _startTime: string | null = null;
    private _lastActivityTime: string | null = null;
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
            isPaused: this._isPaused,
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
        if (this._status !== "ACTIVE" || this._isPaused || this._currentIndex >= this._sequence.length) {
            return null;
        }

        return this._sequence[this._currentIndex];
    }

    /**
     * Returns active elapsed time across the current ranked session.
     *
     * @returns Seconds elapsed, or 0 if inactive.
     */
    public get activeElapsedSeconds(): number {
        let elapsed: number = Array.from(this._accumulatedScenarioSeconds.values())
            .reduce((total: number, seconds: number): number => total + seconds, 0);
        if (this._status === "ACTIVE" && !this._isPaused && this._scenarioStartTime) {
            elapsed += Math.max(0, Math.floor((Date.now() - new Date(this._scenarioStartTime).getTime()) / 1000));
        }

        return elapsed;
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

        const currentScenario = this._status === "ACTIVE" && this._currentIndex < this._sequence.length
            ? this._sequence[this._currentIndex]
            : null;
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
     * Pauses an active ranked session and stops ranked ingestion.
     */
    public pause(): void {
        if (this._isPaused || (this._status !== "ACTIVE" && this._status !== "COMPLETED")) return;

        this._snapshotScenarioTime();
        this._scenarioStartTime = null;
        this._isPaused = true;
        this._sessionService.stopRankedSession();
        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /** Resumes a paused ranked session. */
    public resume(): void {
        if (!this._isPaused || (this._status !== "ACTIVE" && this._status !== "COMPLETED")) return;

        this._isPaused = false;
        this._markActivity();
        if (this._status === "ACTIVE") this._scenarioStartTime = new Date().toISOString();
        this._sessionService.resumeRankedSession(Date.now());
        this._sessionService.setRankedPlaylist(this._sequence);
        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /** Records meaningful interaction for inactivity timeout purposes. */
    public recordActivity(): void {
        if (this._isPaused || (this._status !== "ACTIVE" && this._status !== "COMPLETED")) return;

        this._markActivity();
        this._saveToLocalStorage();
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
            this._resumeExistingSession();

            return;
        }

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
        this._isPaused = false;
        this._startTime = new Date().toISOString();
        this._lastActivityTime = this._startTime;
        this._currentIndex = 0;
        this._sequence = [];
        this._initialGauntletComplete = false;
        this._playedScenarios.clear();
        this._initialEstimates = {};
        this._previousSessionRanks = {};
        this._lastSessionAchievements = {};
        this._accumulatedScenarioSeconds.clear();

        const batch = this._generateNextBatch(difficulty, []);
        this._sequence.push(...batch.names);

        this._sessionService.startRankedSession(Date.now());
        this._sessionService.setRankedPlaylist(this._sequence);
        this._recordInitialEstimates(batch.names, batch.estimateMap);
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
        this._isPaused = false;
        this._startTime = new Date().toISOString();
        this._lastActivityTime = this._startTime;

        const extended = this._jumpToNextUnplayedScenario();
        if (!extended) {
            this._rankEstimator.initializePeakRanks();
        }
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

    private _jumpToNextUnplayedScenario(): boolean {
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

                return true;
            } else {
                this._status = "COMPLETED";
            }
        }

        return false;
    }

    /**
     * Manually retreats the sequence to the previous scenario.
     */
    public retreat(): void {
        if (this._status === "IDLE" || this._isPaused || this._currentIndex <= 0) {
            return;
        }

        this._snapshotScenarioTime();
        this._currentIndex--;
        this._scenarioStartTime = new Date().toISOString();
        this._markActivity();
        // If we were in COMPLETED, going back makes us ACTIVE
        this._status = "ACTIVE";

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Manually advances the sequence to the next scenario.
     */
    public advance(): void {
        if (this._status !== "ACTIVE" || this._isPaused || this._currentIndex >= this._sequence.length) {
            return;
        }

        this._snapshotScenarioTime();
        this._currentIndex++;
        this._scenarioStartTime = new Date().toISOString();
        this._markActivity();

        if (this._currentIndex >= this._sequence.length) {
            if (this._initialGauntletComplete) {
                const canExtend = this._difficulty !== null && this._startTime !== null;
                this.extendSession();

                if (canExtend) {
                    return;
                }
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
        if (!this._difficulty || !this._startTime || this._isPaused) {
            return;
        }

        this._initialGauntletComplete = true;

        const excludeList = this._sequence.slice(-3);
        const batch = this._generateNextBatch(this._difficulty, excludeList);

        this._sequence.push(...batch.names);
        this._status = "ACTIVE";
        this._markActivity();

        this._sessionService.setRankedPlaylist(this._sequence);
        this._recordInitialEstimates(batch.names, batch.estimateMap);
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
        this._isPaused = false;
        this._status = "SUMMARY";

        this._evolveRanksForPlayedScenarios();

        this._sessionService.stopRankedSession();

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Checks for ranked inactivity and pauses instead of ending the session.
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

        if (this._isPaused || (this._status !== "ACTIVE" && this._status !== "COMPLETED")) {
            return;
        }

        const timeoutMilliseconds: number =
            this._sessionSettings.getSettings().rankedIntervalMinutes * 60 * 1000;
        const lastActivity: number = this._lastActivityTime
            ? new Date(this._lastActivityTime).getTime()
            : Date.now();
        if (Date.now() - lastActivity >= timeoutMilliseconds) {
            this._pauseAtInactivityDeadline();
            this._notifyListeners();
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
        this._isPaused = false;
        this._difficulty = null;
        this._lastActivityTime = null;

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
     * Generates a deterministic batch in primary-secondary-coverage order.
     *
     * @param difficulty - The difficulty tier to pull scenarios from.
     * @param excludeScenarios - List of scenario names to exclude from the batch.
     * @returns The selected names and the estimate snapshot used to select them.
     */
    private _generateNextBatch(difficulty: string, excludeScenarios: string[]): GeneratedScenarioBatch {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        const rankNames: string[] = this._benchmarkService.getRankNames(difficulty);
        const estimateMap: RankEstimateMap = this._rankEstimator.getRankEstimateMap();

        const pool: BenchmarkScenario[] = scenarios.filter((scenario: BenchmarkScenario) => !excludeScenarios.includes(scenario.name));
        if (pool.length < 3) {
            this._rankEstimator.initializePeakRanks(estimateMap);

            return { names: this._getFallbackBatch(pool), estimateMap };
        }

        const overallRank = this._rankEstimator.calculateHolisticEstimateRank(difficulty, estimateMap).continuousValue;
        const context: ScenarioMetricContext = { maxRank: rankNames.length, overallRank, estimateMap };

        return { names: this._selectWeightedBatch(scenarios, pool, context), estimateMap };
    }

    private _selectWeightedBatch(
        scenarios: BenchmarkScenario[],
        pool: BenchmarkScenario[],
        context: ScenarioMetricContext
    ): string[] {
        let metrics: ScenarioMetric[] = this._calculateScenarioMetrics(pool, context);
        const previouslySelected = this._getPreviouslySelectedMetrics(scenarios, this._sequence, context);
        const primaryCandidates = this._getPrimaryCandidates(metrics);
        if (primaryCandidates.length === 0) {
            return this._getFallbackBatch(pool);
        }
        const primaryMetric = primaryCandidates[0].metric;

        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== primaryMetric.scenario.name);
        const secondaryCandidates = this._getSecondaryCandidates(metrics, [...previouslySelected, primaryMetric]);
        if (secondaryCandidates.length === 0) {
            const fallback = this._getFallbackBatch(pool.filter((scenario: BenchmarkScenario) => scenario.name !== primaryMetric.scenario.name));

            return [primaryMetric.scenario.name, ...fallback];
        }
        const secondaryMetric = secondaryCandidates[0].metric;

        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== secondaryMetric.scenario.name);
        const coverageCandidates = this._getCoverageCandidates(
            metrics,
            [...previouslySelected, primaryMetric, secondaryMetric],
        );
        const coverageMetric = coverageCandidates[0].metric;

        return [primaryMetric.scenario.name, secondaryMetric.scenario.name, coverageMetric.scenario.name];
    }

    private _getFallbackBatch(pool: BenchmarkScenario[]): string[] {
        return pool
            .sort((scenarioA: BenchmarkScenario, scenarioB: BenchmarkScenario) =>
                scenarioA.name.localeCompare(scenarioB.name)
            )
            .slice(0, 3)
            .map((scenario: BenchmarkScenario) => scenario.name);
    }

    private _calculateScenarioMetrics(pool: BenchmarkScenario[], context: ScenarioMetricContext): ScenarioMetric[] {
        return pool.map((scenario: BenchmarkScenario) => {
            const estimate = this._rankEstimator.getScenarioEstimate(scenario.name, context.estimateMap);
            const rawCurrent: number = estimate.continuousValue === -1 ? 0 : estimate.continuousValue;
            const rawPeak: number = estimate.highestAchieved === -1 ? 0 : estimate.highestAchieved;
            const penalty: number = estimate.penalty || 0;

            const current = rawCurrent;
            const peak = rawPeak;
            const visibleGap = Math.max(0, Math.min(peak, context.maxRank) - current);
            const overrankGap = Math.max(0, peak - context.maxRank);
            const scenarioGap = visibleGap + 0.5 * overrankGap;
            const fallbackTarget = peak > 0
                ? Math.max(peak - 2, 0, context.overallRank)
                : Math.max(context.overallRank, 0);
            const fallbackGap = Math.max(0, fallbackTarget - current);
            const scaledGap = Math.max(scenarioGap, fallbackGap);

            return {
                scenario,
                current,
                peak,
                scaledGap,
                penalty
            };
        });
    }

    private _getPreviouslySelectedMetrics(
        scenarios: BenchmarkScenario[],
        selectedScenarioNames: string[],
        context: ScenarioMetricContext
    ): ScenarioMetric[] {
        const scenarioLookup = new Map(scenarios.map((scenario: BenchmarkScenario) => [scenario.name, scenario]));

        return selectedScenarioNames
            .map((name: string) => scenarioLookup.get(name))
            .filter((scenario): scenario is BenchmarkScenario => scenario !== undefined)
            .map((scenario: BenchmarkScenario) => this._calculateScenarioMetrics([scenario], context)[0]);
    }

    private _getSecondaryCandidates(
        metrics: ScenarioMetric[],
        selectedMetrics: ScenarioMetric[]
    ): { metric: ScenarioMetric; weight: number }[] {
        return metrics
            .map(metric => ({
                metric,
                weight: metric.scaledGap - metric.penalty - this._calculateAccumulatedDiversity(metric, selectedMetrics)
            }))
            // Sort by weight descending. Stable sort preserves original pool order for ties.
            .sort((a, b) => b.weight - a.weight || a.metric.scenario.name.localeCompare(b.metric.scenario.name));
    }

    private _getPrimaryCandidates(metrics: ScenarioMetric[]): { metric: ScenarioMetric; weight: number }[] {
        return metrics
            .map(metric => ({ metric, weight: metric.scaledGap - metric.current - metric.penalty }))
            .sort((a, b) => b.weight - a.weight || a.metric.scenario.name.localeCompare(b.metric.scenario.name));
    }

    private _getCoverageCandidates(metrics: ScenarioMetric[], selectedMetrics: ScenarioMetric[]): { metric: ScenarioMetric; diversity: number; weight: number }[] {
        return metrics.map(metric => {
            const diversity = this._calculateAccumulatedDiversity(metric, selectedMetrics);
            const weight = metric.scaledGap - metric.penalty;

            return { metric, diversity, weight };
        })
            .sort((a, b) => a.diversity - b.diversity || b.weight - a.weight || a.metric.scenario.name.localeCompare(b.metric.scenario.name));
    }

    private _calculateAccumulatedDiversity(metric: ScenarioMetric, selectedMetrics: ScenarioMetric[]): number {
        return selectedMetrics.reduce((total: number, other: ScenarioMetric) => {
            return total + this._getDiversityPoints(metric.scenario, other.scenario);
        }, 0);
    }

    private _getDiversityPoints(candidate: BenchmarkScenario, selected: BenchmarkScenario): number {
        if (candidate.name === selected.name) {
            return 2.5;
        }

        if (candidate.subcategory === selected.subcategory) {
            return 1;
        }

        if (candidate.category === selected.category) {
            return 0.5;
        }

        return 0;
    }


    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((updatedScenarioNames?: string[]): void => {
            if (updatedScenarioNames && updatedScenarioNames.length > 0) {
                this._recordScoreActivity();

                if (this._status === "ACTIVE" && !this._isPaused) {
                    this._rankEstimator.applyPenaltyLift();

                    updatedScenarioNames.forEach(name => {
                        const isInSequence = this._sequence.includes(name);

                        if (isInSequence) {
                            this._playedScenarios.add(name);
                            this._rankEstimator.recordPlay(name);
                        }
                    });
                }

                this._notifyListeners();
            }
        });
    }

    private _evolveRanksForPlayedScenarios(): void {
        const difficulty = this._difficulty;
        if (!difficulty) return;

        const allRuns = this._sessionService.getAllRankedSessionRuns();
        const scenarios = this._benchmarkService.getScenarios(difficulty);
        const scenarioLookup = this._indexScenariosByName(scenarios);
        const scoresByScenario = this._groupScoresByScenario(allRuns);
        const evolutions: ScenarioEstimateEvolution[] = [];

        for (const scenarioName of this._playedScenarios) {
            const scenario = scenarioLookup.get(scenarioName);
            if (!scenario) continue;

            const scores = scoresByScenario.get(scenarioName);
            if (!scores || scores.length === 0) continue;

            const sorted = scores.sort((scoreA, scoreB) => scoreB - scoreA);
            const effectiveScore = sorted.length >= 3 ? sorted[2] : 0;

            const sessionValue = this._rankEstimator.getScenarioContinuousValue(effectiveScore, scenario);
            const initialValue = this._initialEstimates[scenarioName];
            this._lastSessionAchievements[scenarioName] = sessionValue;
            evolutions.push({ scenarioName, sessionRank: sessionValue, initialValue });
        }

        this._rankEstimator.evolveScenarioEstimates(evolutions);
    }

    private _indexScenariosByName(scenarios: BenchmarkScenario[]): Map<string, BenchmarkScenario> {
        const scenarioLookup = new Map<string, BenchmarkScenario>();
        for (const scenario of scenarios) {
            if (!scenarioLookup.has(scenario.name)) {
                scenarioLookup.set(scenario.name, scenario);
            }
        }

        return scenarioLookup;
    }

    private _groupScoresByScenario(
        runs: readonly { readonly scenarioName: string; readonly score: number }[]
    ): Map<string, number[]> {
        const scoresByScenario = new Map<string, number[]>();

        for (const run of runs) {
            const scores = scoresByScenario.get(run.scenarioName);
            if (scores) {
                scores.push(run.score);
            } else {
                scoresByScenario.set(run.scenarioName, [run.score]);
            }
        }

        return scoresByScenario;
    }

    private _recordScoreActivity(): void {
        if (this._isPaused || (this._status !== "ACTIVE" && this._status !== "COMPLETED")) {
            return;
        }

        const allRuns = this._sessionService.getAllRankedSessionRuns();
        if (allRuns.length === 0) return;

        // Extract the latest timestamp, treating missing timestamps as 0
        const latestTimestamp = Math.max(...allRuns.map(run => run.timestamp || 0));
        if (latestTimestamp === 0) return;

        const latestTime = new Date(latestTimestamp).toISOString();

        if (!this._lastActivityTime || latestTime > this._lastActivityTime) {
            this._lastActivityTime = latestTime;
            this._saveToLocalStorage();
        }
    }

    private _markActivity(): void {
        this._lastActivityTime = new Date().toISOString();
    }

    private _saveToLocalStorage(): void {
        this._snapshotCurrentDifficultyState();

        const state: PersistentRankedState = {
            status: this._status,
            isPaused: this._isPaused,
            difficulty: this._difficulty,
            startTime: this._startTime,
            lastActivityTime: this._lastActivityTime,
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
        this._isPaused = false;
        this._difficulty = null;
        this._startTime = null;
        this._lastActivityTime = null;
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
        this._isPaused = state.isPaused === true;
        this._difficulty = state.difficulty;
        this._startTime = state.startTime;
        this._lastActivityTime = state.lastActivityTime ?? state.startTime;
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

        if (this._isPaused) {
            this._scenarioStartTime = null;
            this._sessionService.stopRankedSession();
        } else if (this._hasInactivityExpired()) {
            this._pauseAtInactivityDeadline();
        }
    }

    private _hasInactivityExpired(): boolean {
        if ((this._status !== "ACTIVE" && this._status !== "COMPLETED") || !this._lastActivityTime) {
            return false;
        }

        const timeoutMilliseconds: number =
            this._sessionSettings.getSettings().rankedIntervalMinutes * 60 * 1000;

        return Date.now() - new Date(this._lastActivityTime).getTime() >= timeoutMilliseconds;
    }

    private _pauseAtInactivityDeadline(): void {
        const timeoutMilliseconds: number =
            this._sessionSettings.getSettings().rankedIntervalMinutes * 60 * 1000;
        const lastActivity: number = new Date(this._lastActivityTime!).getTime();
        this._snapshotScenarioTime(lastActivity + timeoutMilliseconds);
        this._isPaused = true;
        this._scenarioStartTime = null;
        this._sessionService.stopRankedSession();
        this._saveToLocalStorage();
    }

    private _recordInitialEstimates(scenarioNames: string[], estimateMap: RankEstimateMap): void {
        for (const name of scenarioNames) {
            if (!(name in this._initialEstimates)) {
                this._initialEstimates[name] = this._rankEstimator.getScenarioEstimate(name, estimateMap).continuousValue;
            }
        }
    }

    private _notifyListeners(): void {
        this._onStateChanged.forEach((callback: () => void): void => callback());
    }

    private _snapshotScenarioTime(endTime: number = Date.now()): void {
        const current = this.currentScenarioName;
        if (!current || !this._scenarioStartTime) return;

        const start: number = new Date(this._scenarioStartTime).getTime();
        const elapsed = Math.max(0, Math.floor((endTime - start) / 1000));

        const existing = this._accumulatedScenarioSeconds.get(current) || 0;
        this._accumulatedScenarioSeconds.set(current, existing + elapsed);
        this._scenarioStartTime = null;
    }
}
