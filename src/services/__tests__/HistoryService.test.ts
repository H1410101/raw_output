import { describe, expect, it, vi } from "vitest";
import { HistoryService } from "../HistoryService";

describe("HistoryService Kovaaks Score Recording", (): void => {
    it("refreshes imports without reporting them as local activity", async (): Promise<void> => {
        const service = new HistoryService();
        const refreshListener = vi.fn();
        const activityListener = vi.fn();
        service.onScoreRecorded(refreshListener);
        service.onScoreRecorded(activityListener, { includeImported: false });

        await service.recordKovaaksScores("testuser", "Scenario A", [
            { score: 100, date: "2000000" },
            { score: 200, date: "3000000" }
        ]);

        expect(refreshListener).toHaveBeenCalledOnce();
        expect(refreshListener).toHaveBeenCalledWith("Scenario A");
        expect(activityListener).not.toHaveBeenCalled();
    });
});
