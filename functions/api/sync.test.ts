import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestOptions, onRequestPost } from "./sync";
import { SESSION_SYNC_LIMITS, type SessionSyncPayload } from "../../src/types/SessionSyncTypes";

interface MockStatement {
    readonly sql: string;
    readonly values: readonly unknown[];
}

interface MockDatabase {
    readonly prepare: ReturnType<typeof vi.fn>;
    readonly batch: ReturnType<typeof vi.fn>;
}

type SyncPostHandler = (context: {
    readonly request: Request;
    readonly env: { readonly DB: MockDatabase | undefined };
}) => Promise<Response>;

const postSync = onRequestPost as unknown as SyncPostHandler;

describe("sync endpoint validation", (): void => {
    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("returns 400 for malformed JSON without touching D1", async (): Promise<void> => {
        const database = _createDatabase();
        const response = await _sendBody("{not-json", database);

        expect(response.status).toBe(400);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(await response.json()).toEqual({ error: "Invalid request body" });
        expect(database.prepare).not.toHaveBeenCalled();
        expect(database.batch).not.toHaveBeenCalled();
    });

    it.each(_invalidPayloads())("returns 400 for %s", async (_label, payload): Promise<void> => {
        const database = _createDatabase();
        const response = await _sendBody(JSON.stringify(payload), database);

        expect(response.status).toBe(400);
        expect(database.prepare).not.toHaveBeenCalled();
        expect(database.batch).not.toHaveBeenCalled();
    });

    it("returns 413 when the streamed body exceeds the byte cap", async (): Promise<void> => {
        const database = _createDatabase();
        const oversizedBody = "x".repeat(SESSION_SYNC_LIMITS.requestBodyBytes + 1);
        const response = await _sendBody(oversizedBody, database);

        expect(response.status).toBe(413);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(await response.json()).toEqual({ error: "Payload too large" });
        expect(database.prepare).not.toHaveBeenCalled();
    });
});

describe("sync endpoint persistence", (): void => {
    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it("preserves the payload response with a bounded maximum-size statement batch", async (): Promise<void> => {
        const database = _createDatabase();
        const payload = _validPayload(SESSION_SYNC_LIMITS.runs);
        const response = await _sendBody(JSON.stringify(payload), database);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ status: "success", count: SESSION_SYNC_LIMITS.runs });
        expect(database.batch).toHaveBeenCalledTimes(1);

        const statements = database.batch.mock.calls[0][0] as MockStatement[];
        expect(statements).toHaveLength(21);
        expect(statements.every((statement: MockStatement): boolean => statement.values.length <= 100)).toBe(true);
        expect(statements.filter((statement: MockStatement): boolean =>
            statement.sql.includes("INSERT INTO benchmark_runs"))).toHaveLength(7);
        expect(statements.filter((statement: MockStatement): boolean =>
            statement.sql.includes("INSERT INTO ranked_runs"))).toHaveLength(12);
    });

    it("persists mixed ranked flags per run with immutable and monotonic session upserts", async (): Promise<void> => {
        const database = _createDatabase();
        const rankedRun = _validPayload().runs[0];
        const payload: SessionSyncPayload = {
            ..._validPayload(),
            runs: [
                rankedRun,
                { scenarioName: "Ordinary Scenario", bestScore: 2000 },
            ],
        };

        const response = await _sendBody(JSON.stringify(payload), database);

        expect(response.status).toBe(201);
        const statements = database.batch.mock.calls[0][0] as MockStatement[];
        const benchmarkSession = statements.find((statement: MockStatement): boolean =>
            statement.sql.includes("INSERT INTO benchmark_sessions"));
        const benchmarkRuns = statements.find((statement: MockStatement): boolean =>
            statement.sql.includes("INSERT INTO benchmark_runs"));
        const rankedSession = statements.find((statement: MockStatement): boolean =>
            statement.sql.includes("INSERT INTO ranked_sessions"));

        expect(benchmarkSession?.sql).toContain("DO NOTHING");
        expect(benchmarkRuns?.values).toEqual([
            payload.deviceId, payload.sessionId, rankedRun.scenarioName, rankedRun.bestScore, 1,
            payload.deviceId, payload.sessionId, "Ordinary Scenario", 2000, 0,
        ]);
        expect(rankedSession?.sql).toContain("MAX(tried_all, excluded.tried_all)");
    });

    it("returns a generic 500 without exposing database errors", async (): Promise<void> => {
        const database = _createDatabase();
        database.batch.mockRejectedValueOnce(new Error("private D1 failure detail"));
        vi.spyOn(console, "error").mockImplementation((): void => undefined);

        const response = await _sendBody(JSON.stringify(_validPayload()), database);

        expect(response.status).toBe(500);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(await response.json()).toEqual({ error: "Internal server error" });
    });

    it("keeps the existing CORS preflight contract", async (): Promise<void> => {
        const handler = onRequestOptions as unknown as () => Promise<Response>;
        const response = await handler();

        expect(response.status).toBe(204);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
        expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    });
});

