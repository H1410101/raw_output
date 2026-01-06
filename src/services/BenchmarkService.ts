import {
  getDifficulty,
  BenchmarkDifficulty,
  getScenariosByDifficulty,
  BenchmarkScenario,
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
   * Retrieves all scenarios associated with a specific benchmark difficulty.
   *
   * @param difficulty - The difficulty level to filter by.
   * @returns An array of scenarios belonging to the specified difficulty.
   */
  public getScenarios(difficulty: BenchmarkDifficulty): BenchmarkScenario[] {
    return getScenariosByDifficulty(difficulty);
  }
}
