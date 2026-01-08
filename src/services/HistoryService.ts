/**
 * Responsibility: Manage and persist user highscores for scenarios using IndexedDB.
 */
export class HistoryService {
  private readonly _databaseName: string = "RawOutputHistory";

  private readonly _highscoreStoreName: string = "Highscores";

  private readonly _scoresStoreName: string = "Scores";

  private readonly _metadataStoreName: string = "Metadata";

  private readonly _databaseVersion: number = 3;

  private _db: IDBDatabase | null = null;

  private readonly _highscoreCallbacks: ((scenarioName?: string) => void)[] =
    [];

  /**
   * Registers a callback to be executed when a highscore is updated.
   *
   * @param callback - The function to invoke on updates.
   */
  public onHighscoreUpdated(callback: (scenarioName?: string) => void): void {
    this._highscoreCallbacks.push(callback);
  }

  /**
   * Returns the highscore for a specific scenario from persistent storage.
   *
   * @param scenarioName - The name of the Kovaak's scenario.
   * @returns A promise resolving to the numeric highscore.
   */
  public async getHighscore(scenarioName: string): Promise<number> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (
        resolve: (value: number) => void,
        reject: (reason: unknown) => void,
      ): void => {
        const transaction: IDBTransaction = database.transaction(
          this._highscoreStoreName,
          "readonly",
        );

        const store = transaction.objectStore(this._highscoreStoreName);

        const request: IDBRequest = store.get(scenarioName);

        request.onsuccess = (): void => resolve(request.result || 0);

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  /**
   * Updates the highscore for a scenario if the new score is higher.
   *
   * @param scenarioName - The name of the scenario.
   * @param score - The new score value.
   * @returns A promise resolving to true if a new highscore was achieved.
   */
  public async updateHighscore(
    scenarioName: string,
    score: number,
  ): Promise<boolean> {
    const currentHighscore = await this.getHighscore(scenarioName);

    if (score <= currentHighscore) {
      return false;
    }

    await this._persistHighscore(scenarioName, score);

    this._highscoreCallbacks.forEach(
      (callback: (scenarioName: string) => void): void =>
        callback(scenarioName),
    );

    return true;
  }

  private async _persistHighscore(
    scenarioName: string,
    score: number,
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          this._highscoreStoreName,
          "readwrite",
        );

        const store = transaction.objectStore(this._highscoreStoreName);

        const request: IDBRequest = store.put(score, scenarioName);

        request.onsuccess = (): void => resolve();

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  private async _getDatabase(): Promise<IDBDatabase> {
    if (this._db) {
      return this._db;
    }

    this._db = await this._initializeDatabase();

    return this._db;
  }

  private _initializeDatabase(): Promise<IDBDatabase> {
    return new Promise(
      (
        resolve: (value: IDBDatabase) => void,
        reject: (reason: unknown) => void,
      ): void => {
        const request: IDBOpenDBRequest = indexedDB.open(
          this._databaseName,
          this._databaseVersion,
        );

        request.onupgradeneeded = (): void => {
          this._handleDatabaseUpgrade(request.result);
        };

        request.onsuccess = (): void => resolve(request.result);

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  private _handleDatabaseUpgrade(database: IDBDatabase): void {
    if (!database.objectStoreNames.contains(this._highscoreStoreName)) {
      database.createObjectStore(this._highscoreStoreName);
    }

    if (!database.objectStoreNames.contains(this._scoresStoreName)) {
      const store = database.createObjectStore(this._scoresStoreName, {
        keyPath: "id",
        autoIncrement: true,
      });

      store.createIndex("scenarioName", "scenarioName", { unique: false });
    }

    if (!database.objectStoreNames.contains(this._metadataStoreName)) {
      database.createObjectStore(this._metadataStoreName);
    }
  }

  /**
   * Retrieves highscores for multiple scenarios at once.
   *
   * @param scenarioNames - Array of scenario names to query.
   * @returns A promise resolving to a map of scenario names to highscores.
   */
  public async getBatchHighscores(
    scenarioNames: string[],
  ): Promise<Record<string, number>> {
    const highscores: Record<string, number> = {};

    const promises: Promise<void>[] = scenarioNames.map(
      async (name: string): Promise<void> => {
        highscores[name] = await this.getHighscore(name);
      },
    );

    await Promise.all(promises);

    return highscores;
  }

  /**
   * Records a new score entry in the historical scores database.
   *
   * @param scenarioName - The name of the scenario.
   * @param score - The numeric score achieved.
   * @param timestamp - The time of the run.
   */
  public async recordScore(
    scenarioName: string,
    score: number,
    timestamp: number,
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          this._scoresStoreName,
          "readwrite",
        );

        const store = transaction.objectStore(this._scoresStoreName);

        const request: IDBRequest = store.add({
          scenarioName,
          score,
          timestamp,
        });

        request.onsuccess = (): void => resolve();

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  /**
   * Retrieves the most recent scores for a specific scenario.
   *
   * @param scenarioName - The name of the scenario.
   * @param limit - Maximum number of recent scores to return.
   * @returns A promise resolving to an array of scores.
   */
  public async getLastScores(
    scenarioName: string,
    limit: number = 100,
  ): Promise<number[]> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (
        resolve: (value: number[]) => void,
        reject: (reason: unknown) => void,
      ): void => {
        const transaction: IDBTransaction = database.transaction(
          this._scoresStoreName,
          "readonly",
        );

        const index: IDBIndex = transaction
          .objectStore(this._scoresStoreName)
          .index("scenarioName");

        const scores: number[] = [];

        const request: IDBRequest<IDBCursorWithValue | null> = index.openCursor(
          IDBKeyRange.only(scenarioName),
          "prev",
        );

        request.onsuccess = (event: Event): void =>
          this._processScoreCursor(event, scores, limit, resolve);

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  private _processScoreCursor(
    event: Event,
    scores: number[],
    limit: number,
    resolve: (value: number[]) => void,
  ): void {
    const cursor: IDBCursorWithValue | null = (
      event.target as IDBRequest<IDBCursorWithValue | null>
    ).result;

    if (cursor && scores.length < limit) {
      const entry: { score: number } = cursor.value as { score: number };

      scores.push(entry.score);

      cursor.continue();
    } else {
      resolve(scores);
    }
  }

  /**
   * Retrieves the timestamp of the last time statistics were ingested.
   *
   * @returns A promise resolving to the last check timestamp.
   */
  public async getLastCheckTimestamp(): Promise<number> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (
        resolve: (value: number) => void,
        reject: (reason: unknown) => void,
      ): void => {
        const transaction: IDBTransaction = database.transaction(
          this._metadataStoreName,
          "readonly",
        );

        const store = transaction.objectStore(this._metadataStoreName);

        const request: IDBRequest = store.get("lastCheck");

        request.onsuccess = (): void => resolve(request.result || 0);

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  /**
   * Persists the timestamp of the most recent statistics ingestion check.
   *
   * @param timestamp - The timestamp to record.
   */
  public async setLastCheckTimestamp(timestamp: number): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          this._metadataStoreName,
          "readwrite",
        );

        const store = transaction.objectStore(this._metadataStoreName);

        const request: IDBRequest = store.put(timestamp, "lastCheck");

        request.onsuccess = (): void => resolve();

        request.onerror = (): void => reject(request.error);
      },
    );
  }
}