function _createDatabase(): MockDatabase {
    const prepare = vi.fn((sql: string): { bind: (...values: unknown[]) => MockStatement } => ({
        bind: (...values: unknown[]): MockStatement => ({ sql, values }),
    }));
    const batch = vi.fn().mockResolvedValue([]);

    return { prepare, batch };
}

async function _sendBody(body: string, database: MockDatabase): Promise<Response> {
    const request = new Request("https://raw-output.example/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

    return postSync({ request, env: { DB: database } });
}

function _validPayload(runCount: number = 1): SessionSyncPayload {
    return {
        deviceId: "anonymous-device",
        sessionId: "session-123",
        sessionDate: "2026-07-29",
        isRanked: true,
        rankedSessionId: 1_753_747_200_000,
        difficulty: "Medium",
        triedAll: true,
        runs: Array.from({ length: runCount }, (_, index: number) => ({
            scenarioName: `Scenario ${index}`,
            bestScore: 1000 + index,
            isRankedRun: true,
            targetRankUnits: 1.5,
            endRankUnits: 2.5,
            highscoreRankUnits: 3.5,
            scores: [900 + index, 950 + index, 1000 + index],
        })),
    };
}

function _invalidPayloads(): [string, unknown][] {
    const payload = _validPayload();

    return [
        ["a non-object payload", null],
        ["an impossible session date", { ...payload, sessionDate: "2026-02-30" }],
        ["an overlong device ID", { ...payload, deviceId: "d".repeat(SESSION_SYNC_LIMITS.deviceIdLength + 1) }],
        ["too many runs", { ...payload, runs: Array.from({ length: SESSION_SYNC_LIMITS.runs + 1 }, () => payload.runs[0]) }],
        ["too many attempt scores", { ...payload, runs: [{ ...payload.runs[0], scores: [1, 2, 3, 4] }] }],
        ["a non-finite score", { ...payload, runs: [{ ...payload.runs[0], bestScore: Number.NaN }] }],
        ["an out-of-range score", { ...payload, runs: [{ ...payload.runs[0], bestScore: SESSION_SYNC_LIMITS.absoluteNumber + 1 }] }],
        ["an unsafe ranked session ID", { ...payload, rankedSessionId: Number.MAX_SAFE_INTEGER + 1 }],
        ["ranked metadata without a session ID", { ...payload, rankedSessionId: undefined }],
        ["ranked metadata without a difficulty", { ...payload, difficulty: undefined }],
        ["ranked metadata without a completion flag", { ...payload, triedAll: undefined }],
        ["ranked payload without a ranked run", {
            ...payload,
            runs: [{ scenarioName: "Ordinary Scenario", bestScore: 1000 }],
        }],
        ["ranked run without complete units", {
            ...payload,
            runs: [{ ...payload.runs[0], endRankUnits: undefined }],
        }],
        ["ranked run without attempt scores", {
            ...payload,
            runs: [{ ...payload.runs[0], scores: [] }],
        }],
        ["ranked detail on a non-ranked payload", {
            ...payload,
            isRanked: false,
            rankedSessionId: undefined,
            difficulty: undefined,
            triedAll: undefined,
        }],
        ["ranked detail without a ranked-run marker", {
            ...payload,
            runs: [{ ...payload.runs[0], isRankedRun: false }],
        }],
        ["ranked top-level metadata on a non-ranked payload", {
            ...payload,
            isRanked: false,
            runs: [{ scenarioName: "Ordinary Scenario", bestScore: 1000 }],
        }],
    ];
}
