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

  private readonly _parsedRunsCache: Map<string, KovaaksChallengeRun> =
    new Map();

  private _lastKnownHandlesWithDates: FileHandleWithDate[] = [];

  private _lastScanTimestamp: number = 0;

  /**
   * Initializes the ingestion service with required processing and storage dependencies.
   *
   * @param services - Collection of services for file access, parsing, and history.
   * @param services.directoryService - Service for directory access.
   * @param services.csvService - Service for CSV parsing.
   * @param services.historyService - Service for history persistence.
   * @param services.sessionService - Service for session management.
   * @param services.benchmarkService - Service for benchmark data.
   */
  public constructor(services: {
    directoryService: DirectoryAccessService;
    csvService: KovaaksCsvParsingService;
    historyService: HistoryService;
    sessionService: SessionService;
    benchmarkService: BenchmarkService;
  }) {
    this._directoryService = services.directoryService;
    this._csvService = services.csvService;
    this._historyService = services.historyService;
    this._sessionService = services.sessionService;
    this._benchmarkService = services.benchmarkService;
  }

  /**
   * Performs a comprehensive sync:
   * 1. Scans all new files since the last check for highscores.
   * 2. Identifies and populates the latest contiguous session.
   * 3. Returns the most recent runs for display.
   *
   * @returns A promise resolving to the list of synchronized runs.
   */
  public async synchronizeAvailableRuns(): Promise<KovaaksChallengeRun[]> {
    const csvHandlesWithDates: FileHandleWithDate[] =
      await this._getOrFetchHandles();

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
   *
   * @returns A promise resolving to the list of new runs.
   */
  public async getNewRuns(): Promise<KovaaksChallengeRun[]> {
    const csvHandlesWithDates: FileHandleWithDate[] =
      await this._getOrFetchHandles();

    if (csvHandlesWithDates.length === 0) {
      return [];
    }

    const sessionItems: FileHandleWithDate[] =
      this._identifyLatestSessionItems(csvHandlesWithDates);

    return this._parseRunsFromHandles(sessionItems);
  }

  private async _getOrFetchHandles(): Promise<FileHandleWithDate[]> {
    const now: number = Date.now();

    const isCacheValid: boolean =
      now - this._lastScanTimestamp < 1000 &&
      this._lastKnownHandlesWithDates.length > 0;

    if (isCacheValid) {
      return this._lastKnownHandlesWithDates;
    }

    return this._refreshHandleCache(now);
  }

  private async _refreshHandleCache(
    now: number,
  ): Promise<FileHandleWithDate[]> {
    const allHandles: FileSystemFileHandle[] =
      await this._directoryService.getDirectoryFiles();

    this._lastKnownHandlesWithDates = this._mapAndSortHandlesByDate(allHandles);

    this._lastScanTimestamp = now;

    return this._lastKnownHandlesWithDates;
  }

  private _mapAndSortHandlesByDate(
    handles: FileSystemFileHandle[],
  ): FileHandleWithDate[] {
    return handles
      .filter((handle: FileSystemFileHandle): boolean =>
        handle.name.toLowerCase().endsWith(".csv"),
      )
      .map((handle: FileSystemFileHandle) => ({
        handle,
        date: this._csvService.extractDateFromFilename(handle.name),
      }))
      .sort((a, b): number => b.date.getTime() - a.date.getTime());
  }

  private async _updateHighscoresForNewRuns(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    const lastCheck: number =
      await this._historyService.getLastCheckTimestamp();

    const newHandles: FileHandleWithDate[] = sortedHandles
      .filter((item): boolean => item.date.getTime() > lastCheck)
      .reverse();

    await this._processHighscoreBatches(newHandles);
  }

  private async _processHighscoreBatches(
    handles: FileHandleWithDate[],
  ): Promise<void> {
    const batchSize: number = 50;

    for (let i: number = 0; i < handles.length; i += batchSize) {
      const batch: FileHandleWithDate[] = handles.slice(i, i + batchSize);

      await Promise.all(
        batch.map(
          (item: FileHandleWithDate): Promise<void> =>
            this._ingestHighscoreFile(item),
        ),
      );
    }
  }

  private async _ingestHighscoreFile(item: FileHandleWithDate): Promise<void> {
    const run: KovaaksChallengeRun | null = await this._parseRunFromFile(
      item.handle,
    );

    if (run) {
      await this._historyService.recordScore(
        run.scenarioName,
        run.score,
        run.completionDate.getTime(),
      );

      await this._historyService.updateHighscore(run.scenarioName, run.score);
    }
  }

  private async _rebuildLatestSession(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    const sessionItems = this._identifyLatestSessionItems(sortedHandles);

    this._sessionService.resetSession(true);

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
    const runs: (KovaaksChallengeRun | null)[] = await Promise.all(
      [...sessionItems]
        .reverse()
        .map(
          (item: FileHandleWithDate): Promise<KovaaksChallengeRun | null> =>
            this._parseRunFromFile(item.handle),
        ),
    );

    return runs
      .filter(
        (run: KovaaksChallengeRun | null): run is KovaaksChallengeRun =>
          run !== null,
      )
      .map((run: KovaaksChallengeRun) => this._createSessionRunRecord(run));
  }

  private _createSessionRunRecord(run: KovaaksChallengeRun): {
    scenarioName: string;
    score: number;
    scenario: import("../data/benchmarks").BenchmarkScenario | null;
    difficulty: string | null;
    timestamp: Date;
  } {
    const difficulty = this._benchmarkService.getDifficulty(run.scenarioName);

    const scenario = this._benchmarkService
      .getScenarios(difficulty || "easier")
      .find(
        (benchmarkScenario: import("../data/benchmarks").BenchmarkScenario) =>
          benchmarkScenario.name === run.scenarioName,
      );

    return {
      scenarioName: run.scenarioName,
      score: run.score,
      scenario: scenario || null,
      difficulty,
      timestamp: run.completionDate,
    };
  }

  private _identifyLatestSessionItems(
    sortedHandles: FileHandleWithDate[],
  ): FileHandleWithDate[] {
    if (
      sortedHandles.length === 0 ||
      this._isMostRecentRunExpired(sortedHandles[0])
    ) {
      return [];
    }

    return this._collectContiguousSessionItems(sortedHandles);
  }

  private _isMostRecentRunExpired(mostRecent: FileHandleWithDate): boolean {
    const elapsed: number = Date.now() - mostRecent.date.getTime();

    return elapsed > this._sessionService.sessionTimeoutMilliseconds;
  }

  private _collectContiguousSessionItems(
    sortedHandles: FileHandleWithDate[],
  ): FileHandleWithDate[] {
    const sessionItems: FileHandleWithDate[] = [sortedHandles[0]];

    for (let i: number = 1; i < sortedHandles.length; i++) {
      const gap: number =
        sortedHandles[i - 1].date.getTime() - sortedHandles[i].date.getTime();

      if (gap > this._sessionService.sessionTimeoutMilliseconds) {
        break;
      }

      sessionItems.push(sortedHandles[i]);
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
    const runs: (KovaaksChallengeRun | null)[] = await Promise.all(
      handles.map(
        (item: FileHandleWithDate): Promise<KovaaksChallengeRun | null> =>
          this._parseRunFromFile(item.handle),
      ),
    );

    return runs.filter(
      (run: KovaaksChallengeRun | null): run is KovaaksChallengeRun =>
        run !== null,
    );
  }

  private async _parseRunFromFile(
    handle: FileSystemFileHandle,
  ): Promise<KovaaksChallengeRun | null> {
    const cachedRun: KovaaksChallengeRun | undefined =
      this._parsedRunsCache.get(handle.name);

    if (cachedRun) {
      return cachedRun;
    }

    const run: KovaaksChallengeRun | null =
      await this._performFileParsing(handle);

    if (run) {
      this._parsedRunsCache.set(handle.name, run);
    }

    return run;
  }

  private async _performFileParsing(
    handle: FileSystemFileHandle,
  ): Promise<KovaaksChallengeRun | null> {
    try {
      const file: File = await handle.getFile();

      const content: string = await file.text();

      const parsed: Partial<KovaaksChallengeRun> | null =
        this._csvService.parseKovaakCsv(content, handle.name);

      return this._validateAndMapParsedRun(parsed);
    } catch (error: unknown) {
      console.error(`Failed to parse file: ${handle.name}`, error);

      return null;
    }
  }

  private _validateAndMapParsedRun(
    parsed: Partial<KovaaksChallengeRun> | null,
  ): KovaaksChallengeRun | null {
    if (!this._isValidRun(parsed)) {
      return null;
    }

    return this._createRunFromParsed(parsed!);
  }

  private _isValidRun(
    parsed: Partial<KovaaksChallengeRun> | null,
  ): parsed is Required<
    Pick<KovaaksChallengeRun, "scenarioName" | "score" | "completionDate">
  > {
    return !!(
      parsed?.scenarioName &&
      parsed.score !== undefined &&
      parsed.completionDate
    );
  }

  private _createRunFromParsed(
    parsed: Partial<KovaaksChallengeRun>,
  ): KovaaksChallengeRun {
    return {
      runId: crypto.randomUUID(),
      scenarioName: parsed.scenarioName!,
      score: parsed.score!,
      completionDate: parsed.completionDate!,
      difficulty: this._mapToLegacyDifficulty(
        this._benchmarkService.getDifficulty(parsed.scenarioName!),
      ),
    };
  }

  private _mapToLegacyDifficulty(
    difficulty: import("../data/benchmarks").DifficultyTier | null,
  ): "Easier" | "Medium" | "Harder" | null {
    if (!difficulty) {
      return null;
    }

    const map: Record<string, "Easier" | "Medium" | "Harder"> = {
      easier: "Easier",
      medium: "Medium",
      harder: "Harder",
    };

    return map[difficulty];
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
