import { SessionService, SessionRankRecord } from "./SessionService";
import { IdentityService } from "./IdentityService";
import { CloudflareService, SessionSyncPayload } from "./CloudflareService";
import { RankedSessionService, RankedSessionState } from "./RankedSessionService";
import { RankEstimator } from "./RankEstimator";
import { BenchmarkService } from "./BenchmarkService";

/**
 * Dependencies required by the SessionSyncService.
 */
export interface SessionSyncDependencies {
    readonly sessionService: SessionService;
    readonly rankedSessionService: RankedSessionService;
    readonly identityService: IdentityService;
    readonly cloudflareService: CloudflareService;
    readonly rankEstimator: RankEstimator;
    readonly benchmarkService: BenchmarkService;
}

/**
 * Service responsible for syncing session data to Cloudflare Edge.
 * Monitors SessionService for expirations and reports Benchmark and Ranked results.
 * 
 * Implements a persistent outbox to ensure data is eventually delivered
 * even if the network is unstable or the browser is refreshed.
 */
export class SessionSyncService {
    private readonly _outboxKey: string = "sync_outbox";
    private readonly _sessionService: SessionService;
    private readonly _rankedSessionService: RankedSessionService;
    private readonly _identityService: IdentityService;
    private readonly _cloudflareService: CloudflareService;
    private readonly _rankEstimator: RankEstimator;
    private readonly _benchmarkService: BenchmarkService;

    private _pendingRuns: SessionRankRecord[] | null = null;
    private _lastProcessedSessionId: string | null = null;
    private _lastProcessedRankedId: number | null = null;

    // Snapshots to avoid race conditions when services are reset
    private _lastRankedStateSnapshot: RankedSessionState | null = null;

    /**
     * Initializes the service with required dependencies.
     *
     * @param dependencies - Core services required for sync logic.
     */
    public constructor(dependencies: SessionSyncDependencies) {
        this._sessionService = dependencies.sessionService;
        this._rankedSessionService = dependencies.rankedSessionService;
        this._identityService = dependencies.identityService;
        this._cloudflareService = dependencies.cloudflareService;
        this._rankEstimator = dependencies.rankEstimator;
        this._benchmarkService = dependencies.benchmarkService;

        this._subscribeToEvents();
        this._initializeOutbox();
    }

    private _initializeOutbox(): void {
        this._lastProcessedSessionId = this._sessionService.sessionId;
        this._lastProcessedRankedId = this._rankedSessionService.sessionId;
        this._lastRankedStateSnapshot = this._rankedSessionService.state;
        this._pendingRuns = this._sessionService.getAllScenarioSessionBests();

        this._retryOutbox().catch((): void => {
            // Passive recovery
        });
    }

    private _subscribeToEvents(): void {
        this._sessionService.onSessionUpdated((): void => {
            this._handleUpdate();
        });

        this._rankedSessionService.onStateChanged((): void => {
            this._handleUpdate();
        });
    }

    private _handleUpdate(): void {
        const currentSessionId: string | null = this._sessionService.sessionId;
        const currentRankedState = this._rankedSessionService.state;
        const currentRankedId: number | null = currentRankedState.rankedSessionId;

        const sessionChanged: boolean = this._lastProcessedSessionId !== null && currentSessionId !== this._lastProcessedSessionId;
        const rankedChanged: boolean = this._lastProcessedRankedId !== null && currentRankedId !== this._lastProcessedRankedId;
        const reachedSummary: boolean = currentRankedState.status === "SUMMARY" && this._lastRankedStateSnapshot?.status !== "SUMMARY";

        if (sessionChanged || rankedChanged || reachedSummary) {
            this._syncPendingRuns().catch((): void => {
                // Async failure handled by outbox persistence
            });
        }

        this._lastProcessedSessionId = currentSessionId;
        this._lastProcessedRankedId = currentRankedId;

        // Always snapshot the most recent "Active" or "Summary" state if it has an ID
        if (currentRankedId !== null) {
            this._lastRankedStateSnapshot = currentRankedState;
        }

        if (currentSessionId !== null) {
            this._pendingRuns = this._sessionService.getAllScenarioSessionBests();
        } else {
            this._pendingRuns = null;
        }
    }

