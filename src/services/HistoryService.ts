/**
 * Represents a single score entry in the historical database.
 */
export interface RecordedScore {
  /** Internal unique identifier for the score. */
  id?: number;
  /** Unique identifier for the player (Kovaaks username). */
  playerId: string;
  /** The name of the scenario. */
  scenarioName: string;
  /** The achieved score value. */
  score: number;
  /** The date and time when the run was completed. */
  completionDate: string;
}

/**
 * Represents the personal best for a specific scenario and player.
 */
export interface Highscore {
  /** Internal unique identifier for the highscore. */
  id?: number;
  /** The name of the scenario. */
  scenarioName: string;
  /** Unique identifier for the player (Kovaaks username). */
  playerId: string;
  /** The highest score recorded for this player and scenario. */
  score: number;
  /** The date and time of the highscore. */
  date: string;
}

/**
 * Manages persistence of scores and highscores using IndexedDB.
 */
export class HistoryService {
  private static readonly _dbName: string = "raw_output_history";
  private static readonly _dbVersion: number = 4;

  private readonly _onScoreRecordedListeners: (() => void)[] = [];
  private readonly _onHighscoreUpdatedListeners: ((scenarioName?: string) => void)[] = [];
  private _db: IDBDatabase | null = null;

  /**
   * Initializes the service and opens the database.
   */
  public constructor() {
    this._initDatabase();
  }

  /**
   * Records multiple scores in a single transaction.
   *
   * @param playerId - The player to associate the scores with.
   * @param scores - The list of scores to record.
   */
  public async recordMultipleScores(
    playerId: string,
    scores: Omit<RecordedScore, "id" | "playerId">[],
  ): Promise<void> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Scores", "readwrite");
    const store: IDBObjectStore = transaction.objectStore("Scores");

    const promises: Promise<void>[] = scores.map((score: Omit<RecordedScore, "id" | "playerId">): Promise<void> => {
      return new Promise<void>((resolve: () => void, reject: (error: DOMException | null) => void): void => {
        const request: IDBRequest<IDBValidKey> = store.add({ ...score, playerId });
        request.onsuccess = (): void => resolve();
        request.onerror = (): void => reject(request.error);
      });
    });

