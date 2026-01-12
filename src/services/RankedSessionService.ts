import { BenchmarkService } from "./BenchmarkService";
import { SessionService, SessionRankRecord } from "./SessionService";
import { Prng } from "../utils/Prng";
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
     */
    public constructor(
        benchmarkService: BenchmarkService,
        sessionService: SessionService,
    ) {
        this._benchmarkService = benchmarkService;
        this._sessionService = sessionService;

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

        const prng: Prng = this._createPrng();

        // Initial 3 scenarios
        for (let i: number = 0; i < 3; i++) {
            this._sequence.push(this._generateNextInSequence(prng, scenarios));
        }

        this._sessionService.setIsRanked(true);
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
     * Extends a completed or near-complete session by one scenario.
     */
    public extendSession(): void {
        if (!this._difficulty || !this._startTime) {
            return;
        }

        // Passing this point mark the gate as open
        this._initialGauntletComplete = true;
        const scenarios: BenchmarkScenario[] = this._benchmarkService.getScenarios(this._difficulty);
        const prng: Prng = this._createPrng();

        // Advance PRNG to match current sequence length
        for (let index: number = 0; index < this._sequence.length; index++) {
            this._generateNextInSequence(prng, scenarios);
        }

        this._sequence.push(this._generateNextInSequence(prng, scenarios));
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

    private _createPrng(): Prng {
        const seedStr: string = `ranked-${this._difficulty}-${this._startTime}`;

        return new Prng(Prng.seedFromString(seedStr));
    }

    private _generateNextInSequence(prng: Prng, pool: BenchmarkScenario[]): string {
        // Strong-Weak-Weak logic placeholder:
        // For now, we cycle through categories to ensure a balanced test.
        // We'll use the PRNG to pick a scenario from the current category.
        const categories: string[] = ["Dynamic Clicking", "Reactive Tracking", "Flick Tech", "Control Tracking"];
        const categoryIndex: number = this._sequence.length % categories.length;
        const targetCategory: string = categories[categoryIndex];

        const filteredPool: BenchmarkScenario[] = pool.filter(
            (scenario: BenchmarkScenario): boolean => scenario.category === targetCategory
        );

        const sourcePool: BenchmarkScenario[] = filteredPool.length > 0 ? filteredPool : pool;
        const randomIndex: number = prng.nextInt(0, sourcePool.length);

        return sourcePool[randomIndex].name;
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
