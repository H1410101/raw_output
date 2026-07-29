export interface KovaaksHighscoreCache {
  categories: Record<string, unknown>;
  timestamp: number;
}

interface ScoreRecordedSubscription {
  readonly callback: (scenarioName: string) => void;
  readonly includeImported: boolean;
}

/**
 * Responsibility: Manage and persist user highscores for scenarios using IndexedDB.
 */
export class HistoryService {
  private readonly _databaseName: string = "RawOutputHistory";

  private readonly _highscoreStoreName: string = "Highscores";

  private readonly _scoresStoreName: string = "Scores";

  private readonly _metadataStoreName: string = "Metadata";

  private readonly _kovaaksHighscoreCacheStoreName: string = "KovaaksHighscoreCache";

  private readonly _databaseVersion: number = 7;

  private _db: IDBDatabase | null = null;

  private _databasePromise: Promise<IDBDatabase> | null = null;

  private _legacyClaimPromise: Promise<void> | null = null;

  private _legacyClaimComplete: boolean = false;

  private readonly _highscoreCallbacks: ((scenarioName?: string) => void)[] =
    [];

  private readonly _scoreRecordedCallbacks: ScoreRecordedSubscription[] = [];

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
   * @param options - Controls whether API history imports trigger the callback.
   * @param options.includeImported - Whether imported API history should trigger the callback.
   */
  public onScoreRecorded(
    callback: (scenarioName: string) => void,
    options: { readonly includeImported?: boolean } = {},
  ): void {
    this._scoreRecordedCallbacks.push({
      callback,
      includeImported: options.includeImported !== false,
    });
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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          this._highscoreStoreName,
          "readwrite",
        );

        const store = transaction.objectStore(this._highscoreStoreName);

