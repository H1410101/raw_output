const benchmarkFiles: Record<string, string> = import.meta.glob(
  "../../benchmarks/*.csv",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

/**
 * Represents a benchmark scenario and its associated metadata.
 */
export interface BenchmarkScenario {
  readonly category: string;
  readonly subcategory: string;
  readonly name: string;
  readonly thresholds: Record<string, number>;
}

/**
 * Dynamic type for difficulty tiers derived from file names.
 */
export type DifficultyTier = string;

function _parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let currentAccumulator: string = "";
  let isCurrentlyInQuotes: boolean = false;

  for (
    let characterIndex: number = 0;
    characterIndex < line.length;
    characterIndex++
  ) {
    const character: string = line[characterIndex];

    if (character === '"') {
      isCurrentlyInQuotes = !isCurrentlyInQuotes;
    } else if (character === "," && !isCurrentlyInQuotes) {
      result.push(currentAccumulator.trim());
      currentAccumulator = "";
    } else {
      currentAccumulator += character;
    }
  }

  result.push(currentAccumulator.trim());

  return result;
}

function _extractScenariosFromCsv(csvContent: string): BenchmarkScenario[] {
  const lines: string[] = csvContent
    .split(/\r?\n/)
    .filter((line: string): boolean => line.trim() !== "");

  if (lines.length <= 1) {
    return [];
  }

  const header: string[] = _parseCsvLine(lines[0]);

  const thresholdKeys: string[] = header.slice(3);

  return lines.slice(1).map((line: string): BenchmarkScenario => {
    return _parseScenarioRow(line, thresholdKeys);
  });
}

function _parseScenarioRow(
  line: string,
  thresholdKeys: string[],
): BenchmarkScenario {
  const columns: string[] = _parseCsvLine(line);

  return {
    category: columns[0] || "",
    subcategory: columns[1] || "",
    name: _cleanScenarioNameString(columns[2] || ""),
    thresholds: _extractThresholdValues(columns, thresholdKeys),
  };
}

function _cleanScenarioNameString(rawName: string): string {
  if (rawName.startsWith('"') && rawName.endsWith('"')) {
    return rawName.substring(1, rawName.length - 1);
  }

  return rawName;
}

function _extractThresholdValues(
  columns: string[],
  thresholdKeys: string[],
): Record<string, number> {
  const thresholds: Record<string, number> = {};

  thresholdKeys.forEach((key: string, index: number): void => {
    const value: number = parseFloat(columns[index + 3]);

    if (!isNaN(value)) {
      thresholds[key] = value;
    }
  });

  return thresholds;
}

const BENCHMARK_MAP: Record<DifficultyTier, BenchmarkScenario[]> =
  _initializeBenchmarkData();

function _initializeBenchmarkData(): Record<
  DifficultyTier,
  BenchmarkScenario[]
> {
  const map: Record<DifficultyTier, BenchmarkScenario[]> = {};

  const sortedFiles: [string, string][] = Object.entries(benchmarkFiles).sort(
    _compareBenchmarkFiles,
  );

  for (const [filePath, content] of sortedFiles) {
    const tierName: string | null = _extractTierNameFromFilePath(filePath);

    if (tierName !== null) {
      map[tierName] = _extractScenariosFromCsv(content);
    }
  }

  return map;
}

function _compareBenchmarkFiles(
  a: [string, string],
  b: [string, string],
): number {
  const nameA: string = _extractRawFileName(a[0]);
  const nameB: string = _extractRawFileName(b[0]);

  return nameA.localeCompare(nameB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function _extractRawFileName(filePath: string): string {
  return filePath.split("/").pop() || "";
}

function _extractTierNameFromFilePath(filePath: string): string | null {
  const fileName: string = _extractRawFileName(filePath).replace(".csv", "");

  const match: RegExpMatchArray | null = fileName.match(/^\d+\s+(.+)$/);

  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Retrieves the list of available difficulty tiers.
 *
 * @returns An array of strings representing the difficulty levels.
 */
export const getAvailableDifficulties = (): DifficultyTier[] => {
  return Object.keys(BENCHMARK_MAP);
};

/**
 * Retrieves the rank names available for a specific difficulty tier.
 *
 * @param difficulty - The difficulty tier to inspect.
 * @returns An array of rank names in ascending order of difficulty.
 */
export const getRankNamesForDifficulty = (
  difficulty: DifficultyTier,
): string[] => {
  const scenarios: BenchmarkScenario[] = BENCHMARK_MAP[difficulty] || [];

  if (scenarios.length === 0) {
    return [];
  }

  return Object.keys(scenarios[0].thresholds);
};

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

  return scenarios ? [...scenarios] : [];
};

/**
 * Identifies the difficulty of a scenario by checking the dynamic benchmark lists.
 *
 * @param scenarioName - The name of the Kovaak's scenario.
 * @returns The identified DifficultyTier or null.
 */
export const getDifficulty = (scenarioName: string): DifficultyTier | null => {
  const tiers: string[] = Object.keys(BENCHMARK_MAP);

  for (const tier of tiers) {
    if (
      BENCHMARK_MAP[tier].some(
        (scenario: BenchmarkScenario): boolean =>
          scenario.name === scenarioName,
      )
    ) {
      return tier;
    }
  }

  return null;
};
