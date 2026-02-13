/**
 * Represents a user profile summary returned from the Kovaaks search endpoint.
 */
export interface KovaaksUserSearchResult {
  readonly username: string;
  readonly steamAccountName: string;
  readonly steamId: string;
  readonly steamAccountAvatar: string;
  readonly country: string | null;
  readonly rank: number | null;
}

/**
 * Represents the full profile metadata for a Kovaaks user.
 */
export interface KovaaksUserProfile {
  readonly username: string;
  readonly steamId: string;
  readonly steamAccountName: string;
  readonly steamAccountAvatar: string;
}

/**
 * Represents a chronological event in the user's activity feed.
 */
export interface KovaaksActivityEvent {
  readonly type: "HIGH_SCORE" | "MILESTONE" | string;
  readonly scenarioName: string;
  readonly score: number;
  readonly timestamp: string;
}

/**
 * Represents a single score entry for a scenario as returned by the webapp-backend.
 */
export interface KovaaksScenarioScore {
  readonly score: number;
  readonly attributes: {
    readonly score: number;
    readonly epoch: string;
    readonly [key: string]: unknown;
  };
}

/**
 * Encapsulates the response from the search endpoint.
 */
export interface KovaaksSearchResponse {
  readonly data: KovaaksUserSearchResult[];
  readonly total: number;
}
