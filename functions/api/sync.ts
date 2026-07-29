import {
    isSessionSyncPayload,
    SESSION_SYNC_LIMITS,
    type SessionSyncPayload,
    type SessionSyncRun,
} from "../../src/types/SessionSyncTypes";

const JSON_CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
};
const BENCHMARK_RUNS_PER_STATEMENT = 20;
const RANKED_RUNS_PER_STATEMENT = 11;

class SyncRequestError extends Error {
    public readonly status: 400 | 413;

    public constructor(status: 400 | 413) {
        super("Invalid sync request");
        this.status = status;
    }
}

interface RankedSyncPayload extends SessionSyncPayload {
    readonly rankedSessionId: number;
    readonly difficulty: string;
}

/**
 * Handles POST requests that synchronize bounded session telemetry.
 */
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const payload = _parsePayload(await _readBoundedBody(context.request));
        const database = context.env.DB;

        if (!database) {
            throw new Error("Database binding not found");
        }

        await database.batch(_buildStatements(database, payload));

        return _jsonResponse({ status: "success", count: payload.runs.length }, 201);
    } catch (error) {
        if (error instanceof SyncRequestError) {
            const message = error.status === 413 ? "Payload too large" : "Invalid request body";

            return _jsonResponse({ error: message }, error.status);
        }

        console.error("Sync API Error:", error);

        return _jsonResponse({ error: "Internal server error" }, 500);
    }
};

async function _readBoundedBody(request: Request): Promise<string> {
    const contentLength = request.headers.get("Content-Length");
    if (contentLength !== null && /^\d+$/.test(contentLength) &&
        Number(contentLength) > SESSION_SYNC_LIMITS.requestBodyBytes) {
        throw new SyncRequestError(413);
    }

    if (request.body === null) {
        return "";
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteCount = 0;

    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;

            byteCount += chunk.value.byteLength;
            if (byteCount > SESSION_SYNC_LIMITS.requestBodyBytes) {
                await reader.cancel().catch((): void => undefined);
                throw new SyncRequestError(413);
            }

            chunks.push(chunk.value);
        }
    } catch (error) {
        if (error instanceof SyncRequestError) throw error;
        throw new SyncRequestError(400);
    }

    const bodyBytes = new Uint8Array(byteCount);
    let offset = 0;
    for (const chunk of chunks) {
        bodyBytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
    } catch {
        throw new SyncRequestError(400);
    }
}

function _parsePayload(body: string): SessionSyncPayload {
    let value: unknown;

    try {
        value = JSON.parse(body) as unknown;
    } catch {
        throw new SyncRequestError(400);
    }

    if (!isSessionSyncPayload(value)) {
        throw new SyncRequestError(400);
    }

    return value;
}

function _buildStatements(database: D1Database, payload: SessionSyncPayload): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [_buildBenchmarkSessionStatement(database, payload)];
    statements.push(..._buildBenchmarkRunStatements(database, payload));

    if (_hasRankedMetadata(payload)) {
        statements.push(_buildRankedSessionStatement(database, payload));
        statements.push(..._buildRankedRunStatements(database, payload));
    }

    return statements;
}

function _buildBenchmarkSessionStatement(
    database: D1Database,
    payload: SessionSyncPayload,
): D1PreparedStatement {
    return database.prepare(
        `INSERT INTO benchmark_sessions (device_id, session_id, session_date)
         VALUES (?, ?, ?)
         ON CONFLICT(device_id, session_id) DO NOTHING`
    ).bind(payload.deviceId, payload.sessionId, payload.sessionDate);
}

function _buildBenchmarkRunStatements(
    database: D1Database,
    payload: SessionSyncPayload,
): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [];

    for (let offset = 0; offset < payload.runs.length; offset += BENCHMARK_RUNS_PER_STATEMENT) {
        const runs = payload.runs.slice(offset, offset + BENCHMARK_RUNS_PER_STATEMENT);
        const values: (string | number)[] = [];

        for (const run of runs) {
            values.push(
                payload.deviceId,
                payload.sessionId,
                run.scenarioName,
                run.bestScore,
                run.isRankedRun === true ? 1 : 0,
            );
        }

        statements.push(database.prepare(
            `INSERT INTO benchmark_runs (device_id, session_id, scenario_name, best_score, is_ranked_mode)
             VALUES ${_buildPlaceholders(runs.length, 5)}
             ON CONFLICT(device_id, session_id, scenario_name) DO UPDATE SET
                best_score = MAX(best_score, excluded.best_score),
                is_ranked_mode = MAX(is_ranked_mode, excluded.is_ranked_mode)`
        ).bind(...values));
    }

    return statements;
}

function _hasRankedMetadata(payload: SessionSyncPayload): payload is RankedSyncPayload {
    return payload.isRanked && typeof payload.rankedSessionId === "number" &&
        typeof payload.difficulty === "string";
}

function _buildRankedSessionStatement(
    database: D1Database,
    payload: RankedSyncPayload,
): D1PreparedStatement {
    return database.prepare(
        `INSERT INTO ranked_sessions (device_id, ranked_session_id, session_date, difficulty, tried_all)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(device_id, ranked_session_id) DO UPDATE SET
            tried_all = MAX(tried_all, excluded.tried_all)`
    ).bind(
        payload.deviceId,
        payload.rankedSessionId,
        payload.sessionDate,
        payload.difficulty,
        payload.triedAll ? 1 : 0,
    );
}

function _buildRankedRunStatements(
    database: D1Database,
    payload: RankedSyncPayload,
): D1PreparedStatement[] {
    const rankedRuns = payload.runs.filter((run: SessionSyncRun): boolean => run.isRankedRun === true);
    const statements: D1PreparedStatement[] = [];

    for (let offset = 0; offset < rankedRuns.length; offset += RANKED_RUNS_PER_STATEMENT) {
        const runs = rankedRuns.slice(offset, offset + RANKED_RUNS_PER_STATEMENT);
        const values: (string | number | null)[] = [];

        for (const run of runs) {
            values.push(
                payload.deviceId,
                payload.rankedSessionId,
                run.scenarioName,
                run.scores?.[0] ?? null,
                run.scores?.[1] ?? null,
                run.scores?.[2] ?? null,
                run.targetRankUnits ?? null,
                run.endRankUnits ?? null,
                run.highscoreRankUnits ?? null,
            );
        }

        statements.push(database.prepare(
            `INSERT INTO ranked_runs (device_id, ranked_session_id, scenario_name, score_1, score_2, score_3, target_rankunits, end_rankunits, highscore_rankunits)
             VALUES ${_buildPlaceholders(runs.length, 9)}
             ON CONFLICT(device_id, ranked_session_id, scenario_name) DO UPDATE SET
                score_1 = excluded.score_1,
                score_2 = excluded.score_2,
                score_3 = excluded.score_3,
                target_rankunits = excluded.target_rankunits,
                end_rankunits = excluded.end_rankunits,
                highscore_rankunits = excluded.highscore_rankunits`
        ).bind(...values));
    }

    return statements;
}

function _buildPlaceholders(rowCount: number, columnCount: number): string {
    const row = `(${Array.from({ length: columnCount }, (): string => "?").join(", ")})`;

    return Array.from({ length: rowCount }, (): string => row).join(", ");
}

function _jsonResponse(body: Record<string, string | number>, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: JSON_CORS_HEADERS,
    });
}

/**
 * Handles CORS preflight requests for the sync endpoint.
 */
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
};
