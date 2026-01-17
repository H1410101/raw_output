-- Migration: Initial Schema Consolidation (Consolidated Composite Keys)
-- Date: 2024-05-24
-- Description: Unified schema for Benchmark and Ranked tracking with all-composite primary keys.

-- 1. Benchmark Sessions (Metadata)
CREATE TABLE benchmark_sessions (
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_date TEXT NOT NULL,
    PRIMARY KEY (device_id, session_id)
);

-- 2. Benchmark Runs (Highscores)
CREATE TABLE benchmark_runs (
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    best_score REAL NOT NULL,
    is_ranked_mode INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, session_id, scenario_name),
    FOREIGN KEY(device_id, session_id) REFERENCES benchmark_sessions(device_id, session_id)
);

-- 3. Ranked Sessions (Gauntlet Metadata)
CREATE TABLE ranked_sessions (
    device_id TEXT NOT NULL,
    ranked_session_id INTEGER NOT NULL,
    session_date TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    tried_all INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, ranked_session_id)
);

-- 4. Ranked Runs (Attempt Details)
CREATE TABLE ranked_runs (
    device_id TEXT NOT NULL,
    ranked_session_id INTEGER NOT NULL,
    scenario_name TEXT NOT NULL,
    score_1 REAL,
    score_2 REAL,
    score_3 REAL,
    target_rankunits REAL,
    end_rankunits REAL,
    highscore_rankunits REAL,
    PRIMARY KEY (device_id, ranked_session_id, scenario_name),
    FOREIGN KEY(device_id, ranked_session_id) REFERENCES ranked_sessions(device_id, ranked_session_id)
);

-- Indices for performance
CREATE INDEX idx_benchmark_runs_scenario ON benchmark_runs(scenario_name);
CREATE INDEX idx_ranked_runs_composite ON ranked_runs(device_id, ranked_session_id);
