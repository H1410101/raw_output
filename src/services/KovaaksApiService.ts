import {
    KovaaksUserProfile,
    KovaaksUserSearchResult,
    KovaaksActivityEvent,
    KovaaksScenarioScore,
} from "../types/KovaaksApiTypes";

/**
 * Service for interacting with the Kovaaks Web API.
 * Provides methods for user search and profile metadata retrieval.
 */
export class KovaaksApiService {
    private readonly _baseUrl: string = "https://kovaaks.com/webapp-backend";

    /**
     * Searches for users by their Kovaaks username.
     *
     * @param query - The partial or full username to search for.
     * @returns A list of matching user profiles.
     */
    public async searchUsers(query: string): Promise<KovaaksUserSearchResult[]> {
        if (query.trim().length === 0) {
            return [];
        }

        return this._fetchFromApi<KovaaksUserSearchResult[]>("/user/search", {
            username: query,
        });
    }

    /**
     * Fetches recent activity for a user, primarily high scores and milestones.
     *
     * @param username - The Kovaaks web username.
     * @returns A promise resolving to an array of activity events.
     */
    public async fetchRecentActivity(
        username: string,
    ): Promise<KovaaksActivityEvent[]> {
        return this._fetchFromApi<KovaaksActivityEvent[]>(
            "/user/activity/recent",
            { username },
        );
    }

    /**
     * Fetches the last 100 scores for a specific scenario by the user.
     *
     * @param username - The Kovaaks web username.
     * @param scenarioName - The exact case-sensitive scenario name.
     * @returns A promise resolving to an array of scenario scores.
     */
    public async fetchScenarioLastScores(
        username: string,
        scenarioName: string,
    ): Promise<KovaaksScenarioScore[]> {
        return this._fetchFromApi<KovaaksScenarioScore[]>(
            "/user/scenario/last-scores/by-name",
            {
                username: username,
                scenarioName: scenarioName,
            },
        );
    }

    /**
     * Fetches the full profile metadata for a specific Kovaaks username.
     *
     * @param username - The exact Kovaaks username.
     * @returns The user's full profile metadata.
     */
    public async fetchProfileByUsername(
        username: string
    ): Promise<KovaaksUserProfile> {
        return this._fetchFromApi<KovaaksUserProfile>("/user/profile/by-username", {
            username,
        });
    }

    private async _fetchFromApi<T>(
        endpoint: string,
        params: Record<string, string>
    ): Promise<T> {
        const url: URL = this._buildUrlWithParams(endpoint, params);
        const response: Response = await fetch(url.toString());

        return this._handleApiResponse<T>(response);
    }

    private _buildUrlWithParams(
        endpoint: string,
        params: Record<string, string>
    ): URL {
        const url: URL = new URL(`${this._baseUrl}${endpoint}`);
        Object.keys(params).forEach((key: string) =>
            url.searchParams.append(key, params[key])
        );

        return url;
    }

    private async _handleApiResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            console.error(`[KovaaksApi] HTTP Error: ${response.status} ${response.statusText}`);
            throw new Error(`Kovaaks API Error: ${response.statusText}`);
        }

        const payload: unknown = await response.json();

        // Handle both { data: T } wrapper and direct T response
        if (payload && typeof payload === "object" && "data" in payload) {
            const wrapped = payload as { data: T };

            return wrapped.data;
        }

        return payload as T;
    }
}
