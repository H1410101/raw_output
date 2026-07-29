import { describe, expect, test } from "vitest";
import { ScoreEntry, ScoreProcessor } from "../ScoreProcessor";

describe("ScoreProcessor", (): void => {
    test("preserves the characterized finite score selection", (): void => {
        const entries: ScoreEntry[] = Array.from(
            { length: 25 },
            (_value: unknown, index: number): ScoreEntry => ({
                score: index === 24 ? 150 : 100 - index,
                timestamp: 1000 - index,
            }),
        );

        const processed: ScoreEntry[] = ScoreProcessor.processTemporalScores(entries);

        expect(processed).toEqual([...entries.slice(0, 20), entries[24]]);
    });

    test("filters non-finite scores and timestamps", (): void => {
        const finiteEntries: ScoreEntry[] = [
            { score: 100, timestamp: 1000 },
            { score: 90, timestamp: 900 },
        ];
        const entries: ScoreEntry[] = [
            finiteEntries[0],
            { score: Infinity, timestamp: 950 },
            { score: -Infinity, timestamp: 940 },
            { score: Number.NaN, timestamp: 930 },
            finiteEntries[1],
            { score: 80, timestamp: Infinity },
            { score: 70, timestamp: -Infinity },
            { score: 60, timestamp: Number.NaN },
        ];

        expect(ScoreProcessor.processTemporalScores(entries)).toEqual(finiteEntries);
    });
});
