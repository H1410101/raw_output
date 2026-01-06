import { KovaaksChallengeRun } from "../types/kovaaks";
import { BenchmarkService } from "./BenchmarkService";
import { DirectoryAccessService } from "./DirectoryAccessService";
import { HistoryService } from "./HistoryService";
import { KovaaksCsvParsingService } from "./KovaaksCsvParsingService";
import { SessionService } from "./SessionService";

interface FileHandleWithDate {
  handle: FileSystemFileHandle;
  date: Date;
}

/**
 * Responsibility: Orchestrate the ingestion of CSV files from the stats folder.
 * This service implements lazy session detection and efficient highscore scanning.
 */
export class RunIngestionService {
  private readonly _directoryService: DirectoryAccessService;

  private readonly _csvService: KovaaksCsvParsingService;

  private readonly _historyService: HistoryService;

  private readonly _sessionService: SessionService;

  private readonly _benchmarkService: BenchmarkService;

  private readonly _sessionGapMilliseconds: number = 10 * 60 * 1000;

  private readonly _appStartTime: number;

  constructor(
    directoryService: DirectoryAccessService,
    csvService: KovaaksCsvParsingService,
    historyService: HistoryService,
    sessionService: SessionService,
    benchmarkService: BenchmarkService,
  ) {
    this._directoryService = directoryService;
    this._csvService = csvService;
    this._historyService = historyService;
    this._sessionService = sessionService;
    this._benchmarkService = benchmarkService;
    this._appStartTime = Date.now();
  }

  /**
   * Performs a comprehensive sync:
   * 1. Scans all new files since the last check for highscores.
   * 2. Identifies and populates the latest contiguous session.
   * 3. Returns the most recent runs for display.
   */
  public async synchronizeAvailableRuns(): Promise<KovaaksChallengeRun[]> {
    const allHandles = await this._directoryService.getDirectoryFiles();

    const csvHandlesWithDates = this._mapAndSortHandlesByDate(allHandles);

    if (csvHandlesWithDates.length === 0) {
      return [];
    }

    await this._updateHighscoresForNewRuns(csvHandlesWithDates);

    await this._rebuildLatestSession(csvHandlesWithDates);

    await this._updateLastCheckTimestamp(csvHandlesWithDates);

    return this._parseLatestRunsForDisplay(csvHandlesWithDates);
  }

  /**
   * Returns runs that are either part of the current session or were completed after the app started.
   */
  public async getNewRuns(): Promise<KovaaksChallengeRun[]> {
    const allHandles = await this._directoryService.getDirectoryFiles();

    const csvHandlesWithDates = this._mapAndSortHandlesByDate(allHandles);

    if (csvHandlesWithDates.length === 0) {
      return [];
    }

    const sessionItems = this._identifyLatestSessionItems(csvHandlesWithDates);

    const sessionTimestamps = new Set(
      sessionItems.map((item) => item.date.getTime()),
    );

    const filteredHandles = csvHandlesWithDates.filter(
      (item) =>
        item.date.getTime() >= this._appStartTime ||
        sessionTimestamps.has(item.date.getTime()),
    );

    return this._parseRunsFromHandles(filteredHandles);
  }

