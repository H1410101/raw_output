/**
 * Response structure for the health check endpoint.
 */
export interface HealthCheckResponse {
    readonly status: string;
    readonly message: string;
    readonly timestamp: string;
    readonly environment: string;
}

/**
 * Payload structure for session synchronization.
 */
export interface SessionSyncPayload {
    readonly deviceId: string;
    readonly sessionId: string;
    readonly sessionDate: string;
    readonly isRanked: boolean;
    readonly rankedSessionId?: number | null;
    readonly difficulty?: string | null;
    readonly triedAll?: boolean;
    readonly runs: {
        readonly scenarioName: string;
        readonly bestScore: number;
        readonly isRankedRun?: boolean;
        readonly targetRankUnits?: number;
        readonly endRankUnits?: number;
        readonly highscoreRankUnits?: number;
        readonly scores?: number[];
    }[];
}

/**
 * Service responsible for managing connectivity with Cloudflare Edge Functions.
 * Provides diagnostics and health checks to ensure the cloud-hybrid logic is functional.
 */
export class CloudflareService {
    private readonly _baseUrl: string;

    /**
     * Initializes the service with local or remote base URLs.
     */
    public constructor() {
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this._baseUrl = isLocal ? "http://127.0.0.1:8788" : "";
    }

    /**
     * Performs a health check against the Cloudflare Edge API.
     * 
     * @returns A promise that resolves to the health check response.
     */
    public async checkHealth(): Promise<HealthCheckResponse> {
        try {
            const response = await fetch(`${this._baseUrl}/api/health`);

            if (!response.ok) {
                throw new Error(`Cloudflare health check failed with status: ${response.status}`);
            }

            return await response.json() as HealthCheckResponse;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Handshake failed";
            throw new Error(`Cloudflare Connectivity Error: ${message}`);
        }
    }

    /**
     * Sends a session synchronization payload to the Cloudflare Edge API.
     * 
     * @param payload - The data for a closed session.
     * @returns A promise that resolves when the data is successfully synced.
     */
    public async sendSync(payload: SessionSyncPayload): Promise<void> {
        try {
            const response = await fetch(`${this._baseUrl}/api/sync`, {
                method: "POST",
                headers: {
                    ["Content-Type"]: "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Sync failed with status: ${response.status}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Sync failed";
            throw new Error(`Cloudflare Sync Error: ${message}`);
        }
    }
}