    await Promise.all(promises);
    this._notifyScoreRecorded();
  }

  /**
   * Retrieves all scores for a specific scenario and player.
   *
   * @param playerId - The player's ID.
   * @param scenarioName - The name of the scenario.
   * @returns A promise resolving to the list of scores.
   */
  public async getScoresForScenario(
    playerId: string,
    scenarioName: string,
  ): Promise<RecordedScore[]> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Scores", "readonly");
    const store: IDBObjectStore = transaction.objectStore("Scores");
    const index: IDBIndex = store.index("scenarioName");

    return new Promise((resolve: (value: RecordedScore[]) => void, reject: (error: DOMException | null) => void): void => {
      const request: IDBRequest<RecordedScore[]> = index.getAll(scenarioName) as IDBRequest<RecordedScore[]>;
      request.onsuccess = (): void => {
        const results: RecordedScore[] = request.result as RecordedScore[];
        resolve(results.filter((scoreRecord: RecordedScore): boolean => scoreRecord.playerId === playerId));
      };
      request.onerror = (): void => reject(request.error);
    });
  }

  /**
   * Retrieves the highscore for a specific scenario and player.
   *
   * @param playerId - The player's ID.
   * @param scenarioName - The name of the scenario.
   * @returns A promise resolving to the highscore or null if none exists.
   */
  public async getHighscore(
    playerId: string,
    scenarioName: string,
  ): Promise<Highscore | null> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Highscores", "readonly");
    const store: IDBObjectStore = transaction.objectStore("Highscores");
    const index: IDBIndex = store.index("playerScenario");

    return new Promise((resolve: (value: Highscore | null) => void, reject: (error: DOMException | null) => void): void => {
      const request: IDBRequest<Highscore | undefined> = index.get([playerId, scenarioName]) as IDBRequest<Highscore | undefined>;
      request.onsuccess = (): void => resolve((request.result as Highscore) || null);
      request.onerror = (): void => reject(request.error);
    });
  }

  /**
   * Updates or creates highscores for multiple scenarios and a player.
   *
   * @param playerId - The player's ID.
   * @param newHighscores - The list of highscores to update.
   */
  public async updateMultipleHighscores(
    playerId: string,
    newHighscores: Omit<Highscore, "id" | "playerId">[],
  ): Promise<void> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Highscores", "readwrite");
    const store: IDBObjectStore = transaction.objectStore("Highscores");

    const promises: Promise<void>[] = newHighscores.map(async (highscoreEntry: Omit<Highscore, "id" | "playerId">): Promise<void> => {
      const record: Omit<Highscore, "id"> = { ...highscoreEntry, playerId };
      const existing: Highscore | null = await this.getHighscore(playerId, highscoreEntry.scenarioName);

      return new Promise<void>((resolve: () => void, reject: (error: DOMException | null) => void): void => {
        if (existing) {
          // eslint-disable-next-line id-length
          const request: IDBRequest<IDBValidKey> = store.put({ ...record, id: existing.id });
          request.onsuccess = (): void => resolve();
          request.onerror = (): void => reject(request.error);
        } else {
          const request: IDBRequest<IDBValidKey> = store.add(record);
          request.onsuccess = (): void => resolve();
          request.onerror = (): void => reject(request.error);
        }
      });
    });

    await Promise.all(promises);
    this._notifyHighscoreUpdated();
  }

  /**
   * Retrieves highscores for a batch of scenarios and a player.
   *
   * @param playerId - The player's ID.
   * @param scenarioNames - The list of scenario names.
   * @returns A promise resolving to a record of scenario names and scores.
   */
  public async getBatchHighscores(
    playerId: string,
    scenarioNames: string[],
  ): Promise<Record<string, number>> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Highscores", "readonly");
    const store: IDBObjectStore = transaction.objectStore("Highscores");
    const index: IDBIndex = store.index("playerScenario");

    const results: Record<string, number> = {};
    const promises: Promise<void>[] = scenarioNames.map((name: string): Promise<void> => {
      return new Promise<void>((resolve: () => void, reject: (error: DOMException | null) => void): void => {
        const request: IDBRequest<Highscore | undefined> = index.get([playerId, name]) as IDBRequest<Highscore | undefined>;
        request.onsuccess = (): void => {
          if (request.result) {
            results[name] = (request.result as Highscore).score;
          }
          resolve();
        };
        request.onerror = (): void => reject(request.error);
      });
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Records scores fetched from the Kovaaks API and updates highscores.
   *
   * @param playerId - The player's ID.
   * @param scenarioName - The name of the scenario.
   * @param scores - The list of scores to record.
   */
  public async recordKovaaksScores(
    playerId: string,
    scenarioName: string,
    scores: { score: number; date: string }[],
  ): Promise<void> {
    const newScores: Omit<RecordedScore, "id" | "playerId">[] = await this._getNewScoresOnly(playerId, scenarioName, scores);

    if (newScores.length === 0) {
      return;
    }

    await this.recordMultipleScores(playerId, newScores);
    await this._updateHighscoreIfHigher(playerId, scenarioName, newScores);
  }

  private async _getNewScoresOnly(
    playerId: string,
    scenarioName: string,
    scores: { score: number; date: string }[],
  ): Promise<Omit<RecordedScore, "id" | "playerId">[]> {
    const existing: RecordedScore[] = await this.getScoresForScenario(playerId, scenarioName);
    const existingDates: Set<string> = new Set(existing.map((score: RecordedScore): string => score.completionDate));

    return scores
      .filter((score: { score: number; date: string }): boolean => !existingDates.has(score.date))
      .map((score: { score: number; date: string }): Omit<RecordedScore, "id" | "playerId"> => ({
        scenarioName,
        score: score.score,
        completionDate: score.date,
      }));
  }

  private async _updateHighscoreIfHigher(
    playerId: string,
    scenarioName: string,
    newScores: Omit<RecordedScore, "id" | "playerId">[],
  ): Promise<void> {
    const currentHighscore: Highscore | null = await this.getHighscore(playerId, scenarioName);
    const maxNewScore: number = Math.max(...newScores.map((score: Omit<RecordedScore, "id" | "playerId">): number => score.score));

    if (!currentHighscore || maxNewScore > currentHighscore.score) {
      const bestRun: Omit<RecordedScore, "id" | "playerId"> | undefined = newScores.find((score: Omit<RecordedScore, "id" | "playerId">): boolean => score.score === maxNewScore);
      if (bestRun) {
        await this.updateMultipleHighscores(playerId, [
          {
            scenarioName,
            score: maxNewScore,
            date: bestRun.completionDate,
          },
        ]);
      }
    }
  }

  /**
   * Retrieves the most recent scores with their timestamps for a specific scenario and player.
   *
   * @param playerId - The player's ID.
   * @param scenarioName - The name of the scenario.
   * @param limit - Maximum number of recent scores to return.
   * @returns A promise resolving to an array of score entries.
   */
  public async getLastScores(
    playerId: string,
    scenarioName: string,
    limit: number = 100,
  ): Promise<{ score: number; timestamp: number }[]> {
    const database: IDBDatabase = await this._getDb();
    const transaction: IDBTransaction = database.transaction("Scores", "readonly");
    const store: IDBObjectStore = transaction.objectStore("Scores");
    const index: IDBIndex = store.index("scenarioName");

    return new Promise((resolve: (value: { score: number; timestamp: number }[]) => void, reject: (error: DOMException | null) => void): void => {
      const scores: { score: number; timestamp: number }[] = [];
      const request: IDBRequest<IDBCursorWithValue | null> = index.openCursor(IDBKeyRange.only(scenarioName), "prev");

      request.onsuccess = (event: Event): void => {
        const cursor: IDBCursorWithValue | null = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor && scores.length < limit) {
          const scoreRecord: RecordedScore = cursor.value as RecordedScore;
          if (scoreRecord.playerId === playerId) {
            scores.push({
              score: scoreRecord.score,
              timestamp: Number(scoreRecord.completionDate),
            });
          }
          cursor.continue();
        } else {
          resolve(scores);
        }
      };
      request.onerror = (): void => reject(request.error);
    });
  }

  /**
   * Registers a callback for when a new score is recorded.
   * @param callback
   */
  public onScoreRecorded(callback: () => void): void {
    this._onScoreRecordedListeners.push(callback);
  }

  /**
   * Registers a callback for when a highscore is updated.
   * @param callback
   */
  public onHighscoreUpdated(callback: (scenarioName?: string) => void): void {
    this._onHighscoreUpdatedListeners.push(callback);
  }

  private _initDatabase(): void {
    const request: IDBOpenDBRequest = indexedDB.open(
      HistoryService._dbName,
      HistoryService._dbVersion,
    );

    request.onupgradeneeded = (event: IDBVersionChangeEvent): void => {
      const database: IDBDatabase = request.result;
      const oldVersion: number = event.oldVersion;
      const transaction: IDBTransaction | null = request.transaction;

      if (oldVersion < 4) {
        this._upgradeToMultiPlayer(database, transaction);
      }
    };

    request.onsuccess = (): void => {
      this._db = request.result;
    };

    request.onerror = (): void => {
      console.error("Database error:", request.error);
    };
  }

  private _upgradeToMultiPlayer(database: IDBDatabase, transaction: IDBTransaction | null): void {
    if (database.objectStoreNames.contains("Scores")) {
      const scoreStore: IDBObjectStore = transaction!.objectStore("Scores");
      if (!scoreStore.indexNames.contains("playerId")) {
        scoreStore.createIndex("playerId", "playerId", { unique: false });
      }
    } else {
      const scoreStore: IDBObjectStore = database.createObjectStore("Scores", { keyPath: "id", autoIncrement: true });
      scoreStore.createIndex("scenarioName", "scenarioName", { unique: false });
      scoreStore.createIndex("playerId", "playerId", { unique: false });
    }

    if (database.objectStoreNames.contains("Highscores")) {
      database.deleteObjectStore("Highscores");
    }

    const highscoreStore: IDBObjectStore = database.createObjectStore("Highscores", {
      keyPath: "id",
      autoIncrement: true,
    });
    highscoreStore.createIndex("playerScenario", ["playerId", "scenarioName"], {
      unique: true,
    });
    highscoreStore.createIndex("playerId", "playerId", { unique: false });
    highscoreStore.createIndex("scenarioName", "scenarioName", { unique: false });

    if (!database.objectStoreNames.contains("Metadata")) {
      database.createObjectStore("Metadata", { keyPath: "id" });
    }
  }

  private async _getDb(): Promise<IDBDatabase> {
    if (this._db) {
      return this._db;
    }

    return new Promise((resolve: (value: IDBDatabase) => void, reject: (error: DOMException | null) => void): void => {
      const request: IDBOpenDBRequest = indexedDB.open(
        HistoryService._dbName,
        HistoryService._dbVersion,
      );
      request.onsuccess = (): void => {
        this._db = request.result;
        resolve(this._db);
      };
      request.onerror = (): void => reject(request.error);
    });
  }

  private _notifyScoreRecorded(): void {
    this._onScoreRecordedListeners.forEach((callback: () => void): void => callback());
  }

  private _notifyHighscoreUpdated(scenarioName?: string): void {
    this._onHighscoreUpdatedListeners.forEach((callback: (scenarioName?: string) => void): void => callback(scenarioName));
  }

  /**
   * Deletes all scores and highscores for a specific player.
   *
   * @param playerId - The player's ID (username).
   */
  public async deletePlayerData(playerId: string): Promise<void> {
    await this._getDb();
    await Promise.all([
      this._deleteFromStore("Highscores", playerId),
      this._deleteFromStore("Scores", playerId)
    ]);
  }

  private async _deleteFromStore(storeName: string, playerId: string): Promise<void> {
    const database = await this._getDb();

    return new Promise<void>((resolve, reject) => {
      const transaction: IDBTransaction = database.transaction(storeName, "readwrite");
      const store: IDBObjectStore = transaction.objectStore(storeName);
      const index: IDBIndex = store.index("playerId");
      const request: IDBRequest<IDBCursorWithValue | null> = index.openCursor(IDBKeyRange.only(playerId));

      request.onsuccess = (event: Event): void => {
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
}
