/**
 * Edge Function: get-session
 *
 * Retrieves a single test session with its tasks.
 * Prediction data (risk_score, risk_bucket, gemini_explanation) is stored
 * directly on test_sessions — there is no separate predictions table.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. Session ownership is verified by comparing:
 *   test_sessions.user_id === claims.sub (Auth0 subject, e.g. "google-oauth2|...")
 *
 * Expected request:
 *   GET /functions/v1/get-session?session_id=<int>
 *   Authorization: Bearer <auth0_token>
 *
 * Expected response (200):
 *   {
 *     "session": { ... },
 *     "tasks":   [ ... ],
 *     "task_map": { "SUSTAINED_VOWEL": { ... }, "READING": { ... } }
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "get-session";

type TaskRow = {
  id: number;
  session_id: number;
  task_type: "SUSTAINED_VOWEL" | "READING" | string;
  task_status: "PENDING" | "PROCESSING" | "ANALYZED" | "FAILED" | string;
  analysis_json: unknown | null;
  error_code: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  audio_storage_path: string | null;
  created_at?: string;
};

type SessionRow = {
  id: number;
  user_id: string;
  status: string | null;
  prediction: number | null;
  risk_score: number | null;
  risk_bucket: string | null;
  gemini_explanation: string | null;
  device_meta: unknown | null;
  reading_original_text: string | null;
  created_at?: string;
  completed_at?: string | null;
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "GET") {
    return respond({ error: "Method not allowed", request_id: requestId }, 405);
  }

  try {
    // 1) Verify Auth0 JWT and get subject
    const claims = await verifyAuth0Token(req);
    const userSub = claims?.sub;
    if (!userSub) {
      return respond({ error: "Unauthorized: missing subject", request_id: requestId }, 401);
    }

    // 2) Parse session_id from query params (your test_sessions.id is int8)
    const url = new URL(req.url);
    const sessionIdRaw = url.searchParams.get("session_id");

    if (!sessionIdRaw) {
      return respond({ error: "session_id query parameter is required", request_id: requestId }, 400);
    }

    const sessionId = Number(sessionIdRaw);
    if (!Number.isFinite(sessionId)) {
      return respond({ error: "session_id must be a number", request_id: requestId }, 400);
    }

    // 3) Create service-role client for DB reads (ownership enforced manually below)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return respond(
        {
          error: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
          request_id: requestId,
        },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 4) Fetch session by test_sessions.id (NOT session_id)
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select(
        "id, user_id, status, prediction, risk_score, risk_bucket, gemini_explanation, device_meta, reading_original_text, created_at, completed_at"
      )
      .eq("id", sessionId)
      .single<SessionRow>();

    if (sessionError) {
      logError(
        { request_id: requestId, function_name: FUNCTION_NAME, session_id: sessionId, supabase_error: sessionError },
        "Supabase error fetching session"
      );
      return respond({ error: "Session lookup failed", details: sessionError.message, request_id: requestId }, 500);
    }

    if (!session) {
      return respond({ error: "Session not found", request_id: requestId }, 404);
    }

    // 5) Ownership check against Auth0 subject string
    if (session.user_id !== userSub) {
      return respond({ error: "Access denied", request_id: requestId }, 403);
    }

    // 6) Fetch tasks for this session
    const { data: tasks, error: tasksError } = await supabase
      .from("session_tasks")
      .select(
        "id, session_id, task_type, task_status, analysis_json, error_code, error_message, duration_seconds, audio_storage_path, created_at"
      )
      .eq("session_id", sessionId)
      .order("task_type", { ascending: true })
      .returns<TaskRow[]>();

    if (tasksError) {
      logError(
        { request_id: requestId, function_name: FUNCTION_NAME, session_id: sessionId, supabase_error: tasksError },
        "Supabase error fetching tasks"
      );
      return respond({ error: "Task lookup failed", details: tasksError.message, request_id: requestId }, 500);
    }

    // 7) Build task_map
    const task_map: Record<string, TaskRow> = {};
    for (const task of tasks ?? []) {
      task_map[task.task_type] = task;
    }

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userSub,
        session_id: sessionId,
        latency_ms: Date.now() - startTime,
      },
      "Session retrieved"
    );

    return respond({ session, tasks: tasks ?? [], task_map }, 200);
  } catch (err) {
    // If verifyAuth0Token throws "Unauthorized", map to 401
    const message = err instanceof Error ? err.message : String(err);
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;

    logError(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        latency_ms: Date.now() - startTime,
      },
      "Failed to get session",
      err
    );

    return respond({ error: message, request_id: requestId }, status);
  }
});