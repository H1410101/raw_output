import { SessionService, SessionRankRecord } from "./SessionService";
import { IdentityService } from "./IdentityService";
import { CloudflareService } from "./CloudflareService";

/**
 * Interface for the sync payload.
 */
interface PulsePayload {
    deviceId: string;
    sessionId: string;
    pulses: {
        scenarioName: string;
        bestRank: string;
        bestScore: number;
    }[];
}

/**
 * Service responsible for syncing session telemetry to Cloudflare Edge.
 * Monitors SessionService for expirations and reports "Best Ranks" achieved.
 */
export class SessionPulseService {
    private readonly _sessionService: SessionService;
    private readonly _identityService: IdentityService;
    private readonly _cloudflareService: CloudflareService;

    private _pendingPulse: SessionRankRecord[] | null = null;
    private _lastProcessedSessionId: string | null = null;

    /**
     * Initializes the service with required dependencies.
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
    }

    private _subscribeToSessionEvents(): void {
        this._sessionService.onSessionUpdated((): void => {
            this._handleSessionUpdate();
        });
    }

    private _handleSessionUpdate(): void {
        const currentSessionId: string | null = this._sessionService.sessionId;

        // If session ID changed (reset or new session), try to sync the previous data
        if (this._lastProcessedSessionId !== null && currentSessionId !== this._lastProcessedSessionId) {
            this._syncPendingPulse();
        }

        // Update state for next check
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

        const payload: PulsePayload = {
            deviceId: this._identityService.getDeviceId(),
            sessionId: this._lastProcessedSessionId as string,
            pulses: this._pendingPulse.map(record => ({
                scenarioName: record.scenarioName,
                bestRank: record.rankResult.currentRank,
                bestScore: record.bestScore,
            })),
        };

        try {
            await this._cloudflareService.sendPulse(payload);
        } catch {
            // Fail silently for telemetry; we don't want to disrupt the user experience
        }
    }
}
