import { KovaaksChallengeRun } from "../types/kovaaks";
import { BenchmarkService } from "./BenchmarkService";
import { DirectoryAccessService } from "./DirectoryAccessService";
import { HistoryService } from "./HistoryService";
import { KovaaksCsvParsingService } from "./KovaaksCsvParsingService";
import { SessionService } from "./SessionService";
import { BenchmarkScenario } from "../data/benchmarks";

interface FileHandleWithDate {
  handle: FileSystemFileHandle;
  date: Date;
}

/**
 * Responsibility: Orchestrate the ingestion of CSV files from the stats folder.
 *
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
   * Performs a comprehensive sync of the linked directory.
   *
   * 1. Scans all new files since the last check for highscores.
   * 2. Identifies and populates the latest contiguous session.
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

    await this._updateLastCheckTimestamp(csvHandlesWithDates);

    return this._parseLatestRuns(csvHandlesWithDates);
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

      const parsedRuns: (KovaaksChallengeRun | null)[] = await Promise.all(
        batch.map(
          (item: FileHandleWithDate): Promise<KovaaksChallengeRun | null> =>
            this._parseRunFromFile(item.handle),
        ),
      );

      const validRuns: KovaaksChallengeRun[] = parsedRuns.filter(
        (run: KovaaksChallengeRun | null): run is KovaaksChallengeRun =>
          run !== null,
      );

      await this._persistRunsInBatch(validRuns);
    }
  }

  private async _persistRunsInBatch(runs: KovaaksChallengeRun[]): Promise<void> {
    if (runs.length === 0) {
      return;
    }

    const scoresToRecord = runs.map((run) => ({
      scenarioName: run.scenarioName,
      score: run.score,
      timestamp: run.completionDate.getTime(),
    }));

    const highscoresToUpdate = runs.map((run) => ({
      scenarioName: run.scenarioName,
      score: run.score,
    }));

    await this._historyService.recordMultipleScores(scoresToRecord);

    await this._historyService.updateMultipleHighscores(highscoresToUpdate);

    const sessionRuns = runs.map((run) => this._createSessionRunRecord(run));

    this._sessionService.registerMultipleRuns(sessionRuns);
  }


  private _createSessionRunRecord(run: KovaaksChallengeRun): {
    scenarioName: string;
    score: number;
    scenario: BenchmarkScenario | null;
    difficulty: string | null;
    timestamp: Date;
  } {
    const difficulty: string | null = this._benchmarkService.getDifficulty(
      run.scenarioName,
    );

    const scenario: BenchmarkScenario | undefined = difficulty
      ? this._benchmarkService
        .getScenarios(difficulty)
        .find(
          (benchmarkScenario: BenchmarkScenario) =>
            benchmarkScenario.name === run.scenarioName,
        )
      : undefined;

    return {
      scenarioName: run.scenarioName,
      score: run.score,
      scenario: scenario || null,
      difficulty,
      timestamp: run.completionDate,
    };
  }

  private async _parseLatestRuns(
    sortedHandles: FileHandleWithDate[],
  ): Promise<KovaaksChallengeRun[]> {
    const displayCount: number = 10;

    const latestHandles: FileHandleWithDate[] = sortedHandles.slice(
      0,
      displayCount,
    );

    const runs: (KovaaksChallengeRun | null)[] = await Promise.all(
      latestHandles.map(
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

      if (
        !parsed?.scenarioName ||
        parsed.score === undefined ||
        !parsed.completionDate
      ) {
        return null;
      }

      return {
        runId: crypto.randomUUID(),
        scenarioName: parsed.scenarioName,
        score: parsed.score,
        completionDate: parsed.completionDate,
        difficulty: this._benchmarkService.getDifficulty(parsed.scenarioName),
      };
    } catch (error: unknown) {
      console.error(`Failed to parse file: ${handle.name}`, error);

      return null;
    }
  }

  private async _updateLastCheckTimestamp(
    sortedHandles: FileHandleWithDate[],
  ): Promise<void> {
    if (sortedHandles.length > 0) {
      const latestTimestamp: number = sortedHandles[0].date.getTime();

      await this._historyService.setLastCheckTimestamp(latestTimestamp);
    }
  }
}
