/**
 * Represents a Kovaaks player profile stored locally.
 */
export interface PlayerProfile {
    /** The unique Kovaaks username. */
    readonly username: string;
    /** The URL to the player's profile picture. */
    readonly pfpUrl: string;
    /** The player's Steam ID. */
    readonly steamId: string;
}

/**
 * Encapsulates the state of multi-player management.
 */
export interface IdentityState {
    /** The list of registered player profiles. */
    readonly profiles: PlayerProfile[];
    /** The username of the currently active player. */
    readonly activeUsername: string | null;
}
