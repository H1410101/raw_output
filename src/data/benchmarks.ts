/**
 * Dynamically imports all benchmark CSV files from the benchmarks directory.
 * Using Vite's glob import with 'as: "raw"' to get the file contents as strings.
 */
const benchmarkFiles = import.meta.glob("../../benchmarks/ranks_*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type BenchmarkDifficulty = "Easier" | "Medium" | "Hard";

/**
 * Parses a CSV line while respecting quoted strings that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Extracts scenario names from a raw CSV string.
 * Assumes the first column of every row (after the header) is the scenario name.
 */
function extractScenarios(csvContent: string): string[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) return [];

  // Skip header, map rows to first column
  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);
    let name = columns[0] || "";
    // Remove surrounding quotes if present
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.substring(1, name.length - 1);
    }
    return name;
  });
}

// Internal cache for benchmark lists derived from CSVs
const BENCHMARK_MAP: Record<BenchmarkDifficulty, string[]> = {
  Easier: [],
  Medium: [],
  Hard: [],
};

// Populate the map from imported files
for (const [path, content] of Object.entries(benchmarkFiles)) {
  const scenarios = extractScenarios(content);
  if (path.includes("easier")) {
    BENCHMARK_MAP.Easier = scenarios;
  } else if (path.includes("medium")) {
    BENCHMARK_MAP.Medium = scenarios;
  } else if (path.includes("hard")) {
    BENCHMARK_MAP.Hard = scenarios;
  }
}

/**
 * Identifies the difficulty of a scenario by checking the dynamic benchmark lists.
 * @param scenarioName The name of the Kovaak's scenario.
 * @returns BenchmarkDifficulty | null
 */
export const getDifficulty = (
  scenarioName: string,
): BenchmarkDifficulty | null => {
  if (BENCHMARK_MAP.Hard.includes(scenarioName)) return "Hard";
  if (BENCHMARK_MAP.Medium.includes(scenarioName)) return "Medium";
  if (BENCHMARK_MAP.Easier.includes(scenarioName)) return "Easier";
  return null;
};
