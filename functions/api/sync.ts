/**
 * Interface for a single benchmark or ranked run performance record.
 */
interface RunData {
    scenarioName: string;
    bestScore: number;
    // Optional detailed ranked run data
    isRankedRun?: boolean;
    targetRankUnits?: number;
    endRankUnits?: number;
    highscoreRankUnits?: number;
    scores?: number[]; // [score1, score2, score3]
}

/**
 * Interface for the synchronization payload.
 */
interface SyncPayload {
    deviceId: string;
    sessionId: string;
    sessionDate: string;
    isRanked: boolean;
    rankedSessionId?: number | null;
    difficulty?: string | null;
    triedAll?: boolean;
    runs: RunData[];
}

/**
 * Handle POST requests to synchronize session data.
 * Updates benchmark_sessions, benchmark_runs, ranked_sessions, and ranked_runs.
 */
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const payload = await context.request.json() as SyncPayload;
        const db = context.env.DB;

        if (!db) {
            throw new Error("Database binding not found");
        }

        const { deviceId, sessionId, sessionDate, isRanked, rankedSessionId, difficulty, triedAll, runs } = payload;
        const statements: D1PreparedStatement[] = [];

        // 1. Ensure benchmark session exists (upsert)
        statements.push(db.prepare(
            `INSERT INTO benchmark_sessions (device_id, session_id, session_date)
             VALUES (?, ?, ?)
             ON CONFLICT(device_id, session_id) DO UPDATE SET session_date = excluded.session_date`
        ).bind(deviceId, sessionId, sessionDate));

        // 2. Insert highscores into benchmark_runs
        const isRankedModeVal = isRanked ? 1 : 0;
        runs.forEach(run => {
            statements.push(db.prepare(
                `INSERT INTO benchmark_runs (device_id, session_id, scenario_name, best_score, is_ranked_mode)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(device_id, session_id, scenario_name) DO UPDATE SET 
                    best_score = MAX(best_score, excluded.best_score),
                    is_ranked_mode = MAX(is_ranked_mode, excluded.is_ranked_mode)`
            ).bind(deviceId, sessionId, run.scenarioName, run.bestScore, isRankedModeVal));
        });

        // 3. If this involves a Ranked Session, update ranked metadata and runs
        if (isRanked && rankedSessionId && difficulty) {
            const triedAllVal = triedAll ? 1 : 0;
            statements.push(db.prepare(
                `INSERT INTO ranked_sessions (device_id, ranked_session_id, session_date, difficulty, tried_all)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(device_id, ranked_session_id) DO UPDATE SET tried_all = excluded.tried_all`
            ).bind(deviceId, rankedSessionId, sessionDate, difficulty, triedAllVal));

            runs.forEach(run => {
                if (run.isRankedRun) {
                    const s1 = run.scores?.[0] ?? null;
                    const s2 = run.scores?.[1] ?? null;
                    const s3 = run.scores?.[2] ?? null;

                    statements.push(db.prepare(
                        `INSERT INTO ranked_runs (device_id, ranked_session_id, scenario_name, score_1, score_2, score_3, target_rankunits, end_rankunits, highscore_rankunits)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(device_id, ranked_session_id, scenario_name) DO UPDATE SET
                            score_1 = excluded.score_1,
                            score_2 = excluded.score_2,
                            score_3 = excluded.score_3,
                            target_rankunits = excluded.target_rankunits,
                            end_rankunits = excluded.end_rankunits,
                            highscore_rankunits = excluded.highscore_rankunits`
                    ).bind(deviceId, rankedSessionId, run.scenarioName, s1, s2, s3, run.targetRankUnits ?? null, run.endRankUnits ?? null, run.highscoreRankUnits ?? null));
                }
            });
        }

        await db.batch(statements);

        return new Response(JSON.stringify({ status: "success", count: runs.length }), {
            status: 201,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    } catch (error) {
        console.error("Sync API Error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
};

/**
 * Handle OPTIONS requests for CORS preflight.
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
