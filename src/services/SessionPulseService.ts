import { SessionService, SessionRankRecord } from "./SessionService";
import { IdentityService } from "./IdentityService";
import { CloudflareService, SessionPulsePayload } from "./CloudflareService";

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
    private readonly _identityService: IdentityService;
    private readonly _cloudflareService: CloudflareService;

    private _pendingPulse: SessionRankRecord[] | null = null;
    private _lastProcessedSessionId: string | null = null;

    /**
     * Initializes the service with required dependencies.
     * Starts the outbox recovery process.
     *
     * @param sessionService - Service for tracking active sessions and ranks.
     * @param identityService - Service for managing device ID and consent.
     * @param cloudflareService - Service for Edge API communications.
     */
    public constructor(
        sessionService: SessionService,
        identityService: IdentityService,
        cloudflareService: CloudflareService,
    ) {
        this._sessionService = sessionService;
        this._identityService = identityService;
        this._cloudflareService = cloudflareService;

        this._subscribeToSessionEvents();
        this._initializeOutbox();
    }

    private _initializeOutbox(): void {
        this._lastProcessedSessionId = this._sessionService.sessionId;
        this._pendingPulse = this._sessionService.getAllScenarioSessionBests();

        this._retryOutbox().catch((): void => {
            // Passive recovery; errors handled within retryOutbox
        });
    }

    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((): void => {
            this._handleSessionUpdate();
        });
    }

    private _handleSessionUpdate(): void {
        const currentSessionId: string | null = this._sessionService.sessionId;

        if (this._lastProcessedSessionId !== null && currentSessionId !== this._lastProcessedSessionId) {
            this._syncPendingPulse().catch((): void => {
                // Async failure handled by outbox persistence
            });
        }

        if (currentSessionId !== null) {
            this._lastProcessedSessionId = currentSessionId;
            this._pendingPulse = this._sessionService.getAllScenarioSessionBests();
        } else {
            this._lastProcessedSessionId = null;
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
            isRanked: this._sessionService.isRanked,
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
