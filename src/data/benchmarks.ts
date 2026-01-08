/**
 * Dynamically imports all benchmark CSV files from the benchmarks directory.
 * Using Vite's glob import with 'as: "raw"' to get the file contents as strings.
 */
const benchmarkFiles = import.meta.glob("../../benchmarks/ranks_*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type DifficultyTier = "easier" | "medium" | "harder";

export interface BenchmarkScenario {
  category: string;
  subcategory: string;
  name: string;
  thresholds: Record<string, number>;
}

/**
 * Parses a CSV line while respecting quoted strings that may contain commas.
 *
 * @param line - The raw CSV line string.
 * @returns An array of parsed string columns.
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
 * Extracts scenario data from a raw CSV string.
 *
 * @param csvContent - The raw content of the CSV file.
 * @returns An array of BenchmarkScenario objects.
 */
function extractScenarios(csvContent: string): BenchmarkScenario[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length <= 1) return [];

  const header = parseCsvLine(lines[0]);

  const thresholdKeys = header.slice(3);

  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);

    const category = columns[0] || "";

    const subcategory = columns[1] || "";

    let name = columns[2] || "";

    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.substring(1, name.length - 1);
    }

    const thresholds: Record<string, number> = {};

    thresholdKeys.forEach((key, index) => {
      const value = parseFloat(columns[index + 3]);

      if (!isNaN(value)) {
        thresholds[key] = value;
      }
    });

    return {
      category,
      subcategory,
      name,
      thresholds,
    };
  });
}

// Internal cache for benchmark lists derived from CSVs
const BENCHMARK_MAP: Record<DifficultyTier, BenchmarkScenario[]> = {
  easier: [],
  medium: [],
  harder: [],
};

// Populate the map from imported files
for (const [path, content] of Object.entries(benchmarkFiles)) {
  const scenarios = extractScenarios(content);
  if (path.includes("easier")) {
    BENCHMARK_MAP.easier = scenarios;
  } else if (path.includes("medium")) {
    BENCHMARK_MAP.medium = scenarios;
  } else if (path.includes("hard")) {
    BENCHMARK_MAP.harder = scenarios;
  }
}

/**
 * Retrieves the list of scenarios for a specific difficulty level.
 *
 * @param difficulty - The benchmark difficulty level.
 * @returns An array of BenchmarkScenario objects.
 */
export const getScenariosByDifficulty = (
  difficulty: DifficultyTier,
): BenchmarkScenario[] => {
  const scenarios: BenchmarkScenario[] | undefined = BENCHMARK_MAP[difficulty];

  if (!scenarios) {
    return [];
  }

  return [...scenarios];
};

/**
 * Identifies the difficulty of a scenario by checking the dynamic benchmark lists.
 *
 * @param scenarioName - The name of the Kovaak's scenario.
 * @returns The identified DifficultyTier or null.
 */
export const getDifficulty = (scenarioName: string): DifficultyTier | null => {
  if (
    BENCHMARK_MAP.harder.some(
      (scenario: BenchmarkScenario): boolean => scenario.name === scenarioName,
    )
  ) {
    return "harder";
  }

  if (
    BENCHMARK_MAP.medium.some(
      (scenario: BenchmarkScenario): boolean => scenario.name === scenarioName,
    )
  ) {
    return "medium";
  }

  if (
    BENCHMARK_MAP.easier.some(
      (scenario: BenchmarkScenario): boolean => scenario.name === scenarioName,
    )
  ) {
    return "easier";
  }

  return null;
};
