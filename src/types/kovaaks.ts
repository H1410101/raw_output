/**
 * Represents a single performance record from a Kovaak's challenge run.
 */
export interface KovaaksChallengeRun {
  /** Unique identifier for the run. */
  readonly runId: string;

  /** Name of the scenario performed. */
  readonly scenarioName: string;

  /** Final score achieved in the run. */
  readonly score: number;

  /** Timestamp when the run was completed. */
  readonly completionDate: Date;

  /** Benchmark difficulty tier associated with the scenario, derived from source file names. */
  readonly difficulty: string | null;
}
