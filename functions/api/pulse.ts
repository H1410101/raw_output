/**
 * Interface for a single session pulse record.
 */
interface PulseData {
    scenarioName: string;
    bestRank: string;
    bestScore: number;
}

/**
 * Interface for the pulse submission payload.
 */
interface PulsePayload {
    deviceId: string;
    sessionId: string;
    pulses: PulseData[];
}

/**
 * Handle POST requests to submit session telemetry pulses.
 * Inserts best rank data into the Cloudflare D1 database.
 */
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const payload = await context.request.json() as PulsePayload;

        if (!payload.deviceId || !payload.sessionId || !Array.isArray(payload.pulses)) {
            return new Response(JSON.stringify({ error: "Invalid payload structure" }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        const { deviceId, sessionId, pulses } = payload;
        const db = context.env.DB;

        if (!db) {
            throw new Error("Database binding not found");
        }

        // Use a batch insert for efficiency
        const statements = pulses.map(pulse =>
            db.prepare(
                "INSERT INTO session_pulses (session_id, device_id, scenario_name, best_rank, best_score) VALUES (?, ?, ?, ?, ?)"
            ).bind(sessionId, deviceId, pulse.scenarioName, pulse.bestRank, pulse.bestScore)
        );

        await db.batch(statements);

        return new Response(JSON.stringify({ status: "success", count: pulses.length }), {
            status: 201,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
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
