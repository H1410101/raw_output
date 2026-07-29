import type { SessionSyncPayload } from "../types/SessionSyncTypes";

/**
 * Response structure for the health check endpoint.
 */
export interface HealthCheckResponse {
    readonly status: string;
    readonly message: string;
    readonly timestamp: string;
    readonly environment: string;
}

export type { SessionSyncPayload } from "../types/SessionSyncTypes";

/** Error returned by the score-feedback endpoint. */
export class CloudflareSyncError extends Error {
    public readonly status: number | null;

    /**
     * Creates an endpoint error while preserving its HTTP status.
     *
     * @param message - Human-readable failure description.
     * @param status - HTTP status, or null for a network failure.
     */
    public constructor(message: string, status: number | null = null) {
        super(message);
        this.name = "CloudflareSyncError";
        this.status = status;
    }

    /**
     * Whether retrying the same payload can reasonably succeed later.
     *
     * @returns True for network, throttling, timeout, and server failures.
     */
    public get isRetryable(): boolean {
        return this.status === null || this.status === 408 || this.status === 425 || this.status === 429 ||
            this.status >= 500;
    }
}

/**
 * Service responsible for managing connectivity with Cloudflare Edge Functions.
 * Provides diagnostics and health checks to ensure the cloud-hybrid logic is functional.
 */
export class CloudflareService {
    private static readonly _requestTimeoutMs: number = 15_000;
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
            const response = await fetch(`${this._baseUrl}/api/health`, {
                signal: AbortSignal.timeout(CloudflareService._requestTimeoutMs),
            });

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
                signal: AbortSignal.timeout(CloudflareService._requestTimeoutMs),
            });

            if (!response.ok) {
                throw new CloudflareSyncError(`Sync failed with status: ${response.status}`, response.status);
            }
        } catch (error) {
            if (error instanceof CloudflareSyncError) throw error;

            const message = error instanceof Error ? error.message : "Sync failed";
            throw new CloudflareSyncError(`Cloudflare Sync Error: ${message}`);
        }
    }
}
