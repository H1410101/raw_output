import { BenchmarkService } from "./BenchmarkService";
import { SessionService, SessionRankRecord } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";
import { RankEstimator } from "./RankEstimator";
import { SessionSettingsService } from "./SessionSettingsService";

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
    readonly rankedSessionId: string | null;
}

interface ScenarioMetric {
    scenario: BenchmarkScenario;
    current: number;
    peak: number;
    // peak - current
    gap: number;
}

/**
 * Service managing deterministic "Ranked Runs" with guided progression.
 */
export class RankedSessionService {
    private readonly _benchmarkService: BenchmarkService;
    private readonly _sessionService: SessionService;
    private readonly _rankEstimator: RankEstimator;
    private readonly _sessionSettings: SessionSettingsService;
    private readonly _storageKey: string = "ranked_session_state_v2";

    private _status: RankedSessionStatus = "IDLE";
    private _sequence: string[] = [];
    private _currentIndex: number = 0;
    private _difficulty: string | null = null;
    private _startTime: string | null = null;
    private _rankedSessionId: string | null = null;
    private _initialGauntletComplete: boolean = false;
    private _timerInterval: number | null = null;

    private readonly _onStateChanged: (() => void)[] = [];

    /**
     * Initializes the service.
     *
     * @param benchmarkService - Service for accessing benchmark data.
     * @param sessionService - Service for session lifecycle.
     * @param rankEstimator - Service for rank identity and selection metrics.
     * @param sessionSettings - Service for accessing session configuration.
     */
    public constructor(
        benchmarkService: BenchmarkService,
        sessionService: SessionService,
        rankEstimator: RankEstimator,
        sessionSettings: SessionSettingsService,
    ) {
        this._benchmarkService = benchmarkService;
        this._sessionService = sessionService;
        this._rankEstimator = rankEstimator;
        this._sessionSettings = sessionSettings;

        this._loadFromLocalStorage();
        this._subscribeToSessionEvents();
        this._initTimer();
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
        };
    }

    /**
     * Returns the unique ID for the current ranked session.
     *
     * @returns The session ID or null if inactive.
     */
    public get sessionId(): string | null {
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
     * Starts a new ranked session for the given difficulty.
     *
     * @param difficulty - The difficulty tier to play.
     */
    public startSession(difficulty: string): void {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        if (scenarios.length === 0) {
            return;
        }

        this._difficulty = difficulty;
        this._startTime = new Date().toISOString();
        this._rankedSessionId = `ranked-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this._status = "ACTIVE";
        this._currentIndex = 0;
        this._sequence = [];
        this._initialGauntletComplete = false;

        // Generate Initial Batch (Strong-Weak-Mid)
        const batch = this._generateNextBatch(difficulty, []);
        this._sequence.push(...batch);

        this._sessionService.setIsRanked(true);
        this._startTimer();
        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Manually retreats the sequence to the previous scenario.
     */
    public retreat(): void {
        if (this._status === "IDLE" || this._currentIndex <= 0) {
            return;
        }

        this._currentIndex--;
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

        this._currentIndex++;

        // Gauntlet Logic:
        // 1. If we reach the end of the initial 3, set status to COMPLETED (Show summary).
        // 2. If the gate has been passed already, automatically extend for uninterrupted play.
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

        // Passing this point mark the gate as open
        this._initialGauntletComplete = true;

        // Generate Next Batch, excluding recently played scenarios to avoid repetition
        // We exclude the last 3 scenarios from the candidate pool efficiently
        const excludeList = this._sequence.slice(-3);
        const batch = this._generateNextBatch(this._difficulty, excludeList);

        this._sequence.push(...batch);
        this._status = "ACTIVE";

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

        this._status = "SUMMARY";

        if (this._timerInterval !== null) {
            window.clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        this._saveToLocalStorage();
        this._notifyListeners();
    }

    /**
     * Resets the ranked session state to idle.
     */
    public reset(): void {
        this._status = "IDLE";
        this._sequence = [];
        this._currentIndex = 0;
        this._difficulty = null;
        this._startTime = null;
        this._rankedSessionId = null;
        this._initialGauntletComplete = false;

        if (this._timerInterval !== null) {
            window.clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        localStorage.removeItem(this._storageKey);
        this._notifyListeners();
    }

    private _initTimer(): void {
        if (this._status === "ACTIVE" || this._status === "COMPLETED") {
            this._startTimer();
        }
    }

    private _startTimer(): void {
        if (this._timerInterval !== null) {
            return;
        }

        this._timerInterval = window.setInterval((): void => {
            this._checkTimerExpiry();
        }, 1000);
    }

    private _checkTimerExpiry(): void {
        if (this._status !== "ACTIVE" && this._status !== "COMPLETED") {
            return;
        }

        if (this.remainingSeconds <= 0) {
            this._status = "SUMMARY";

            if (this._timerInterval !== null) {
                window.clearInterval(this._timerInterval);
                this._timerInterval = null;
            }

            this._saveToLocalStorage();
            this._notifyListeners();
        }
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

        const bests: SessionRankRecord[] = this._sessionService.getAllScenarioSessionBests();

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
        const pool: BenchmarkScenario[] = scenarios.filter((scenario: BenchmarkScenario) => !excludeScenarios.includes(scenario.name));

        if (pool.length < 3) {
            return this._getFallbackBatch(pool);
        }

        let metrics: ScenarioMetric[] = this._calculateScenarioMetrics(pool);

        // 1. Select Strong Scenario
        const strongMetric: ScenarioMetric | null = this._selectStrongScenario(metrics);
        if (!strongMetric) {
            return this._getFallbackBatch(pool);
        }
        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== strongMetric.scenario.name);

        // 2. Select Weak Scenario
        const weakMetric: ScenarioMetric | null = this._selectWeakScenario(metrics);
        if (!weakMetric) {
            // Should happen rarely given pool size, but fallback
            return [strongMetric.scenario.name, ...this._getFallbackBatch(pool.filter((scenario: BenchmarkScenario) => scenario.name !== strongMetric.scenario.name))];
        }
        metrics = metrics.filter((metric: ScenarioMetric) => metric.scenario.name !== weakMetric.scenario.name);

        // 3. Select Mid Scenario
        // Mid selection depends on the other two for diversity penalty
        const midMetric: ScenarioMetric = this._selectMidScenario(metrics, [strongMetric, weakMetric]);

        return [strongMetric.scenario.name, weakMetric.scenario.name, midMetric.scenario.name];
    }

    private _getFallbackBatch(pool: BenchmarkScenario[]): string[] {
        // Simple alpha sort fallback if logic fails or pool is too small
        return pool
            .sort((scenarioA: BenchmarkScenario, scenarioB: BenchmarkScenario) =>
                scenarioA.name.localeCompare(scenarioB.name)
            )
            .slice(0, 3)
            .map((scenario: BenchmarkScenario) => scenario.name);
    }

    private _calculateScenarioMetrics(pool: BenchmarkScenario[]): ScenarioMetric[] {
        return pool.map((scenario: BenchmarkScenario) => {
            const estimate = this._rankEstimator.getScenarioEstimate(scenario.name);
            const current: number = estimate.continuousValue === -1 ? 0 : estimate.continuousValue;
            const peak: number = estimate.highestAchieved === -1 ? 0 : estimate.highestAchieved;

            // "distance_from_peak" is naturally peak - current
            const gap = peak - current;

            return {
                scenario,
                current,
                peak,
                gap
            };
        });
    }

    private _selectStrongScenario(metrics: ScenarioMetric[]): ScenarioMetric | null {
        // Logic: Highest score for min(current_rank + distance_from_peak, top_rank) + distance_from_peak
        // Disqualify if current_rank > peak (beyond rank)

        let bestMetric: ScenarioMetric | null = null;
        let maxScore = -Infinity;

        for (const metric of metrics) {
            // "except if current_rank is a beyond rank (above peak), it is disqualified entirely"
            if (metric.current > metric.peak) {
                continue;
            }

            // same as metric.gap
            const dist = metric.peak - metric.current;

            // min(current + dist, peak) + dist
            // since current + dist = peak, min(peak, peak) = peak.
            // so score = peak + dist = peak + (peak - current) = 2*peak - current
            const score = metric.peak + dist;

            if (score > maxScore) {
                maxScore = score;
                bestMetric = metric;
            }
        }

        return bestMetric;
    }

    private _selectWeakScenario(metrics: ScenarioMetric[]): ScenarioMetric | null {
        // Logic: Lowest score for max(current_rank - distance_from_peak, 0)

        let bestMetric: ScenarioMetric | null = null;
        let minScore = Infinity;

        for (const metric of metrics) {
            const dist = metric.peak - metric.current;

            // max(current - dist, 0)
            const score = Math.max(metric.current - dist, 0);

            if (score < minScore) {
                minScore = score;
                bestMetric = metric;
            } else if (score === minScore) {
                // Tie-breaker: use larger gap (we want weak scenarios, often meaning high potential)
                // or just alphabetical for determinism
                if (bestMetric && metric.scenario.name.localeCompare(bestMetric.scenario.name) < 0) {
                    bestMetric = metric;
                }
            }
        }

        return bestMetric;
    }

    private _selectMidScenario(metrics: ScenarioMetric[], chosen: ScenarioMetric[]): ScenarioMetric {
        // Logic: Highest score for max(current_rank + distance_from_peak, top_rank) - current_rank - closeness_penalty

        let bestMetric: ScenarioMetric | null = null;
        let maxScore = -Infinity;

        for (const metric of metrics) {
            // max(current + dist, peak) = max(peak, peak) = peak

            // score = peak - current - penalty
            // penalty: same category 0.25, same subcategory 0.5 (cumulative per chosen scenario)

            let penalty = 0;
            for (const other of chosen) {
                if (other.scenario.subcategory === metric.scenario.subcategory) {
                    penalty += 0.5;
                }
                // Assuming "Same Category" is an *additional* or *alternative* check?
                // Usually subcategory implies category. Only adding if strictly same category?
                // User said: "same category is 0.25, and the same subcategory is 0.5"
                // I'll assume if subcategory matches, it's 0.5. If only category matches, 0.25.
                else if (other.scenario.category === metric.scenario.category) {
                    penalty += 0.25;
                }
            }

            // Score = peak - current - penalty = gap - penalty
            const score = (metric.peak - metric.current) - penalty;

            if (score > maxScore) {
                maxScore = score;
                bestMetric = metric;
            }
        }

        return bestMetric || metrics[0];
    }


    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((updatedScenarioNames?: string[]): void => {
            if (updatedScenarioNames && updatedScenarioNames.length > 0) {
                this._resetTimerOnScore();
            }

            this._notifyListeners();
        });
    }

    private _resetTimerOnScore(): void {
        if (this._status !== "ACTIVE" && this._status !== "COMPLETED") {
            return;
        }

        this._startTime = new Date().toISOString();
        this._saveToLocalStorage();
    }

    private _saveToLocalStorage(): void {
        const state: RankedSessionState = {
            status: this._status,
            sequence: this._sequence,
            currentIndex: this._currentIndex,
            difficulty: this._difficulty,
            startTime: this._startTime,
            initialGauntletComplete: this._initialGauntletComplete,
            rankedSessionId: this._rankedSessionId,
        };

        localStorage.setItem(this._storageKey, JSON.stringify(state));
    }

    private _loadFromLocalStorage(): void {
        const raw: string | null = localStorage.getItem(this._storageKey);
        if (!raw) {
            return;
        }

        try {
            const state = JSON.parse(raw) as RankedSessionState;
            this._status = state.status;
            this._sequence = state.sequence;
            this._currentIndex = state.currentIndex;
            this._difficulty = state.difficulty;
            this._startTime = state.startTime;
            this._initialGauntletComplete = state.initialGauntletComplete || false;
            this._rankedSessionId = state.rankedSessionId || null;
        } catch {
            localStorage.removeItem(this._storageKey);
        }
    }

    private _notifyListeners(): void {
        this._onStateChanged.forEach((callback: () => void): void => callback());
    }
}
