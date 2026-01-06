import { getDifficulty, BenchmarkDifficulty } from "../data/benchmarks";

export class BenchmarkService {
  /**
   * Determines the difficulty level of a scenario based on Viscose Benchmark rules.
   * @param scenarioName The name of the scenario.
   * @returns BenchmarkDifficulty | null
   */
  public getDifficulty(scenarioName: string): BenchmarkDifficulty | null {
    return getDifficulty(scenarioName);
  }
}
