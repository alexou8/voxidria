/**
 * Shared TypeScript types for Voxidria Edge Functions.
 * These mirror the database schema in 001_initial_schema.sql.
 */

export type TaskType = "SUSTAINED_VOWEL" | "READING" | "DDK";
export type TaskStatus = "PENDING" | "UPLOADED" | "ANALYZED" | "FAILED";
export type SessionStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export type RiskBucket = "LOW" | "MODERATE" | "HIGH";

export interface User {
  user_id: string;
  email: string | null;
  created_at: string;
  consent_version_accepted: string | null;
  region: string | null;
}

export interface TestSession {
  session_id: string;
  user_id: string;
  created_at: string;
  status: SessionStatus;
  device_meta: Record<string, unknown> | null;
  reading_original_text: string | null;
  retention_opt_in: boolean;
}

export interface SessionTask {
  task_id: string;
  session_id: string;
  task_type: TaskType;
  audio_path: string | null;
  transcript_text: string | null;
  transcript_words: unknown | null;
  task_status: TaskStatus;
  analysis_json: unknown | null;
}

export interface Prediction {
  prediction_id: string;
  session_id: string;
  model_version: string;
  risk_score: number;
  risk_bucket: RiskBucket;
  quality_flags: Record<string, boolean> | null;
  feature_summary: Record<string, number> | null;
  gemini_explanation: string | null;
  created_at: string;
}

/** Standard error response shape */
export interface ErrorResponse {
  error: string;
  request_id?: string;
}