    private async _syncPendingRuns(): Promise<void> {
        if (!this._pendingRuns || this._pendingRuns.length === 0) {
            return;
        }

        if (!this._identityService.isAnalyticsEnabled()) {
            return;
        }

        const rankedStateToSync = this._getRankedStateToSync();
        if (!rankedStateToSync) {
            return;
        }

        const payload = this._buildSyncPayload(rankedStateToSync);
        this._addToOutbox(payload);

        await this._retryOutbox();
    }

    private _getRankedStateToSync(): RankedSessionState | null {
        const isCurrentSessionActive = this._rankedSessionService.sessionId === this._lastProcessedRankedId;

        return isCurrentSessionActive ? this._rankedSessionService.state : this._lastRankedStateSnapshot;
    }

    private _buildSyncPayload(rankedStateToSync: RankedSessionState): SessionSyncPayload {
        const allRankedRuns = this._sessionService.getAllRankedSessionRuns();
        const isGauntletFinished = rankedStateToSync.sequence.length > 0 &&
            rankedStateToSync.sequence.every((scenarioName: string): boolean =>
                rankedStateToSync.playedScenarios.includes(scenarioName)
            );

        return {
            deviceId: this._identityService.getDeviceId(),
            sessionId: this._lastProcessedSessionId as string,
            sessionDate: this._getAnonymousDate(),
            isRanked: this._lastProcessedRankedId !== null,
            rankedSessionId: this._lastProcessedRankedId,
            difficulty: rankedStateToSync.difficulty,
            triedAll: isGauntletFinished,
            runs: this._pendingRuns!.map((record: SessionRankRecord) => this._mapRunRecord(record, allRankedRuns, rankedStateToSync)),
        };
    }

    private _mapRunRecord(
        record: SessionRankRecord,
        allRankedRuns: { scenarioName: string; score: number }[],
        rankedStateToSync: RankedSessionState
    ): object {
        const scenarioRuns = allRankedRuns
            .filter((run: { scenarioName: string }) => run.scenarioName === record.scenarioName)
            .map((run: { score: number }) => run.score)
            .slice(0, 3);

        const isRankedRun = scenarioRuns.length > 0;
        let detailedData = {};

        if (isRankedRun) {
            detailedData = this._calculateRankedData(record, scenarioRuns, rankedStateToSync);
        }

        return {
            scenarioName: record.scenarioName,
            bestScore: record.bestScore,
            ...detailedData
        };
    }

    private _calculateRankedData(
        record: SessionRankRecord,
        scenarioRuns: number[],
        rankedStateToSync: RankedSessionState
    ): object {
        const difficulty = rankedStateToSync.difficulty || "";
        const scenario = this._benchmarkService.getScenarios(difficulty)
            .find((item): boolean => item.name === record.scenarioName);

        const finalEstimate = this._rankEstimator.getScenarioEstimate(record.scenarioName);
        const initialTarget = rankedStateToSync.initialEstimates[record.scenarioName] ?? 0;
        const highscoreRankUnits = scenario ? this._rankEstimator.getScenarioContinuousValue(record.bestScore, scenario) : 0;

        return {
            isRankedRun: true,
            targetRankUnits: initialTarget,
            endRankUnits: finalEstimate.continuousValue,
            highscoreRankUnits,
            scores: scenarioRuns,
        };
    }

    private _getAnonymousDate(): string {
        const startTimestamp: number = this._sessionService.sessionStartTimestamp || Date.now();

        return new Date(startTimestamp).toISOString().split("T")[0];
    }

    private _addToOutbox(payload: SessionSyncPayload): void {
        const outbox: SessionSyncPayload[] = this._getOutbox();
        outbox.push(payload);
        localStorage.setItem(this._outboxKey, JSON.stringify(outbox));
    }

    private _getOutbox(): SessionSyncPayload[] {
        const raw: string | null = localStorage.getItem(this._outboxKey);
        if (!raw) return [];
        try {
            return JSON.parse(raw) as SessionSyncPayload[];
        } catch {
            return [];
        }
    }

    private async _retryOutbox(): Promise<void> {
        const outbox: SessionSyncPayload[] = this._getOutbox();
        if (outbox.length === 0) return;

        const remaining: SessionSyncPayload[] = [];
        for (const payload of outbox) {
            try {
                await this._cloudflareService.sendSync(payload);
            } catch {
                remaining.push(payload);
            }
        }

        if (remaining.length === 0) {
            localStorage.removeItem(this._outboxKey);
        } else {
            localStorage.setItem(this._outboxKey, JSON.stringify(remaining));
        }
    }
}
