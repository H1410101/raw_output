/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it } from "vitest";
import { HistoryService } from "../HistoryService";

describe("HistoryService profile deletion", (): void => {
  it("removes scores, highscores, and Steam benchmark cache atomically", async (): Promise<void> => {
    const service = new HistoryService();
    await service.updateHighscore("testuser", "Scenario A", 1200);
    await service.recordKovaaksScores("testuser", "Scenario A", [
      { score: 1100, date: "1000" },
    ]);
    await service.cacheKovaaksHighscores("steam-1", "benchmark-1", { category: {} });

    await service.deletePlayerData("testuser", "steam-1");

    expect(await service.getHighscore("testuser", "Scenario A")).toBe(0);
    expect(await service.getLastScores("testuser", "Scenario A")).toEqual([]);
    expect(await service.getCachedKovaaksHighscores("steam-1", "benchmark-1")).toBeNull();

    (service as unknown as { _db: IDBDatabase | null })._db?.close();
  });
});
