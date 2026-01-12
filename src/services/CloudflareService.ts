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
 * Service responsible for managing connectivity with Cloudflare Edge Functions.
 * Provides diagnostics and health checks to ensure the cloud-hybrid logic is functional.
 */
export class CloudflareService {
    private readonly _baseUrl: string;

    /**
     * Initializes the service with local or remote base URLs.
     */
    public constructor() {
        // In development, Cloudflare Pages usually runs on port 8788 via wrangler
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this._baseUrl = isLocal ? "http://127.0.0.1:8788" : "";
    }

    /**
     * Performs a health check against the Cloudflare Edge API.
     * 
     * @returns A promise that resolves to the health check response.
     * @throws An error if the handshake fails.
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
}
