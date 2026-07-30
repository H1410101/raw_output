import { SessionService, SessionRankRecord } from "./SessionService";
import { IdentityService } from "./IdentityService";
import { CloudflareService, CloudflareSyncError } from "./CloudflareService";
import { RankedSessionService, RankedSessionState } from "./RankedSessionService";
import { RankEstimator } from "./RankEstimator";
import { BenchmarkService } from "./BenchmarkService";
import type { BenchmarkScenario } from "../data/benchmarks";
import {
    isSessionSyncPayload,
    SESSION_SYNC_LIMITS,
    type SessionSyncPayload,
    type SessionSyncRun,
} from "../types/SessionSyncTypes";

interface BenchmarkRunSnapshot {
    readonly scenarioName: string;
    readonly bestScore: number;
}

interface RankedRunSnapshot {
    readonly scores: readonly number[];
    readonly targetRankUnits: number;
    readonly endRankUnits: number;
    readonly highscoreRankUnits: number;
}

interface RankedOperationSnapshot {
    readonly sourceRankedSessionId: number;
    readonly rankedSessionId: number;
    readonly difficulty: string;
    readonly triedAll: boolean;
    readonly status: RankedSessionState["status"];
    readonly runsByScenario: ReadonlyMap<string, RankedRunSnapshot>;
}

