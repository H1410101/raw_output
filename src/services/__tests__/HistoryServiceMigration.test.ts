/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it } from "vitest";
import { HistoryService } from "../HistoryService";

const DATABASE_NAME = "RawOutputHistory";

describe("HistoryService schema migration", (): void => {
  it("preserves version 5 highscores and score history", async (): Promise<void> => {
    await _deleteDatabase();
    const legacyDatabase: IDBDatabase = await _openLegacyDatabase();
    await _seedLegacyData(legacyDatabase);
    legacyDatabase.close();

    const service = new HistoryService();
    expect(await service.getHighscore("testuser", "Scenario A")).toBe(1234);
    expect(await service.getLastScores("testuser", "Scenario A")).toEqual([
      { score: 1200, timestamp: 2000 },
      { score: 1100, timestamp: 1000 },
    ]);

    _getOpenDatabase(service)?.close();
    await _deleteDatabase();
  });

  it("claims unowned version 3 data for the first queried profile", _preservesVersion3Data);
  it("fails a blocked upgrade promptly and recovers after the old connection closes", _recoversBlockedUpgrade);
});

async function _preservesVersion3Data(): Promise<void> {
  await _deleteDatabase();
  localStorage.clear();
  const legacyDatabase: IDBDatabase = await _openVersion3Database();
  await _seedVersion3Data(legacyDatabase);
  legacyDatabase.close();

  const service = new HistoryService();
  expect(await service.getHighscore("", "Scenario A")).toBe(0);
  expect(await service.getHighscore("testuser", "Scenario A")).toBe(1234);
  expect(await service.getLastScores("testuser", "Scenario A")).toEqual([
    { score: 1200, timestamp: 2000 },
    { score: 1100, timestamp: 1000 },
  ]);
  expect(await service.getLastCheckTimestamp()).toBe(9876);
  expect(_getOpenDatabase(service)?.version).toBe(7);

  _getOpenDatabase(service)?.close();
  localStorage.clear();
  await _deleteDatabase();
}

async function _recoversBlockedUpgrade(): Promise<void> {
  await _deleteDatabase();
  const blockingDatabase: IDBDatabase = await _openVersion6Database();
  const service = new HistoryService();

  await expect(service.getHighscore("testuser", "Scenario A")).rejects.toThrow("blocked");
  blockingDatabase.close();
  expect(await service.getHighscore("testuser", "Scenario A")).toBe(0);

  _getOpenDatabase(service)?.close();
  await _deleteDatabase();
}

function _openLegacyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject): void => {
    const request: IDBOpenDBRequest = indexedDB.open(DATABASE_NAME, 5);
    request.onupgradeneeded = (): void => _createLegacyStores(request.result);
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error);
  });
}

function _openVersion3Database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject): void => {
    const request: IDBOpenDBRequest = indexedDB.open(DATABASE_NAME, 3);
    request.onupgradeneeded = (): void => {
      const database: IDBDatabase = request.result;
      database.createObjectStore("Highscores");
      const scores: IDBObjectStore = database.createObjectStore("Scores", {
        keyPath: "id",
        autoIncrement: true,
      });
      scores.createIndex("scenarioName", "scenarioName", { unique: false });
      database.createObjectStore("Metadata");
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error);
  });
}

function _openVersion6Database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject): void => {
    const request: IDBOpenDBRequest = indexedDB.open(DATABASE_NAME, 6);
    request.onupgradeneeded = (): void => {
      _createLegacyStores(request.result);
      request.result.createObjectStore("KovaaksHighscoreCache", {
        keyPath: ["steamId", "benchmarkId"],
      });
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error);
  });
}

function _createLegacyStores(database: IDBDatabase): void {
  const highscores = database.createObjectStore("Highscores", {
    keyPath: ["username", "scenarioName"],
  });
  highscores.createIndex("username", "username", { unique: false });

  const scores = database.createObjectStore("Scores", { keyPath: "id", autoIncrement: true });
  scores.createIndex("scenarioName", "scenarioName", { unique: false });
  scores.createIndex("username", "username", { unique: false });
  scores.createIndex("username_scenario", ["username", "scenarioName"], { unique: false });
  database.createObjectStore("Metadata");
}

function _seedLegacyData(database: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject): void => {
    const transaction = database.transaction(["Highscores", "Scores"], "readwrite");
    transaction.objectStore("Highscores").put({
      username: "testuser",
      scenarioName: "Scenario A",
      score: 1234,
    });
    transaction.objectStore("Scores").add(_scoreRecord(1100, 1000));
    transaction.objectStore("Scores").add(_scoreRecord(1200, 2000));
    transaction.oncomplete = (): void => resolve();
    transaction.onerror = (): void => reject(transaction.error);
  });
}

function _seedVersion3Data(database: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject): void => {
    const transaction = database.transaction(["Highscores", "Scores", "Metadata"], "readwrite");
    transaction.objectStore("Highscores").put(1234, "Scenario A");
    transaction.objectStore("Scores").add(_legacyScoreRecord(1100, 1000));
    transaction.objectStore("Scores").add(_legacyScoreRecord(1200, 2000));
    transaction.objectStore("Metadata").put(9876, "lastCheck");
    transaction.oncomplete = (): void => resolve();
    transaction.onerror = (): void => reject(transaction.error);
  });
}

function _scoreRecord(score: number, timestamp: number): object {
  return { username: "testuser", scenarioName: "Scenario A", score, timestamp };
}

function _legacyScoreRecord(score: number, timestamp: number): object {
  return { scenarioName: "Scenario A", score, timestamp };
}

function _deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject): void => {
    const request: IDBOpenDBRequest = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = (): void => resolve();
    request.onerror = (): void => reject(request.error);
  });
}

function _getOpenDatabase(service: HistoryService): IDBDatabase | null {
  return (service as unknown as { _db: IDBDatabase | null })._db;
}
