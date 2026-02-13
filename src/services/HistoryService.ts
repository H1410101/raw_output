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
    const db = await this._getDb();
    const transaction = db.transaction("Scores", "readwrite");
    const store = transaction.objectStore("Scores");

    const promises = scores.map((score) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.add({ ...score, playerId });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
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
    const db = await this._getDb();
    const transaction = db.transaction("Scores", "readonly");
    const store = transaction.objectStore("Scores");
    const index = store.index("scenarioName");

    return new Promise((resolve, reject) => {
      const request = index.getAll(scenarioName);
      request.onsuccess = () => {
        const results = request.result as RecordedScore[];
        resolve(results.filter((s) => s.playerId === playerId));
      };
      request.onerror = () => reject(request.error);
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
    const db = await this._getDb();
    const transaction = db.transaction("Highscores", "readonly");
    const store = transaction.objectStore("Highscores");
    const index = store.index("playerScenario");

    return new Promise((resolve, reject) => {
      const request = index.get([playerId, scenarioName]);
      request.onsuccess = () => resolve((request.result as Highscore) || null);
      request.onerror = () => reject(request.error);
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
    const db = await this._getDb();
    const transaction = db.transaction("Highscores", "readwrite");
    const store = transaction.objectStore("Highscores");

    const promises = newHighscores.map((hs) => {
      const record = { ...hs, playerId };

      return new Promise<void>(async (resolve, reject) => {
        const existing = await this.getHighscore(playerId, hs.scenarioName);
        if (existing) {
          const request = store.put({ ...record, id: existing.id });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } else {
          const request = store.add(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
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
    const db = await this._getDb();
    const transaction = db.transaction("Highscores", "readonly");
    const store = transaction.objectStore("Highscores");
    const index = store.index("playerScenario");

    const results: Record<string, number> = {};
    const promises = scenarioNames.map((name) => {
      return new Promise<void>((resolve, reject) => {
        const request = index.get([playerId, name]);
        request.onsuccess = () => {
          if (request.result) {
            results[name] = (request.result as Highscore).score;
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
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
    const existing = await this.getScoresForScenario(playerId, scenarioName);
    const existingDates = new Set(existing.map((s) => s.completionDate));

    const newScores = scores
      .filter((s) => !existingDates.has(s.date))
      .map((s) => ({
        scenarioName,
        score: s.score,
        completionDate: s.date,
      }));

    if (newScores.length === 0) return;

    await this.recordMultipleScores(playerId, newScores);

    const currentHighscore = await this.getHighscore(playerId, scenarioName);
    const maxNewScore = Math.max(...newScores.map((s) => s.score));

    if (!currentHighscore || maxNewScore > currentHighscore.score) {
      const bestRun = newScores.find((s) => s.score === maxNewScore);
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
    const db = await this._getDb();
    const transaction = db.transaction("Scores", "readonly");
    const store = transaction.objectStore("Scores");
    const index = store.index("scenarioName");

    return new Promise((resolve, reject) => {
      const scores: { score: number; timestamp: number }[] = [];
      const request = index.openCursor(IDBKeyRange.only(scenarioName), "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor && scores.length < limit) {
          if (cursor.value.playerId === playerId) {
            scores.push({
              score: cursor.value.score,
              timestamp: Number(cursor.value.completionDate),
            });
          }
          cursor.continue();
        } else {
          resolve(scores);
        }
      };
      request.onerror = () => reject(request.error);
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
    const request = indexedDB.open(
      HistoryService._dbName,
      HistoryService._dbVersion,
    );

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      const transaction = request.transaction;

      if (oldVersion < 4) {
        this._upgradeToMultiPlayer(db, transaction);
      }
    };

    request.onsuccess = () => {
      this._db = request.result;
    };

    request.onerror = () => {
      console.error("Database error:", request.error);
    };
  }

  private _upgradeToMultiPlayer(db: IDBDatabase, transaction: IDBTransaction | null): void {
    if (db.objectStoreNames.contains("Scores")) {
      const scoreStore = transaction!.objectStore("Scores");
      if (!scoreStore.indexNames.contains("playerId")) {
        scoreStore.createIndex("playerId", "playerId", { unique: false });
      }
    } else {
      const scoreStore = db.createObjectStore("Scores", { keyPath: "id", autoIncrement: true });
      scoreStore.createIndex("scenarioName", "scenarioName", { unique: false });
      scoreStore.createIndex("playerId", "playerId", { unique: false });
    }

    if (db.objectStoreNames.contains("Highscores")) {
      db.deleteObjectStore("Highscores");
    }

    const hsStore = db.createObjectStore("Highscores", {
      keyPath: "id",
      autoIncrement: true,
    });
    hsStore.createIndex("playerScenario", ["playerId", "scenarioName"], {
      unique: true,
    });
    hsStore.createIndex("playerId", "playerId", { unique: false });
    hsStore.createIndex("scenarioName", "scenarioName", { unique: false });

    if (!db.objectStoreNames.contains("Metadata")) {
      db.createObjectStore("Metadata", { keyPath: "id" });
    }
  }

  private async _getDb(): Promise<IDBDatabase> {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        HistoryService._dbName,
        HistoryService._dbVersion,
      );
      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private _notifyScoreRecorded(): void {
    this._onScoreRecordedListeners.forEach((cb) => cb());
  }

  private _notifyHighscoreUpdated(scenarioName?: string): void {
    this._onHighscoreUpdatedListeners.forEach((cb) => cb(scenarioName));
  }
}
