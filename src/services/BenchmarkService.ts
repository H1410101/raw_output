import {
  getDifficulty,
  BenchmarkDifficulty,
  getScenariosByDifficulty,
} from "../data/benchmarks";

export class BenchmarkService {
  /**
   * Determines the difficulty level of a scenario based on Viscose Benchmark rules.
   *
   * @param scenarioName - The name of the Kovaak's scenario.
   * @returns The associated BenchmarkDifficulty level, or null if not found.
   */
  public getDifficulty(scenarioName: string): BenchmarkDifficulty | null {
    return getDifficulty(scenarioName);
  }

  /**
   * Retrieves all scenario names associated with a specific benchmark difficulty.
   *
   * @param difficulty - The difficulty level to filter by.
   * @returns An array of scenario names belonging to the specified difficulty.
   */
  public getScenarios(difficulty: BenchmarkDifficulty): string[] {
    return getScenariosByDifficulty(difficulty);
  }
}