        store.put({
          username,
          scenarioName,
          score
        });

        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
        transaction.onabort = (): void => reject(transaction.error);
      },
    );
  }

  private async _getDatabase(): Promise<IDBDatabase> {
    if (this._db) {
      return this._db;
    }

    const databasePromise: Promise<IDBDatabase> =
      this._databasePromise ?? this._initializeDatabase();
    this._databasePromise = databasePromise;

    try {
      const database: IDBDatabase = await databasePromise;
      this._db = database;
      database.onversionchange = (): void => {
        database.close();
        if (this._db === database) this._db = null;
      };

      return database;
    } finally {
      if (this._databasePromise === databasePromise) {
        this._databasePromise = null;
      }
    }
  }

  private async _getDatabaseForUser(username: string): Promise<IDBDatabase> {
    const database: IDBDatabase = await this._getDatabase();
    if (username.trim() === "" || username === "__legacy__" || this._legacyClaimComplete) return database;

    const claim: Promise<void> = this._legacyClaimPromise ?? this._claimLegacyData(database, username);
    this._legacyClaimPromise = claim;
    try {
      await claim;
      this._legacyClaimComplete = true;
    } finally {
      if (this._legacyClaimPromise === claim) this._legacyClaimPromise = null;
    }

    return database;
  }

  private _claimLegacyData(database: IDBDatabase, username: string): Promise<void> {
    return new Promise((resolve, reject): void => {
      const transaction: IDBTransaction = database.transaction(
        [this._highscoreStoreName, this._scoresStoreName],
        "readwrite",
      );
      this._claimLegacyHighscores(transaction.objectStore(this._highscoreStoreName), username);
      this._claimLegacyScores(transaction.objectStore(this._scoresStoreName), username);
      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error);
      transaction.onabort = (): void => reject(transaction.error);
    });
  }

  private _claimLegacyHighscores(store: IDBObjectStore, username: string): void {
    const request = store.index("username").openCursor(IDBKeyRange.only("__legacy__"));
    request.onsuccess = (): void => {
      const cursor: IDBCursorWithValue | null = request.result;
      if (!cursor) return;

      const legacy = cursor.value as { scenarioName: string; score: number };
      const existingRequest = store.get([username, legacy.scenarioName]);
      existingRequest.onsuccess = (): void => {
        const existing = existingRequest.result as { score: number } | undefined;
        store.put({
          username,
          scenarioName: legacy.scenarioName,
          score: Math.max(existing?.score ?? 0, legacy.score),
        });
        cursor.delete();
        cursor.continue();
      };
    };
  }

  private _claimLegacyScores(store: IDBObjectStore, username: string): void {
    const request = store.index("username").openCursor(IDBKeyRange.only("__legacy__"));
    request.onsuccess = (): void => {
      const cursor: IDBCursorWithValue | null = request.result;
      if (!cursor) return;

      cursor.update({ ...(cursor.value as object), username });
      cursor.continue();
    };
  }

  private _initializeDatabase(): Promise<IDBDatabase> {
    return new Promise(
      (
        resolve: (value: IDBDatabase) => void,
        reject: (reason: unknown) => void,
      ): void => {
        let blocked = false;
        const request: IDBOpenDBRequest = indexedDB.open(
          this._databaseName,
          this._databaseVersion,
        );

        request.onupgradeneeded = (): void => {
          this._handleDatabaseUpgrade(request.result, request.transaction!);
        };

        request.onsuccess = (): void => {
          if (blocked) {
            request.result.close();

            return;
          }

          resolve(request.result);
        };

        request.onblocked = (): void => {
          blocked = true;
          reject(new Error("History database upgrade is blocked by another open tab"));
        };

        request.onerror = (): void => reject(request.error);
      },
    );
  }

  private _handleDatabaseUpgrade(database: IDBDatabase, transaction: IDBTransaction): void {
    this._upgradeHighscoreStore(database, transaction);
    this._upgradeScoreStore(database, transaction);
    this._upgradeMetadataStore(database);
    this._upgradeCacheStore(database);
  }

  private _upgradeHighscoreStore(database: IDBDatabase, transaction: IDBTransaction): void {
    if (!database.objectStoreNames.contains(this._highscoreStoreName)) {
      this._createHighscoreStore(database);

      return;
    }

    const store: IDBObjectStore = transaction.objectStore(this._highscoreStoreName);
    const hasCompositeKey: boolean = Array.isArray(store.keyPath) &&
      store.keyPath.join("\u0000") === "username\u0000scenarioName";
    if (!hasCompositeKey) {
      this._migrateLegacyHighscores(database, store);
    } else if (!store.indexNames.contains("username")) {
      store.createIndex("username", "username", { unique: false });
    }
  }

  private _createHighscoreStore(database: IDBDatabase): IDBObjectStore {
    const store = database.createObjectStore(this._highscoreStoreName, {
      keyPath: ["username", "scenarioName"],
    });
    store.createIndex("username", "username", { unique: false });

    return store;
  }

  private _migrateLegacyHighscores(database: IDBDatabase, legacyStore: IDBObjectStore): void {
    const records = new Map<string, { username: string; scenarioName: string; score: number }>();
    const request: IDBRequest<IDBCursorWithValue | null> = legacyStore.openCursor();
    request.onsuccess = (): void => {
      const cursor: IDBCursorWithValue | null = request.result;
      if (cursor) {
        const record = this._readLegacyHighscore(cursor);
        if (record) {
          const key: string = `${record.username}\u0000${record.scenarioName}`;
          const existing = records.get(key);
          if (!existing || record.score > existing.score) records.set(key, record);
        }
        cursor.continue();

        return;
      }

      database.deleteObjectStore(this._highscoreStoreName);
      const targetStore: IDBObjectStore = this._createHighscoreStore(database);
      records.forEach((record): void => {
        targetStore.put(record);
      });
    };
  }

  private _readLegacyHighscore(
    cursor: IDBCursorWithValue,
  ): { username: string; scenarioName: string; score: number } | null {
    const value: unknown = cursor.value as unknown;
    const stored = typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : null;
    const username: string = typeof stored?.username === "string"
      ? stored.username
      : this._getLegacyUsername();
    const scenarioName: string = typeof stored?.scenarioName === "string"
      ? stored.scenarioName
      : String(cursor.key);
    const score: number = typeof stored?.score === "number" ? stored.score : Number(value);

    return scenarioName && Number.isFinite(score) ? { username, scenarioName, score } : null;
  }

  private _getLegacyUsername(): string {
    const activeUsername: string | null = localStorage.getItem("raw_output_active_username");

    try {
      const profiles: unknown = JSON.parse(localStorage.getItem("raw_output_player_profiles") ?? "[]");
      if (Array.isArray(profiles) && profiles.length > 0) {
        const usernames: string[] = profiles.flatMap((profile: unknown): string[] => {
          if (typeof profile !== "object" || profile === null) return [];

          const record = profile as Record<string, unknown>;

          return typeof record.username === "string" && record.username !== "" &&
            typeof record.deletedAt !== "string" ? [record.username] : [];
        });
        const activeMatch: string | undefined = activeUsername
          ? usernames.find((username: string): boolean => username.toLowerCase() === activeUsername.toLowerCase())
          : undefined;

        return activeMatch ?? usernames[0] ?? "__legacy__";
      }
    } catch {
      // Preserve otherwise unassignable data under an explicit legacy identity.
    }

    return "__legacy__";
  }

  private _upgradeScoreStore(database: IDBDatabase, transaction: IDBTransaction): void {
    if (!database.objectStoreNames.contains(this._scoresStoreName)) {
      const scoreStore = database.createObjectStore(this._scoresStoreName, {
        keyPath: "id",
        autoIncrement: true,
      });

      scoreStore.createIndex("scenarioName", "scenarioName", { unique: false });
      scoreStore.createIndex("username", "username", { unique: false });
      scoreStore.createIndex("username_scenario", ["username", "scenarioName", "timestamp"], {
        unique: false,
      });
    } else {
      this._migrateScoreStore(transaction);
    }
  }

  private _migrateScoreStore(transaction: IDBTransaction): void {
    const scoreStore = transaction.objectStore(this._scoresStoreName);

    if (!scoreStore.indexNames.contains("scenarioName")) {
      scoreStore.createIndex("scenarioName", "scenarioName", { unique: false });
    }
    if (!scoreStore.indexNames.contains("username")) {
      scoreStore.createIndex("username", "username", { unique: false });
      this._assignLegacyScoreUsernames(scoreStore);
    }

    if (scoreStore.indexNames.contains("username_scenario")) {
      const index = scoreStore.index("username_scenario");
      if (Array.isArray(index.keyPath) && index.keyPath.length === 2) {
        scoreStore.deleteIndex("username_scenario");
        scoreStore.createIndex("username_scenario", ["username", "scenarioName", "timestamp"], {
          unique: false,
        });
      }
    } else {
      scoreStore.createIndex("username_scenario", ["username", "scenarioName", "timestamp"], {
        unique: false,
      });
    }
  }

  private _assignLegacyScoreUsernames(scoreStore: IDBObjectStore): void {
    const username: string = this._getLegacyUsername();
    const request: IDBRequest<IDBCursorWithValue | null> = scoreStore.openCursor();
    request.onsuccess = (): void => {
      const cursor: IDBCursorWithValue | null = request.result;
      if (!cursor) return;

      const value = cursor.value as Record<string, unknown>;
      if (typeof value.username !== "string" || value.username === "") {
        cursor.update({ ...value, username });
      }
      cursor.continue();
    };
  }

  private _upgradeMetadataStore(database: IDBDatabase): void {
    if (!database.objectStoreNames.contains(this._metadataStoreName)) {
      database.createObjectStore(this._metadataStoreName);
    }
  }

  private _upgradeCacheStore(database: IDBDatabase): void {
    if (!database.objectStoreNames.contains(this._kovaaksHighscoreCacheStoreName)) {
      database.createObjectStore(this._kovaaksHighscoreCacheStoreName, {
        keyPath: ["steamId", "benchmarkId"],
      });
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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

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
    imported: boolean = false,
  ): void {
    const scenarioNames = new Set(scores.map((scoreRecord): string => scoreRecord.scenarioName));
    scenarioNames.forEach((scenarioName: string): void => {
      this._scoreRecordedCallbacks.forEach((subscription: ScoreRecordedSubscription): void => {
        if (!imported || subscription.includeImported) subscription.callback(scenarioName);
      });
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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

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
  public async recordScore(
    username: string,
    scenarioName: string,
    score: number,
    timestamp: number,
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabaseForUser(username);

    return new Promise(
      (resolve: () => void, reject: (reason: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          this._scoresStoreName,
          "readwrite",
        );

        const store = transaction.objectStore(this._scoresStoreName);

        store.add({
          username,
          scenarioName,
          score,
          timestamp,
        });

        transaction.oncomplete = (): void => {
          this._notifyScoreRecorded([{ scenarioName, score, timestamp }]);

          resolve();
        };

        transaction.onerror = (): void => reject(transaction.error);
        transaction.onabort = (): void => reject(transaction.error);
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
    const database: IDBDatabase = await this._getDatabaseForUser(username);

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
          IDBKeyRange.bound([username, scenarioName, 0], [username, scenarioName, Infinity]),
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

        store.put(timestamp, "lastCheck");
        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
        transaction.onabort = (): void => reject(transaction.error);
      },
    );
  }

  /**
   * Deletes all player data for a specific user.
   *
   * @param username - The username to delete data for.
   * @param steamId - The Steam ID whose cached benchmark data should be deleted.
   * @param shouldDelete - Guard used to cancel deletion if the profile is reactivated.
   */
  // eslint-disable-next-line max-lines-per-function
  public async deletePlayerData(
    username: string,
    steamId: string,
    shouldDelete: () => boolean = (): boolean => true,
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();
    if (!shouldDelete()) return;

    // eslint-disable-next-line max-lines-per-function
    return new Promise((resolve, reject): void => {
      const transaction = database.transaction([
        this._highscoreStoreName,
        this._scoresStoreName,
        this._kovaaksHighscoreCacheStoreName,
      ], "readwrite");
      let cancelled = false;
      const continueDeletion = (): boolean => {
        if (shouldDelete()) return true;

        if (!cancelled) {
          cancelled = true;
          transaction.abort();
        }

        return false;
      };

      this._deleteCursorRecords(
        transaction.objectStore(this._highscoreStoreName).index("username"),
        IDBKeyRange.only(username),
        continueDeletion,
      );
      this._deleteCursorRecords(
        transaction.objectStore(this._scoresStoreName).index("username"),
        IDBKeyRange.only(username),
        continueDeletion,
      );
      this._deleteCursorRecords(
        transaction.objectStore(this._kovaaksHighscoreCacheStoreName),
        IDBKeyRange.bound([steamId, ""], [steamId, "\uffff"]),
        continueDeletion,
      );

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error);
      transaction.onabort = (): void => cancelled ? resolve() : reject(transaction.error);
    });
  }

  private _deleteCursorRecords(
    source: IDBIndex | IDBObjectStore,
    range: IDBKeyRange,
    shouldContinue: () => boolean,
  ): void {
    const request: IDBRequest<IDBCursorWithValue | null> = source.openCursor(range);
    request.onsuccess = (): void => {
      if (!shouldContinue()) return;

      const cursor: IDBCursorWithValue | null = request.result;
      if (!cursor) return;

      cursor.delete();
      cursor.continue();
    };
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
    const database = await this._getDatabaseForUser(username);
    const scoreRecords = scores.map((scoreItem) => ({
      scenarioName,
      score: scoreItem.score,
      timestamp: this._parseTimestamp(scoreItem.date)
    }));

    return new Promise((resolve, reject): void => {
      const transaction = database.transaction([this._scoresStoreName], "readwrite");
      const store = transaction.objectStore(this._scoresStoreName);

      scoreRecords.forEach((scoreRecord) => {
        store.add({
          username,
          ...scoreRecord
        });
      });

      transaction.oncomplete = (): void => {
        this._notifyScoreRecorded(scoreRecords, true);
        resolve();
      };
      transaction.onerror = (): void => reject(transaction.error);
    });
  }

  private _parseTimestamp(date: string | number): number {
    const num = Number(date);
    if (!isNaN(num)) {
      return num;
    }

    return new Date(date).getTime();
  }

  /**
   * Retrieves cached Kovaaks highscores for a specific benchmark and player.
   *
   * @param steamId - The player's Steam ID.
   * @param benchmarkId - The Kovaaks benchmark ID.
   * @returns A promise resolving to the cached data if found and valid.
   */
  public async getCachedKovaaksHighscores(
    steamId: string,
    benchmarkId: string,
  ): Promise<KovaaksHighscoreCache | null> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise((resolve, reject): void => {
      const transaction = database.transaction(this._kovaaksHighscoreCacheStoreName, "readonly");
      const store = transaction.objectStore(this._kovaaksHighscoreCacheStoreName);
      const request = store.get([steamId, benchmarkId]);

      request.onsuccess = (): void => {
        resolve((request.result as KovaaksHighscoreCache) || null);
      };

      request.onerror = (): void => reject(request.error);
    });
  }

  /**
   * Caches Kovaaks highscores for a specific benchmark and player.
   *
   * @param steamId - The player's Steam ID.
   * @param benchmarkId - The Kovaaks benchmark ID.
   * @param categories - The benchmark categories data from API.
   */
  public async cacheKovaaksHighscores(
    steamId: string,
    benchmarkId: string,
    categories: Record<string, unknown>,
  ): Promise<void> {
    const database: IDBDatabase = await this._getDatabase();

    return new Promise((resolve, reject): void => {
      const transaction = database.transaction(this._kovaaksHighscoreCacheStoreName, "readwrite");
      const store = transaction.objectStore(this._kovaaksHighscoreCacheStoreName);

      const cacheEntry: KovaaksHighscoreCache = {
        categories,
        timestamp: Date.now(),
      };

      store.put({
        ...cacheEntry,
        steamId,
        benchmarkId,
      });

      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error);
      transaction.onabort = (): void => reject(transaction.error);
    });
  }
}
