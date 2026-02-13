/**
 * Responsibility: Manage and persist user highscores for scenarios using IndexedDB.
 */
export class HistoryService {
  private readonly _databaseName: string = "RawOutputHistory";

  private readonly _highscoreStoreName: string = "Highscores";

  private readonly _scoresStoreName: string = "Scores";

  private readonly _metadataStoreName: string = "Metadata";

  private readonly _databaseVersion: number = 4;

  private _db: IDBDatabase | null = null;

  private readonly _highscoreCallbacks: ((scenarioName?: string) => void)[] =
    [];

  private readonly _scoreRecordedCallbacks: ((scenarioName: string) => void)[] =
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
   * Registers a callback to be executed when any new score is recorded.
   *
   * @param callback - The function to invoke on new score records.
   */
  public onScoreRecorded(callback: (scenarioName: string) => void): void {
    this._scoreRecordedCallbacks.push(callback);
  }

  /**
   * Returns the highscore for a specific scenario from persistent storage.
   *
   * @param username - The username to query for.
   * @param scenarioName - The name of the Kovaak's scenario.
   * @returns A promise resolving to the numeric highscore.
   */
  public async getHighscore(
    username: string,
    scenarioName: string,
  ): Promise<number> {
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

        // We use a composite key of [username, scenarioName]
        const request: IDBRequest = store.get([username, scenarioName]);

        request.onsuccess = (): void => {
          const result = request.result as { score: number } | undefined;
          resolve(result?.score || 0);
        };

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  /**
   * Updates the highscore for a scenario if the new score is higher.
   *
   * @param username - The username to update for.
   * @param scenarioName - The name of the scenario.
   * @param score - The new score value.
   * @returns A promise resolving to true if a new highscore was achieved.
   */
  public async updateHighscore(
    username: string,
    scenarioName: string,
    score: number,
  ): Promise<boolean> {
    const currentHighscore = await this.getHighscore(username, scenarioName);

    if (score <= currentHighscore) {
      return false;
    }

    await this._persistHighscore(username, scenarioName, score);

    this._highscoreCallbacks.forEach(
      (callback: (scenarioName: string) => void): void =>
        callback(scenarioName),
    );

    return true;
  }

  private async _persistHighscore(
    username: string,
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

        const request: IDBRequest = store.put({
          username,
          scenarioName,
          score
        });

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
    if (database.objectStoreNames.contains(this._highscoreStoreName)) {
      database.deleteObjectStore(this._highscoreStoreName);
    }

    const highscoreStore = database.createObjectStore(this._highscoreStoreName, {
      keyPath: ["username", "scenarioName"],
    });
    // Create an index for efficiently querying all highscores for a user if needed in future
    highscoreStore.createIndex("username", "username", { unique: false });


    if (database.objectStoreNames.contains(this._scoresStoreName)) {
      // If we are upgrading from v3 to v4, we need to add username to scores
      // For simplicity in this dev environment, we will recreate the store to ensure clean schema
      // In production, we would migrate data.
      database.deleteObjectStore(this._scoresStoreName);
    }

    const scoreStore = database.createObjectStore(this._scoresStoreName, {
      keyPath: "id",
      autoIncrement: true,
    });

    scoreStore.createIndex("scenarioName", "scenarioName", { unique: false });
    scoreStore.createIndex("username", "username", { unique: false });
    scoreStore.createIndex("username_scenario", ["username", "scenarioName"], { unique: false });


    if (!database.objectStoreNames.contains(this._metadataStoreName)) {
      database.createObjectStore(this._metadataStoreName);
    }
  }

  /**
   * Retrieves highscores for multiple scenarios at once using a single transaction.
   *
   * @param username - The username to query for.
   * @param scenarioNames - Array of scenario names to query.
   * @returns A promise resolving to a map of scenario names to highscores.
   */
  public async getBatchHighscores(
    username: string,
    scenarioNames: string[],
  ): Promise<Record<string, number>> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (
        resolve: (value: Record<string, number>) => void,
        reject: (reason: unknown) => void,
      ): void =>
        this._executeBatchHighscoreFetch(
          database,
          username,
          scenarioNames,
          resolve,
          reject,
        ),
    );
  }

  // eslint-disable-next-line max-params
  private _executeBatchHighscoreFetch(
    database: IDBDatabase,
    username: string,
    scenarioNames: string[],
    resolve: (value: Record<string, number>) => void,
    reject: (reason: unknown) => void,
  ): void {
    const transaction: IDBTransaction = database.transaction(
      this._highscoreStoreName,
      "readonly",
    );

    const store: IDBObjectStore = transaction.objectStore(
      this._highscoreStoreName,
    );

    const highscores: Record<string, number> = {};

    if (scenarioNames.length === 0) {
      resolve(highscores);

      return;
    }

    this._fetchHighscoresInTransaction({
      store,
      username,
      scenarioNames,
      highscores,
      resolve,
      reject,
    });
  }

  private _fetchHighscoresInTransaction(options: {
    store: IDBObjectStore;
    username: string;
    scenarioNames: string[];
    highscores: Record<string, number>;
    resolve: (value: Record<string, number>) => void;
    reject: (reason: unknown) => void;
  }): void {
    const { store, username, scenarioNames, highscores, resolve, reject } = options;

    let pendingCount: number = scenarioNames.length;

    scenarioNames.forEach((name: string): void => {
      const request: IDBRequest = store.get([username, name]);

      request.onsuccess = (): void => {
        const result = request.result as { score: number } | undefined;
        highscores[name] = result?.score || 0;

        pendingCount--;

        if (pendingCount === 0) {
          resolve(highscores);
        }
      };

      request.onerror = (): void => reject(request.error);
    });
  }

  /**
   * Records multiple score entries in a single transaction.
   *
   * @param username - The username to record for.
   * @param scores - Array of score data to persist.
   * @returns A promise resolving when persistence is complete.
   */
  public async recordMultipleScores(
    username: string,
    scores: { scenarioName: string; score: number; timestamp: number }[],
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void =>
        this._executeBatchScoreRecording(database, username, scores, { resolve, reject }),
    );
  }

  private _executeBatchScoreRecording(
    database: IDBDatabase,
    username: string,
    scores: { scenarioName: string; score: number; timestamp: number }[],
    callbacks: { resolve: () => void; reject: (reason: unknown) => void },
  ): void {
    const transaction: IDBTransaction = database.transaction(
      this._scoresStoreName,
      "readwrite",
    );

    const store: IDBObjectStore = transaction.objectStore(
      this._scoresStoreName,
    );

    scores.forEach((scoreRecord): void => {
      store.add({
        username,
        scenarioName: scoreRecord.scenarioName,
        score: scoreRecord.score,
        timestamp: scoreRecord.timestamp,
      });
    });

    transaction.oncomplete = (): void => {
      this._notifyScoreRecorded(scores);

      callbacks.resolve();
    };

    transaction.onerror = (): void => callbacks.reject(transaction.error);
  }

  private _notifyScoreRecorded(
    scores: { scenarioName: string; score: number; timestamp: number }[],
  ): void {
    scores.forEach((scoreRecord): void => {
      this._scoreRecordedCallbacks.forEach(
        (callback: (scenarioName: string) => void): void =>
          callback(scoreRecord.scenarioName),
      );
    });
  }

  /**
   * Updates highscores for multiple scenarios if new scores are higher, using a single transaction.
   *
   * @param username - The username to query for.
   * @param updates - Array of scenario names and scores to check.
   * @returns A promise resolving when update checks are complete.
   */
  public async updateMultipleHighscores(
    username: string,
    updates: { scenarioName: string; score: number }[],
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    const maxScoresPerScenario: Map<string, number> =
      this._deduplicateUpdates(updates);

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void =>
        this._executeBatchHighscoreUpdate(
          database,
          username,
          maxScoresPerScenario,
          resolve,
          reject,
        ),
    );
  }

  private _deduplicateUpdates(
    updates: { scenarioName: string; score: number }[],
  ): Map<string, number> {
    const maxScoresPerScenario: Map<string, number> = new Map();

    updates.forEach((update): void => {
      const currentVal: number =
        maxScoresPerScenario.get(update.scenarioName) || 0;

      if (update.score > currentVal) {
        maxScoresPerScenario.set(update.scenarioName, update.score);
      }
    });

    return maxScoresPerScenario;
  }

  // eslint-disable-next-line max-lines-per-function, max-params
  private _executeBatchHighscoreUpdate(
    database: IDBDatabase,
    username: string,
    maxScoresPerScenario: Map<string, number>,
    resolve: () => void,
    reject: (reason: unknown) => void,
  ): void {
    const transaction: IDBTransaction = database.transaction(
      this._highscoreStoreName,
      "readwrite",
    );

    const store: IDBObjectStore = transaction.objectStore(
      this._highscoreStoreName,
    );

    const scenariosToNotify: Set<string> = new Set();

    maxScoresPerScenario.forEach((score: number, scenario: string): void => {
      const getRequest: IDBRequest = store.get([username, scenario]);

      getRequest.onsuccess = (): void => {
        const result = getRequest.result as { score: number } | undefined;
        const currentHighscore: number = result?.score || 0;

        if (score > currentHighscore) {
          store.put({
            username,
            scenarioName: scenario,
            score,
          });

          scenariosToNotify.add(scenario);
        }
      };
    });

    transaction.oncomplete = (): void => {
      this._notifyHighscoresUpdated(scenariosToNotify);

      resolve();
    };

    transaction.onerror = (): void => reject(transaction.error);
  }

  private _notifyHighscoresUpdated(scenariosToNotify: Set<string>): void {
    scenariosToNotify.forEach((scenario: string): void => {
      this._highscoreCallbacks.forEach(
        (callback: (scenarioName: string) => void): void => callback(scenario),
      );
    });
  }

  /**
   * Records a new score entry in the historical scores database.
   *
   * @param username - The username to record for.
   * @param scenarioName - The name of the scenario.
   * @param score - The numeric score achieved.
   * @param timestamp - The time of the run.
   */
  // eslint-disable-next-line max-lines-per-function
  public async recordScore(
    username: string,
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
          username,
          scenarioName,
          score,
          timestamp,
        });

        request.onsuccess = (): void => {
          this._scoreRecordedCallbacks.forEach(
            (callback: (scenarioName: string) => void): void =>
              callback(scenarioName),
          );

          resolve();
        };

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  /**
   * Retrieves the most recent scores with their timestamps for a specific scenario.
   *
   * @param username - The username to query for.
   * @param scenarioName - The name of the scenario.
   * @param limit - Maximum number of recent scores to return.
   * @returns A promise resolving to an array of score entries.
   */
  public async getLastScores(
    username: string,
    scenarioName: string,
    limit: number = 100,
  ): Promise<{ score: number; timestamp: number }[]> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise(
      (
        resolve: (value: { score: number; timestamp: number }[]) => void,
        reject: (reason: unknown) => void,
      ): void => {
        const transaction: IDBTransaction = database.transaction(
          this._scoresStoreName,
          "readonly",
        );

        const index: IDBIndex = transaction
          .objectStore(this._scoresStoreName)
          .index("username_scenario");

        const scores: { score: number; timestamp: number }[] = [];

        const request: IDBRequest<IDBCursorWithValue | null> = index.openCursor(
          IDBKeyRange.only([username, scenarioName]),
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
    scores: { score: number; timestamp: number }[],
    limit: number,
    resolve: (value: { score: number; timestamp: number }[]) => void,
  ): void {
    const cursor: IDBCursorWithValue | null = (
      event.target as IDBRequest<IDBCursorWithValue | null>
    ).result;

    if (cursor && scores.length < limit) {
      const entry: { score: number; timestamp: number } = cursor.value as {
        score: number;
        timestamp: number;
      };

      scores.push({
        score: entry.score,
        timestamp: entry.timestamp,
      });

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

  /**
   * Deletes all player data for a specific user.
   *
   * @param username - The username to delete data for.
   */
  public async deletePlayerData(username: string): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise((resolve, reject): void => {
      const transaction = database.transaction([this._highscoreStoreName, this._scoresStoreName], "readwrite");

      const highscoreStore = transaction.objectStore(this._highscoreStoreName);
      const highscoreIndex = highscoreStore.index("username");
      const highscoreRequest = highscoreIndex.openCursor(IDBKeyRange.only(username));

      highscoreRequest.onsuccess = (event: Event): void => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      const scoreStore = transaction.objectStore(this._scoresStoreName);
      const scoreIndex = scoreStore.index("username");
      const scoreRequest = scoreIndex.openCursor(IDBKeyRange.only(username));

      scoreRequest.onsuccess = (event: Event): void => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error);
    });
  }

  /**
   * Records multiple scores from Kovaaks API.
   *
   * @param username - The username to record for.
   * @param scenarioName - The name of the scenario.
   * @param scores - The list of scores to record.
   */
  public async recordKovaaksScores(
    username: string,
    scenarioName: string,
    scores: { score: number; date: string }[]
  ): Promise<void> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject): void => {
      const transaction = database.transaction([this._scoresStoreName], "readwrite");
      const store = transaction.objectStore(this._scoresStoreName);

      scores.forEach((scoreItem) => {
        store.add({
          username,
          scenarioName,
          score: scoreItem.score,
          timestamp: new Date(scoreItem.date).getTime()
        });
      });

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error);
    });
  }
}
