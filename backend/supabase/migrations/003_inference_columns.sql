-- =============================================================================
-- Voxidria: Inference Service Support Columns
-- =============================================================================
-- Migration: 003_inference_columns
-- Description: Adds task lifecycle states and metadata columns required by
--              the Python inference microservice (PROCESSING, REJECTED_SHORT_AUDIO,
--              duration_ms, error_code, error_message).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend the task_status check constraint on session_tasks
-- ---------------------------------------------------------------------------
ALTER TABLE session_tasks
  DROP CONSTRAINT IF EXISTS session_tasks_task_status_check;

ALTER TABLE session_tasks
  ADD CONSTRAINT session_tasks_task_status_check
  CHECK (task_status IN (
    'PENDING',
    'UPLOADED',
    'PROCESSING',
    'ANALYZED',
    'FAILED',
    'REJECTED_SHORT_AUDIO'
  ));

-- ---------------------------------------------------------------------------
-- New columns on session_tasks
-- ---------------------------------------------------------------------------
ALTER TABLE session_tasks
  ADD COLUMN IF NOT EXISTS duration_ms    FLOAT   NULL,  -- audio duration in milliseconds
  ADD COLUMN IF NOT EXISTS error_code     TEXT    NULL,  -- e.g. AUDIO_TOO_SHORT, PIPELINE_ERROR
  ADD COLUMN IF NOT EXISTS error_message  TEXT    NULL;  -- human-readable error detail
