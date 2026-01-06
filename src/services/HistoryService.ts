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

  private readonly _highscoreCallbacks: (() => void)[] = [];

  public onHighscoreUpdated(callback: () => void): void {
    this._highscoreCallbacks.push(callback);
  }

  /**
   * Initializes the database connection and returns the highscore for a specific scenario.
   */
  public async getHighscore(scenarioName: string): Promise<number> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._highscoreStoreName,
        "readonly",
      );

      const store = transaction.objectStore(this._highscoreStoreName);

      const request = store.get(scenarioName);

      request.onsuccess = () => resolve(request.result || 0);

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Updates the highscore for a scenario if the new score is higher.
   * @returns boolean indicating if a new highscore was achieved.
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

    this._highscoreCallbacks.forEach((callback) => callback());

    return true;
  }

  private async _persistHighscore(
    scenarioName: string,
    score: number,
  ): Promise<void> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._highscoreStoreName,
        "readwrite",
      );

      const store = transaction.objectStore(this._highscoreStoreName);

      const request = store.put(score, scenarioName);

      request.onsuccess = () => resolve();

      request.onerror = () => reject(request.error);
    });
  }

  private async _getDatabase(): Promise<IDBDatabase> {
    if (this._db) {
      return this._db;
    }

    this._db = await this._initializeDatabase();

    return this._db;
  }

  private _initializeDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._databaseName, this._databaseVersion);

      request.onupgradeneeded = () => {
        this._handleDatabaseUpgrade(request.result);
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => reject(request.error);
    });
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
   */
  public async getBatchHighscores(
    scenarioNames: string[],
  ): Promise<Record<string, number>> {
    const highscores: Record<string, number> = {};

    const promises = scenarioNames.map(async (name) => {
      highscores[name] = await this.getHighscore(name);
    });

    await Promise.all(promises);

    return highscores;
  }

  public async recordScore(
    scenarioName: string,
    score: number,
    timestamp: number,
  ): Promise<void> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._scoresStoreName,
        "readwrite",
      );

      const store = transaction.objectStore(this._scoresStoreName);

      const request = store.add({ scenarioName, score, timestamp });

      request.onsuccess = () => resolve();

      request.onerror = () => reject(request.error);
    });
  }

  public async getLastScores(
    scenarioName: string,
    limit: number = 100,
  ): Promise<number[]> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._scoresStoreName,
        "readonly",
      );

      const store = transaction.objectStore(this._scoresStoreName);

      const index = store.index("scenarioName");

      const scores: number[] = [];

      const request = index.openCursor(IDBKeyRange.only(scenarioName), "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && scores.length < limit) {
          scores.push(cursor.value.score);

          cursor.continue();
        } else {
          resolve(scores);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async getLastCheckTimestamp(): Promise<number> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._metadataStoreName,
        "readonly",
      );

      const store = transaction.objectStore(this._metadataStoreName);

      const request = store.get("lastCheck");

      request.onsuccess = () => resolve(request.result || 0);

      request.onerror = () => reject(request.error);
    });
  }

  public async setLastCheckTimestamp(timestamp: number): Promise<void> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        this._metadataStoreName,
        "readwrite",
      );

      const store = transaction.objectStore(this._metadataStoreName);

      const request = store.put(timestamp, "lastCheck");

      request.onsuccess = () => resolve();

      request.onerror = () => reject(request.error);
    });
  }
}