interface SessionOperationSnapshot {
    readonly profileUsername: string | null;
    readonly sessionId: string;
    readonly sessionStartTimestamp: number;
    readonly sessionDate: string;
    readonly isActive: boolean;
    readonly runs: readonly BenchmarkRunSnapshot[];
    readonly ranked: RankedOperationSnapshot | null;
}

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
    private static readonly _initialRetryDelayMs: number = 5_000;
    private static readonly _maximumRetryDelayMs: number = 5 * 60_000;
    private readonly _outboxKey: string = "sync_outbox";
    private readonly _sessionService: SessionService;
    private readonly _rankedSessionService: RankedSessionService;
    private readonly _identityService: IdentityService;
    private readonly _cloudflareService: CloudflareService;
    private readonly _rankEstimator: RankEstimator;
    private readonly _benchmarkService: BenchmarkService;

    private _currentSnapshot: SessionOperationSnapshot | null = null;
    private _lastQueuedPayloadSignature: string | null = null;
    private _repeatExpirySyncAllowed: boolean = false;
    private _outboxDrain: Promise<void> | null = null;
    private _outboxGeneration: number = 0;
    private _updateScheduled: boolean = false;
    private _retryTimer: number | null = null;
    private _retryDelayMs: number = SessionSyncService._initialRetryDelayMs;

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
        const sessionId: string | null = this._sessionService.sessionId;
        this._currentSnapshot = sessionId === null
            ? null
            : this._captureSessionSnapshot(sessionId, null, this._rankedSessionService.state, true);

        if (!this._identityService.isAnalyticsEnabled()) {
            this._purgeOutbox();

            return;
        }

        if (this._currentSnapshot && !this._currentSnapshot.isActive) {
            this._queueSnapshot(this._currentSnapshot);
        }

        if (this._outboxDrain === null && this._getOutbox().length > 0) {
            this._retryOutbox().catch((): void => {
                // Passive recovery
            });
        }
    }

    private _subscribeToEvents(): void {
        this._sessionService.onSessionUpdated((): void => {
            this._handleServiceUpdate();
        });

        this._rankedSessionService.onStateChanged((): void => {
            this._handleServiceUpdate();
        });

        this._identityService.onAnalyticsConsentChanged((enabled: boolean): void => {
            this._handleAnalyticsConsentChanged(enabled);
        });

        window.addEventListener("online", (): void => {
            this._retryOutbox().catch((): void => undefined);
        });
    }

    private _handleServiceUpdate(): void {
        const snapshotSessionId: string | null = this._currentSnapshot?.sessionId ?? null;
        const snapshotProfile: string | null = this._currentSnapshot?.profileUsername ?? null;
        if (this._sessionService.sessionId === snapshotSessionId &&
            this._identityService.getKovaaksUsername() === snapshotProfile) {
            this._handleUpdate();

            return;
        }

        if (this._updateScheduled) return;
        this._updateScheduled = true;
        queueMicrotask((): void => {
            this._updateScheduled = false;
            this._handleUpdate();
        });
    }

    private _handleAnalyticsConsentChanged(enabled: boolean): void {
        if (!enabled) {
            this._purgeOutbox();

            return;
        }

        this._retryOutbox().catch((): void => {
            // Passive recovery
        });
    }

    private _handleUpdate(): void {
        const previousSnapshot: SessionOperationSnapshot | null = this._currentSnapshot;
        const currentSessionId: string | null = this._sessionService.sessionId;

        if (currentSessionId === null) {
            if (previousSnapshot) {
                this._queueSnapshot(previousSnapshot);
            }

            this._currentSnapshot = null;
            this._repeatExpirySyncAllowed = false;

            return;
        }

        const currentRankedState: RankedSessionState = this._rankedSessionService.state;
        const currentProfile: string | null = this._identityService.getKovaaksUsername();
        const isSameSession: boolean = previousSnapshot?.sessionId === currentSessionId &&
            previousSnapshot.profileUsername === currentProfile;
        const rankedChanged: boolean = isSameSession &&
            this._hasRankedOperationChanged(previousSnapshot?.ranked ?? null, currentRankedState);

        if (previousSnapshot && (!isSameSession || rankedChanged)) {
            this._queueSnapshot(previousSnapshot);
        }

        const currentSnapshot = this._captureSessionSnapshot(
            currentSessionId,
            isSameSession ? previousSnapshot : null,
            currentRankedState,
            !rankedChanged,
        );
        this._currentSnapshot = currentSnapshot;
        this._handleSessionTransition(previousSnapshot, currentSnapshot, isSameSession);
    }

    private _hasRankedOperationChanged(
        previousRanked: RankedOperationSnapshot | null,
        currentRanked: RankedSessionState,
    ): boolean {
        return previousRanked !== null && currentRanked.rankedSessionId !== null &&
            currentRanked.difficulty !== null && this._getRankedOperationId(
                currentRanked.rankedSessionId,
                currentRanked.difficulty,
            ) !== previousRanked.rankedSessionId;
    }

    private _handleSessionTransition(
        previousSnapshot: SessionOperationSnapshot | null,
        currentSnapshot: SessionOperationSnapshot,
        isSameSession: boolean,
    ): void {
        if (!isSameSession || !previousSnapshot) {
            this._repeatExpirySyncAllowed = false;
            if (!currentSnapshot.isActive) {
                this._queueSnapshot(currentSnapshot);
            }

            return;
        }

        const reachedSummary: boolean = currentSnapshot.ranked?.status === "SUMMARY" &&
            previousSnapshot.ranked?.status !== "SUMMARY";
        if (reachedSummary) {
            this._queueSnapshot(currentSnapshot);
        }

        if (!previousSnapshot.isActive && currentSnapshot.isActive) {
            this._repeatExpirySyncAllowed = true;
        }

        if (previousSnapshot.isActive && !currentSnapshot.isActive) {
            this._queueSnapshot(currentSnapshot, this._repeatExpirySyncAllowed);
            this._repeatExpirySyncAllowed = false;
        }
    }

    private _captureSessionSnapshot(
        sessionId: string,
        previousSnapshot: SessionOperationSnapshot | null,
        rankedState: RankedSessionState,
        preserveRanked: boolean,
    ): SessionOperationSnapshot {
        const profileUsername: string | null = this._identityService.getKovaaksUsername();
        const matchingPreviousSnapshot: SessionOperationSnapshot | null = previousSnapshot?.sessionId === sessionId &&
            previousSnapshot.profileUsername === profileUsername
            ? previousSnapshot
            : null;
        const sessionStartTimestamp: number = matchingPreviousSnapshot
            ? matchingPreviousSnapshot.sessionStartTimestamp
            : this._getValidTimestamp(this._sessionService.sessionStartTimestamp);
        const previousRanked: RankedOperationSnapshot | null = matchingPreviousSnapshot && preserveRanked
            ? matchingPreviousSnapshot.ranked
            : null;

        return {
            profileUsername,
            sessionId,
            sessionStartTimestamp,
            sessionDate: matchingPreviousSnapshot
                ? matchingPreviousSnapshot.sessionDate
                : new Date(sessionStartTimestamp).toISOString().split("T")[0],
            isActive: this._sessionService.isSessionActive(Date.now() + 1),
            runs: this._captureBenchmarkRuns(),
            ranked: this._captureRankedSnapshot(rankedState, sessionStartTimestamp, previousRanked),
        };
    }

    private _captureBenchmarkRuns(): BenchmarkRunSnapshot[] {
        return this._sessionService.getAllScenarioSessionBests()
            .map((record: SessionRankRecord): BenchmarkRunSnapshot => ({
                scenarioName: record.scenarioName,
                bestScore: record.bestScore,
            }));
    }

    private _getValidTimestamp(timestamp: number | null): number {
        return timestamp !== null && Number.isFinite(timestamp) ? timestamp : Date.now();
    }

    private _captureRankedSnapshot(
        rankedState: RankedSessionState,
        sessionStartTimestamp: number,
        previousSnapshot: RankedOperationSnapshot | null,
    ): RankedOperationSnapshot | null {
        const { rankedSessionId: sourceRankedSessionId, difficulty } = rankedState;
        if (sourceRankedSessionId === null || difficulty === null) {
            return previousSnapshot;
        }
        const rankedSessionId: number = this._getRankedOperationId(sourceRankedSessionId, difficulty);

        const scoresByScenario: Map<string, number[]> = this._groupRankedRuns(sessionStartTimestamp);
        const triedAll: boolean = this._hasTriedAll(rankedState);
        const isSameRankedOperation: boolean = previousSnapshot?.sourceRankedSessionId === sourceRankedSessionId &&
            previousSnapshot.difficulty === difficulty;

        if (scoresByScenario.size === 0) {
            return this._captureEmptyRankedSnapshot(previousSnapshot, rankedState, triedAll, isSameRankedOperation);
        }

        const reusedSnapshot = this._reuseRankedSnapshot(
            previousSnapshot, rankedState, scoresByScenario, triedAll,
        );
        if (reusedSnapshot) return reusedSnapshot;

        return {
            sourceRankedSessionId,
            rankedSessionId,
            difficulty,
            triedAll: (isSameRankedOperation && previousSnapshot?.triedAll === true) || triedAll,
            status: rankedState.status,
            runsByScenario: this._captureRankedRunDetails(scoresByScenario, rankedState, difficulty),
        };
    }

    private _reuseRankedSnapshot(
        previousSnapshot: RankedOperationSnapshot | null,
        rankedState: RankedSessionState,
        scoresByScenario: ReadonlyMap<string, readonly number[]>,
        triedAll: boolean,
    ): RankedOperationSnapshot | null {
        const reachedSummary: boolean = rankedState.status === "SUMMARY" &&
            previousSnapshot?.status !== "SUMMARY";
        const isSameRankedOperation: boolean = previousSnapshot?.sourceRankedSessionId === rankedState.rankedSessionId &&
            previousSnapshot.difficulty === rankedState.difficulty;
        if (!isSameRankedOperation || !previousSnapshot || reachedSummary ||
            !this._rankedRunsMatch(previousSnapshot.runsByScenario, scoresByScenario)) {
            return null;
        }

        return {
            ...previousSnapshot,
            triedAll: previousSnapshot.triedAll || triedAll,
            status: rankedState.status,
        };
    }

    private _hasTriedAll(rankedState: RankedSessionState): boolean {
        const playedScenarios = new Set(rankedState.playedScenarios);

        return rankedState.sequence.length > 0 &&
            rankedState.sequence.every((scenarioName: string): boolean => playedScenarios.has(scenarioName));
    }

    private _getRankedOperationId(rankedSessionId: number, difficulty: string): number {
        const difficultyIndex: number = this._benchmarkService.getAvailableDifficulties().indexOf(difficulty);
        const difficultyKey: number = difficultyIndex >= 0 ? difficultyIndex + 1 : 999;

        return rankedSessionId * 1_000 + difficultyKey;
    }

    private _captureEmptyRankedSnapshot(
        previousSnapshot: RankedOperationSnapshot | null,
        rankedState: RankedSessionState,
        triedAll: boolean,
        isSameRankedOperation: boolean,
    ): RankedOperationSnapshot | null {
        if (!isSameRankedOperation || !previousSnapshot) {
            return null;
        }

        return {
            ...previousSnapshot,
            triedAll: previousSnapshot.triedAll || triedAll,
            status: rankedState.status,
        };
    }

    private _groupRankedRuns(sessionStartTimestamp: number): Map<string, number[]> {
        const scoresByScenario = new Map<string, number[]>();

        for (const run of this._sessionService.getAllRankedSessionRuns()) {
            if (run.timestamp < sessionStartTimestamp) continue;

            const scores: number[] = scoresByScenario.get(run.scenarioName) ?? [];
            scores.push(run.score);
            scoresByScenario.set(run.scenarioName, scores);
        }

        return scoresByScenario;
    }

    private _rankedRunsMatch(
        previousRuns: ReadonlyMap<string, RankedRunSnapshot>,
        scoresByScenario: ReadonlyMap<string, readonly number[]>,
    ): boolean {
        if (previousRuns.size !== scoresByScenario.size) return false;

        for (const [scenarioName, scores] of scoresByScenario) {
            const previousScores: readonly number[] | undefined = previousRuns.get(scenarioName)?.scores;
            if (!previousScores || previousScores.length !== scores.length ||
                previousScores.some((score: number, index: number): boolean => score !== scores[index])) {
                return false;
            }
        }

        return true;
    }

    private _captureRankedRunDetails(
        scoresByScenario: ReadonlyMap<string, readonly number[]>,
        rankedState: RankedSessionState,
        difficulty: string,
    ): ReadonlyMap<string, RankedRunSnapshot> {
        const scenariosByName = new Map<string, BenchmarkScenario>();
        for (const scenario of this._benchmarkService.getScenarios(difficulty)) {
            scenariosByName.set(scenario.name, scenario);
        }

        const runsByScenario = new Map<string, RankedRunSnapshot>();
        for (const [scenarioName, scores] of scoresByScenario) {
            const scenario: BenchmarkScenario | undefined = scenariosByName.get(scenarioName);
            const rankedBestScore: number = Math.max(...scores);

            runsByScenario.set(scenarioName, {
                scores: [...scores],
                targetRankUnits: rankedState.initialEstimates[scenarioName] ?? 0,
                endRankUnits: this._rankEstimator.getScenarioEstimate(scenarioName).continuousValue,
                highscoreRankUnits: scenario
                    ? this._rankEstimator.getScenarioContinuousValue(rankedBestScore, scenario)
                    : 0,
            });
        }

        return runsByScenario;
    }

    private _buildSyncPayload(snapshot: SessionOperationSnapshot): SessionSyncPayload {
        const runs: SessionSyncRun[] = this._buildRunPayloads(snapshot);
        const hasRankedRun: boolean = runs.some((run: SessionSyncRun): boolean => run.isRankedRun === true);
        const commonPayload = {
            deviceId: this._identityService.getDeviceId(),
            sessionId: snapshot.sessionId,
            sessionDate: snapshot.sessionDate,
            runs,
        };

        if (snapshot.ranked && hasRankedRun) {
            return {
                ...commonPayload,
                isRanked: true,
                rankedSessionId: snapshot.ranked.rankedSessionId,
                difficulty: snapshot.ranked.difficulty,
                triedAll: snapshot.ranked.triedAll,
            };
        }

        return {
            ...commonPayload,
            isRanked: false,
        };
    }

    private _buildRunPayloads(snapshot: SessionOperationSnapshot): SessionSyncRun[] {
        return snapshot.runs.map((record: BenchmarkRunSnapshot): SessionSyncRun => {
            const rankedRun: RankedRunSnapshot | undefined = snapshot.ranked?.runsByScenario.get(record.scenarioName);
            if (!rankedRun) {
                return {
                    scenarioName: record.scenarioName,
                    bestScore: record.bestScore,
                };
            }

            return {
                scenarioName: record.scenarioName,
                bestScore: record.bestScore,
                isRankedRun: true,
                targetRankUnits: rankedRun.targetRankUnits,
                endRankUnits: rankedRun.endRankUnits,
                highscoreRankUnits: rankedRun.highscoreRankUnits,
                scores: rankedRun.scores.slice(0, SESSION_SYNC_LIMITS.scoresPerRun),
            };
        });
    }

    private _queueSnapshot(snapshot: SessionOperationSnapshot, allowRepeat: boolean = false): void {
        if (snapshot.runs.length === 0 || !this._identityService.isAnalyticsEnabled()) {
            return;
        }

        const payload: SessionSyncPayload = this._buildSyncPayload(snapshot);
        const payloadSignature: string = JSON.stringify(payload);
        const outbox: SessionSyncPayload[] = this._getOutbox();
        const isAlreadyQueued: boolean = outbox.some((queuedPayload: SessionSyncPayload): boolean =>
            JSON.stringify(queuedPayload) === payloadSignature
        );

        if (isAlreadyQueued || (!allowRepeat && payloadSignature === this._lastQueuedPayloadSignature)) {
            this._lastQueuedPayloadSignature = payloadSignature;
            this._retryOutbox().catch((): void => {
                // Passive recovery
            });

            return;
        }

        outbox.push(payload);
        this._writeOutbox(outbox);
        this._lastQueuedPayloadSignature = payloadSignature;
        this._retryOutbox().catch((): void => {
            // Async failure handled by outbox persistence
        });
    }

    private _getOutbox(): SessionSyncPayload[] {
        const raw: string | null = localStorage.getItem(this._outboxKey);
        if (!raw) return [];

        try {
            const parsed: unknown = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) {
                this._purgeOutbox();

                return [];
            }

            const validPayloads: SessionSyncPayload[] = parsed.filter(isSessionSyncPayload);
            const normalizedPayloads: SessionSyncPayload[] = validPayloads.map(
                (payload: SessionSyncPayload): SessionSyncPayload => this._normalizeOutboxPayload(payload),
            );
            if (normalizedPayloads.length !== parsed.length ||
                normalizedPayloads.some((payload: SessionSyncPayload, index: number): boolean =>
                    payload !== validPayloads[index])) {
                this._writeOutbox(normalizedPayloads);
            }

            return normalizedPayloads;
        } catch {
            this._purgeOutbox();

            return [];
        }
    }

    private _normalizeOutboxPayload(payload: SessionSyncPayload): SessionSyncPayload {
        const rankedSessionId: number | null | undefined = payload.rankedSessionId;
        if (!payload.isRanked || typeof rankedSessionId !== "number" || typeof payload.difficulty !== "string") {
            return payload;
        }

        const legacyDate = new Date(rankedSessionId);
        const legacyYear: number = legacyDate.getUTCFullYear();
        if (legacyYear < SESSION_SYNC_LIMITS.minimumDateYear ||
            legacyYear > SESSION_SYNC_LIMITS.maximumDateYear) return payload;

        return {
            ...payload,
            rankedSessionId: this._getRankedOperationId(rankedSessionId, payload.difficulty),
        };
    }

    private _writeOutbox(outbox: SessionSyncPayload[]): void {
        if (outbox.length === 0) {
            localStorage.removeItem(this._outboxKey);

            return;
        }

        localStorage.setItem(this._outboxKey, JSON.stringify(outbox));
    }

    private _purgeOutbox(): void {
        this._outboxGeneration++;
        if (this._retryTimer !== null) window.clearTimeout(this._retryTimer);
        this._retryTimer = null;
        this._retryDelayMs = SessionSyncService._initialRetryDelayMs;
        localStorage.removeItem(this._outboxKey);
    }

    private _retryOutbox(): Promise<void> {
        const previousDrain: Promise<void> = this._outboxDrain ?? Promise.resolve();
        const nextDrain: Promise<void> = previousDrain
            .catch((): void => undefined)
            .then((): Promise<void> => this._drainOutbox());

        this._outboxDrain = nextDrain;
        void nextDrain.then(
            (): void => this._finishOutboxDrain(nextDrain),
            (): void => this._finishOutboxDrain(nextDrain),
        );

        return nextDrain;
    }

    private _finishOutboxDrain(completedDrain: Promise<void>): void {
        if (this._outboxDrain === completedDrain) {
            this._outboxDrain = null;
        }
    }

    private async _drainOutbox(): Promise<void> {
        while (true) {
            const payload: SessionSyncPayload | undefined = this._getOutbox()[0];
            if (!payload) return;

            const generation: number = this._outboxGeneration;
            if (!this._identityService.isAnalyticsEnabled()) {
                this._purgeOutbox();

                return;
            }

            try {
                await this._cloudflareService.sendSync(payload);
            } catch (error) {
                if (error instanceof CloudflareSyncError && !error.isRetryable) {
                    if (generation !== this._outboxGeneration || !this._removeSentPayload(payload)) return;

                    continue;
                }

                this._scheduleRetry();

                return;
            }

            this._retryDelayMs = SessionSyncService._initialRetryDelayMs;

            if (generation !== this._outboxGeneration || !this._removeSentPayload(payload)) {
                return;
            }
        }
    }

    private _scheduleRetry(): void {
        if (this._retryTimer !== null || !this._identityService.isAnalyticsEnabled()) return;

        this._retryTimer = window.setTimeout((): void => {
            this._retryTimer = null;
            this._retryOutbox().catch((): void => undefined);
        }, this._retryDelayMs);
        this._retryDelayMs = Math.min(
            this._retryDelayMs * 2,
            SessionSyncService._maximumRetryDelayMs,
        );
    }

    private _removeSentPayload(payload: SessionSyncPayload): boolean {
        const outbox: SessionSyncPayload[] = this._getOutbox();
        if (outbox.length === 0 || JSON.stringify(outbox[0]) !== JSON.stringify(payload)) {
            return false;
        }

        outbox.shift();
        this._writeOutbox(outbox);

        return true;
    }
}
