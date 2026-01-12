import { SessionService, SessionRankRecord } from "./SessionService";
import { IdentityService } from "./IdentityService";
import { CloudflareService, SessionPulsePayload } from "./CloudflareService";
import { RankedSessionService } from "./RankedSessionService";

/**
 * Service responsible for syncing session telemetry to Cloudflare Edge.
 * Monitors SessionService for expirations and reports "Best Ranks" achieved.
 * 
 * Implements a persistent outbox to ensure data is eventually delivered
 * even if the network is unstable or the browser is refreshed.
 */
export class SessionPulseService {
    private readonly _outboxKey: string = "telemetry_outbox";
    private readonly _sessionService: SessionService;
    private readonly _rankedSessionService: RankedSessionService;
    private readonly _identityService: IdentityService;
    private readonly _cloudflareService: CloudflareService;

    private _pendingPulse: SessionRankRecord[] | null = null;
    private _lastProcessedSessionId: string | null = null;
    private _lastProcessedRankedId: string | null = null;

    /**
     * Initializes the service with required dependencies.
     * Starts the outbox recovery process.
     *
     * @param sessionService - Service for tracking active sessions and ranks.
     * @param rankedSessionService - Service for ranked session tracking.
     * @param identityService - Service for managing device ID and consent.
     * @param cloudflareService - Service for Edge API communications.
     */
    public constructor(
        sessionService: SessionService,
        rankedSessionService: RankedSessionService,
        identityService: IdentityService,
        cloudflareService: CloudflareService,
    ) {
        this._sessionService = sessionService;
        this._rankedSessionService = rankedSessionService;
        this._identityService = identityService;
        this._cloudflareService = cloudflareService;

        this._subscribeToEvents();
        this._initializeOutbox();
    }

    private _initializeOutbox(): void {
        this._lastProcessedSessionId = this._sessionService.sessionId;
        this._lastProcessedRankedId = this._rankedSessionService.sessionId;
        this._pendingPulse = this._sessionService.getAllScenarioSessionBests();

        this._retryOutbox().catch((): void => {
            // Passive recovery; errors handled within retryOutbox
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
        const currentRankedId: string | null = this._rankedSessionService.sessionId;

        const sessionChanged: boolean = this._lastProcessedSessionId !== null && currentSessionId !== this._lastProcessedSessionId;
        const rankedChanged: boolean = this._lastProcessedRankedId !== null && currentRankedId !== this._lastProcessedRankedId;

        if (sessionChanged || rankedChanged) {
            this._syncPendingPulse().catch((): void => {
                // Async failure handled by outbox persistence
            });
        }

        this._lastProcessedSessionId = currentSessionId;
        this._lastProcessedRankedId = currentRankedId;

        if (currentSessionId !== null) {
            this._pendingPulse = this._sessionService.getAllScenarioSessionBests();
        } else {
            this._pendingPulse = null;
        }
    }

    private async _syncPendingPulse(): Promise<void> {
        if (!this._pendingPulse || this._pendingPulse.length === 0) {
            return;
        }

        if (!this._identityService.isAnalyticsEnabled()) {
            return;
        }

        const payload: SessionPulsePayload = {
            deviceId: this._identityService.getDeviceId(),
            sessionId: this._lastProcessedSessionId as string,
            sessionDate: this._getAnonymousDate(),
            isRanked: this._lastProcessedRankedId !== null,
            rankedSessionId: this._lastProcessedRankedId,
            pulses: this._pendingPulse.map((record: SessionRankRecord) => ({
                scenarioName: record.scenarioName,
                bestRank: record.rankResult.currentRank,
                bestScore: record.bestScore,
            })),
        };

        this._addToOutbox(payload);
        await this._retryOutbox();
    }

    private _getAnonymousDate(): string {
        const startTimestamp: number = this._sessionService.sessionStartTimestamp || Date.now();

        return new Date(startTimestamp).toISOString().split("T")[0];
    }

    private _addToOutbox(payload: SessionPulsePayload): void {
        const outbox: SessionPulsePayload[] = this._getOutbox();
        outbox.push(payload);
        localStorage.setItem(this._outboxKey, JSON.stringify(outbox));
    }

    private _getOutbox(): SessionPulsePayload[] {
        const raw: string | null = localStorage.getItem(this._outboxKey);
        if (!raw) {
            return [];
        }

        try {
            return JSON.parse(raw) as SessionPulsePayload[];
        } catch {
            return [];
        }
    }

    private async _retryOutbox(): Promise<void> {
        const outbox: SessionPulsePayload[] = this._getOutbox();
        if (outbox.length === 0) {
            return;
        }

        const remaining: SessionPulsePayload[] = [];

        for (const payload of outbox) {
            try {
                await this._cloudflareService.sendPulse(payload);
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