  private _mapAndSortHandlesByDate(
    handles: FileSystemFileHandle[],
  ): FileHandleWithDate[] {
    return handles
      .filter((handle) => handle.name.toLowerCase().endsWith(".csv"))
      .map((handle) => ({
        handle,
        date: this._csvService.extractDateFromFilename(handle.name),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private async _updateHighscoresForNewRuns(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    const lastCheck = await this._historyService.getLastCheckTimestamp();

    const newHandles = sortedHandles.filter(
      (item) => item.date.getTime() > lastCheck,
    );

    for (const item of newHandles) {
      const run = await this._parseRunFromFile(item.handle);

      if (run && run.scenarioName && run.score !== undefined) {
        await this._historyService.updateHighscore(run.scenarioName, run.score);
      }
    }
  }

  private async _rebuildLatestSession(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    const sessionItems = this._identifyLatestSessionItems(sortedHandles);

    this._sessionService.resetSession();

    const runsToRegister = await this._parseSessionRuns(sessionItems);

    this._sessionService.registerMultipleRuns(runsToRegister);
  }

  private async _parseSessionRuns(sessionItems: FileHandleWithDate[]): Promise<
    {
      scenarioName: string;
      score: number;
      scenario: import("../data/benchmarks").BenchmarkScenario | null;
      difficulty: string | null;
      timestamp: Date;
    }[]
  > {
    const runsToRegister = [];

    for (const item of [...sessionItems].reverse()) {
      const run = await this._parseRunFromFile(item.handle);

      if (run && run.scenarioName && run.score !== undefined) {
        runsToRegister.push(this._createSessionRunRecord(run));
      }
    }

    return runsToRegister;
  }

  private _createSessionRunRecord(run: Partial<KovaaksChallengeRun>): {
    scenarioName: string;
    score: number;
    scenario: import("../data/benchmarks").BenchmarkScenario | null;
    difficulty: string | null;
    timestamp: Date;
  } {
    const difficulty = this._benchmarkService.getDifficulty(run.scenarioName!);

    const scenario = this._benchmarkService
      .getScenarios(difficulty || "Easier")
      .find((s) => s.name === run.scenarioName);

    return {
      scenarioName: run.scenarioName!,
      score: run.score!,
      scenario: scenario || null,
      difficulty,
      timestamp: run.completionDate || new Date(),
    };
  }

  private _identifyLatestSessionItems(
    sortedHandles: FileHandleWithDate[],
  ): FileHandleWithDate[] {
    const sessionItems: FileHandleWithDate[] = [];

    if (sortedHandles.length === 0) {
      return sessionItems;
    }

    sessionItems.push(sortedHandles[0]);

    for (let i = 1; i < sortedHandles.length; i++) {
      const current = sortedHandles[i];

      const previous = sortedHandles[i - 1];

      const gap = previous.date.getTime() - current.date.getTime();

      if (gap > this._sessionGapMilliseconds) {
        break;
      }

      sessionItems.push(current);
    }

    return sessionItems;
  }

  private async _parseLatestRunsForDisplay(
    sortedHandles: FileHandleWithDate[],
  ): Promise<KovaaksChallengeRun[]> {
    const displayCount = 10;

    const latestHandles = sortedHandles.slice(0, displayCount);

    return this._parseRunsFromHandles(latestHandles);
  }

  private async _parseRunsFromHandles(
    handles: FileHandleWithDate[],
  ): Promise<KovaaksChallengeRun[]> {
    const runs: KovaaksChallengeRun[] = [];

    for (const item of handles) {
      const run = await this._parseRunFromFile(item.handle);

      if (
        run &&
        run.scenarioName &&
        run.score !== undefined &&
        run.completionDate
      ) {
        runs.push({
          id: crypto.randomUUID(),
          scenarioName: run.scenarioName,
          score: run.score,
          completionDate: run.completionDate,
          difficulty: this._benchmarkService.getDifficulty(run.scenarioName),
        });
      }
    }

    return runs;
  }

  private async _parseRunFromFile(
    handle: FileSystemFileHandle,
  ): Promise<Partial<KovaaksChallengeRun> | null> {
    try {
      const file = await handle.getFile();

      const content = await file.text();

      return this._csvService.parseKovaakCsv(content, handle.name);
    } catch (error) {
      console.error(`Failed to parse file: ${handle.name}`, error);

      return null;
    }
  }

  private async _updateLastCheckTimestamp(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    if (sortedHandles.length > 0) {
      const latestTimestamp = sortedHandles[0].date.getTime();

      await this._historyService.setLastCheckTimestamp(latestTimestamp);
    }
  }
}
