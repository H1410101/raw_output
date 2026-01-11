import {
  getDifficulty,
  DifficultyTier,
  getScenariosByDifficulty,
  getAvailableDifficulties,
  getRankNamesForDifficulty,
  BenchmarkScenario,
} from "../data/benchmarks";

/**
 * Service for accessing and filtering benchmark scenario data.
 */
export class BenchmarkService {
  /**
   * Retrieves all available difficulty tiers defined by the benchmark files.
   *
   * @returns An array of difficulty tier names.
   */
  public getAvailableDifficulties(): DifficultyTier[] {
    return getAvailableDifficulties();
  }

  /**
   * Determines the difficulty level of a scenario based on Viscose Benchmark rules.
   *
   * @param scenarioName - The name of the Kovaak's scenario.
   * @returns The associated DifficultyTier level, or null if not found.
   */
  public getDifficulty(scenarioName: string): DifficultyTier | null {
    return getDifficulty(scenarioName);
  }

  /**
   * Retrieves all scenarios associated with a specific benchmark difficulty.
   *
   * @param difficulty - The difficulty level to filter by.
   * @returns An array of scenarios belonging to the specified difficulty.
   */
  public getScenarios(difficulty: DifficultyTier): BenchmarkScenario[] {
    return getScenariosByDifficulty(difficulty);
  }

  /**
   * Retrieves the rank names available for a specific difficulty tier.
   *
   * @param difficulty - The difficulty tier to inspect.
   * @returns An array of rank names in ascending order of difficulty.
   */
  public getRankNames(difficulty: DifficultyTier): string[] {
    return getRankNamesForDifficulty(difficulty);
  }
}
