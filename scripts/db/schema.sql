-- Initial schema for session statistics
-- device_hash is a salted SHA-256 hash of the client UUID + salt on the edge.

CREATE TABLE IF NOT EXISTS session_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_name TEXT NOT NULL,
    score REAL NOT NULL,
    rank_level INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stats_scenario ON session_stats(scenario_name);
CREATE INDEX IF NOT EXISTS idx_stats_device ON session_stats(device_hash);

-- Telemetry for session-level "Best Ranks" achieved per difficulty
CREATE TABLE IF NOT EXISTS session_pulses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    best_rank TEXT NOT NULL,
    best_score REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pulses_session ON session_pulses(session_id);
CREATE INDEX IF NOT EXISTS idx_pulses_device ON session_pulses(device_id);
