import { BenchmarkService } from "./BenchmarkService";
import { SessionService, SessionRankRecord } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";

export type RankedSessionStatus = "IDLE" | "ACTIVE" | "COMPLETED";

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

/**
 * Service managing deterministic "Ranked Runs" with guided progression.
 */
export class RankedSessionService {
    private readonly _benchmarkService: BenchmarkService;
    private readonly _sessionService: SessionService;
    private readonly _rankEstimator: RankEstimator;
    private readonly _storageKey: string = "ranked_session_state_v2";

    private _status: RankedSessionStatus = "IDLE";
    private _sequence: string[] = [];
    private _currentIndex: number = 0;
    private _difficulty: string | null = null;
    private _startTime: string | null = null;
    private _rankedSessionId: string | null = null;
    private _initialGauntletComplete: boolean = false;

    private readonly _onStateChanged: (() => void)[] = [];

    /**
     * Initializes the service.
     *
     * @param benchmarkService - Service for accessing benchmark data.
     * @param sessionService - Service for session lifecycle.
     * @param rankEstimator - Service for rank identity and selection metrics.
     */
    public constructor(
        benchmarkService: BenchmarkService,
        sessionService: SessionService,
        rankEstimator: RankEstimator,
    ) {
        this._benchmarkService = benchmarkService;
        this._sessionService = sessionService;
        this._rankEstimator = rankEstimator;

        this._loadFromLocalStorage();
        this._subscribeToSessionEvents();
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

        // Generate Initial Batch (Strong-Weak-Weak)
        const batch = this._generateNextBatch(difficulty, []);
        this._sequence.push(...batch);

        this._sessionService.setIsRanked(true);
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
        this._status = "ACTIVE"; // If we were in COMPLETED, going back makes us ACTIVE

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
     * Ends the session gracefully without resetting identity progress.
     * Returns the user to the idle state.
     */
    public endSession(): void {
        this.reset();
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

        localStorage.removeItem(this._storageKey);
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
     * Generates a batch of 3 scenarios using Strong-Weak-Weak logic without randomness.
     */
    private _generateNextBatch(difficulty: string, excludeScenarios: string[]): string[] {
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(difficulty);
        // Deterministic Filter
        const pool = scenarios.filter(s => !excludeScenarios.includes(s.name));

        if (pool.length < 3) {
            // Fallback: Deterministic sort by name
            return pool.sort((a, b) => a.name.localeCompare(b.name)).map(s => s.name);
        }

        // 1. Calculate Metrics
        const metrics = pool.map(scenario => {
            const identity = this._rankEstimator.getScenarioIdentity(scenario.name);
            const current = identity.continuousValue === -1 ? 0 : identity.continuousValue;
            const peak = identity.highestAchieved === -1 ? 0 : identity.highestAchieved;

            // Gap: Potential - Current
            const gap = peak - current;

            return {
                scenario,
                current,
                peak,
                gap
            };
        });

        // 2. Select Slot 1: Strong (Max Gap)
        const sortedByGap = [...metrics].sort((a, b) => {
            // Primary: Gap (Descending)
            const gapDiff = b.gap - a.gap;
            if (Math.abs(gapDiff) > 0.0001) return gapDiff;

            // Secondary: Peak High Score (Descending - target big fall-offs)
            const peakDiff = b.peak - a.peak;
            if (Math.abs(peakDiff) > 0.0001) return peakDiff;

            // Tertiary: Alphabetical (Deterministic)
            return a.scenario.name.localeCompare(b.scenario.name);
        });
        const slot1 = sortedByGap[0];

        // 3. Select Slot 2: Weak (Min Strength)
        const remainingAfterSlot1 = metrics.filter(m => m.scenario.name !== slot1.scenario.name);

        const sortedByStrength = [...remainingAfterSlot1].sort((a, b) => {
            // Primary: Current Strength (Ascending - find weakest)
            const strengthDiff = a.current - b.current;
            if (Math.abs(strengthDiff) > 0.0001) return strengthDiff;

            // Secondary: Peak High Score (Ascending - find true inability, not just decay)
            // If currents are equal (e.g. 0.0), the one with the LOWER peak is "weaker".
            const peakDiff = a.peak - b.peak;
            if (Math.abs(peakDiff) > 0.0001) return peakDiff;

            // Tertiary: Alphabetical
            return a.scenario.name.localeCompare(b.scenario.name);
        });

        const slot2 = sortedByStrength[0];

        // 4. Select Slot 3: Weak #2 (Next Min Strength)
        const slot3Candidates = sortedByStrength.filter(m => m.scenario.name !== slot2.scenario.name);
        let slot3 = slot3Candidates[0];

        // 5. Diversity Check (Deterministic)
        // If Slot 2 and Slot 3 share category, try to swap Slot 3 with next worst
        if (slot2.scenario.category === slot3.scenario.category) {
            if (slot3Candidates.length > 1) {
                const altCandidate = slot3Candidates[1];
                // Only swap if skill gap is not significant (> 1.0 rank unit)
                if (Math.abs(altCandidate.current - slot3.current) < 1.0) {
                    slot3 = altCandidate;
                }
            }
        }

        return [slot1.scenario.name, slot2.scenario.name, slot3.scenario.name];
    }

    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((): void => {
            this._notifyListeners();
        });
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
