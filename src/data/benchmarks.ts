const benchmarkFiles: Record<string, string> = import.meta.glob(
  "../../benchmarks/ranks_*.csv",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

export type DifficultyTier = "easier" | "medium" | "harder";

export interface BenchmarkScenario {
  readonly category: string;
  readonly subcategory: string;
  readonly name: string;
  readonly thresholds: Record<string, number>;
}

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
  const map: Record<DifficultyTier, BenchmarkScenario[]> = {
    easier: [],
    medium: [],
    harder: [],
  };

  for (const [filePath, content] of Object.entries(benchmarkFiles)) {
    const scenarios: BenchmarkScenario[] = _extractScenariosFromCsv(content);

    _populateTierInMap(map, filePath, scenarios);
  }

  return map;
}

function _populateTierInMap(
  map: Record<DifficultyTier, BenchmarkScenario[]>,
  filePath: string,
  scenarios: BenchmarkScenario[],
): void {
  if (filePath.includes("easier")) {
    map.easier = scenarios;
  } else if (filePath.includes("medium")) {
    map.medium = scenarios;
  } else if (filePath.includes("hard")) {
    map.harder = scenarios;
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
  if (_isScenarioInDifficultyTier(scenarioName, "harder")) {
    return "harder";
  }

  if (_isScenarioInDifficultyTier(scenarioName, "medium")) {
    return "medium";
  }

  if (_isScenarioInDifficultyTier(scenarioName, "easier")) {
    return "easier";
  }

  return null;
};

function _isScenarioInDifficultyTier(
  scenarioName: string,
  tier: DifficultyTier,
): boolean {
  return BENCHMARK_MAP[tier].some(
    (scenario: BenchmarkScenario): boolean => scenario.name === scenarioName,
  );
}
