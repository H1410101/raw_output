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
/* eslint-disable @typescript-eslint/naming-convention */
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
/**
 * Represents a single scenario's performance details within a benchmark.
 */
export interface KovaaksBenchmarkScenario {
  /** The best score achieved by the player. */
  readonly score: number;
  /** The rank achieved for this specific scenario. */
  readonly scenario_rank: number;
  /** The threshold scores for each rank level. */
  readonly rank_maxes: number[];
  /** The global leaderboard rank for the player's best score. */
  readonly leaderboard_rank: number;
  /** The leaderboard ID for this scenario. */
  readonly leaderboard_id: number;
}

/**
 * Represents a category within a benchmark, containing multiple scenarios.
 */
export interface KovaaksBenchmarkCategory {
  /** The cumulative progress score for this category. */
  readonly benchmark_progress: number;
  /** The overall rank achieved in this category. */
  readonly category_rank: number;
  /** The threshold progress values for each rank level. */
  readonly rank_maxes: number[];
  /** A map of scenario names to their details. */
  readonly scenarios: Record<string, KovaaksBenchmarkScenario>;
}

/**
 * Represents a rank definition in the Kovaaks benchmark system.
 */
export interface KovaaksBenchmarkRank {
  /** The name of the rank. */
  readonly name: string;
  /** The URL to the rank's icon. */
  readonly icon: string;
  /** The hex color associated with the rank. */
  readonly color: string;
}

/**
 * Represents the full response from the benchmark progress API.
 */
export interface KovaaksBenchmarkResponse {
  /** The total benchmark progress score. */
  readonly benchmark_progress: number;
  /** The overall rank achieved across the entire benchmark. */
  readonly overall_rank: number;
  /** A map of category names to their details. */
  readonly categories: Record<string, KovaaksBenchmarkCategory>;
  /** A list of all available ranks in this benchmark set. */
  readonly ranks: KovaaksBenchmarkRank[];
}
