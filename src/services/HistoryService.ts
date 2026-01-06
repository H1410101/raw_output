/**
 * Responsibility: Manage and persist user highscores for scenarios using IndexedDB.
 */
export class HistoryService {
  private readonly _databaseName: string = "RawOutputHistory";

  private readonly _storeName: string = "Highscores";

  private readonly _databaseVersion: number = 1;

  private _db: IDBDatabase | null = null;

  /**
   * Initializes the database connection and returns the highscore for a specific scenario.
   */
  public async getHighscore(scenarioName: string): Promise<number> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this._storeName, "readonly");

      const store = transaction.objectStore(this._storeName);

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

    return true;
  }

  private async _persistHighscore(
    scenarioName: string,
    score: number,
  ): Promise<void> {
    const database = await this._getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this._storeName, "readwrite");

      const store = transaction.objectStore(this._storeName);

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
    if (!database.objectStoreNames.contains(this._storeName)) {
      database.createObjectStore(this._storeName);
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
}
