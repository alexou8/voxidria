-- =============================================================================
-- Voxidria: Initial Database Schema
-- =============================================================================
-- Migration: 001_initial_schema
-- Description: Creates core tables for users, test sessions, tasks, and
--              predictions used by the Parkinson's speech-risk screening flow.
--
-- Delete cascade is intentional: "delete my data" must remove all associated
-- rows (sessions, tasks, predictions) when a user is deleted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- Source of truth for identity is Auth0. user_id = Auth0 'sub' claim.
-- We upsert on every login so email stays current.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id                  TEXT        PRIMARY KEY,
  email                    TEXT        NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version_accepted TEXT        NULL,
  region                   TEXT        NULL
);

-- ---------------------------------------------------------------------------
-- test_sessions
-- One row per screening attempt. Audio files for all tasks within a session
-- share the session_id in their storage paths.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_sessions (
  session_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                TEXT        NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','PROCESSING','DONE','FAILED')),
  device_meta           JSONB       NULL,
  reading_original_text TEXT        NULL,  -- the passage shown to the user for this session
  retention_opt_in      BOOLEAN     NOT NULL DEFAULT false  -- if false, audio deleted after inference
);

-- Efficient lookup of a user's sessions ordered by recency
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_created
  ON test_sessions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- session_tasks
-- One row per task per session (SUSTAINED_VOWEL, READING, DDK).
-- Extensible: add new task_type values without schema changes.
-- audio_path is the Supabase Storage object path (NOT a public URL).
-- analysis_json stores Gemini reading analysis for READING tasks.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_tasks (
  task_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES test_sessions(session_id) ON DELETE CASCADE,
  task_type        TEXT        NOT NULL
                     CHECK (task_type IN ('SUSTAINED_VOWEL','READING','DDK')),
  audio_path       TEXT        NULL,
  transcript_text  TEXT        NULL,
  transcript_words JSONB       NULL,   -- optional word-level timestamps [{word, start_ms, end_ms}]
  task_status      TEXT        NOT NULL DEFAULT 'PENDING'
                     CHECK (task_status IN ('PENDING','UPLOADED','ANALYZED','FAILED')),
  analysis_json    JSONB       NULL    -- populated by Gemini for READING tasks
);

CREATE INDEX IF NOT EXISTS idx_session_tasks_session_id
  ON session_tasks (session_id);

-- ---------------------------------------------------------------------------
-- predictions
-- ML inference output for a session. A session may have one prediction row
-- (or more if re-run with a different model version).
-- gemini_explanation is the plain-language text returned by Gemini.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  prediction_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES test_sessions(session_id) ON DELETE CASCADE,
  model_version     TEXT        NOT NULL,
  risk_score        INT         NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_bucket       TEXT        NOT NULL CHECK (risk_bucket IN ('LOW','MODERATE','HIGH')),
  quality_flags     JSONB       NULL,   -- e.g. {"background_noise": true, "too_short": false}
  feature_summary   JSONB       NULL,   -- e.g. {"jitter": 0.012, "shimmer": 0.08, "hnr": 18.4}
  gemini_explanation TEXT       NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictions_session_id
  ON predictions (session_id);
