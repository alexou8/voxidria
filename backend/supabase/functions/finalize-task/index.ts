/**
 * Edge Function: finalize-task
 *
 * Purpose:
 *   Called after the client has uploaded audio to Supabase Storage.
 *   Marks the task as uploaded, then for READING tasks, runs the
 *   Gemini reading analysis and stores the result in analysis_json.
 *   Optionally triggers ML inference for SUSTAINED_VOWEL and DDK tasks
 *   via an optional inference microservice.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. Session ownership is verified.
 *
 * Expected request:
 *   POST /functions/v1/finalize-task
 *   Content-Type: application/json
 *   Authorization: Bearer <auth0_token>
 *   Body: {
 *     "session_id": "<uuid>",
 *     "task_type": "READING",
 *     "transcript_text": "The rainbow is a...",
 *     "transcript_words": [{ "word": "the", "start_ms": 0, "end_ms": 250 }]  // optional
 *   }
 *
 * Expected response (200):
 *   { "task_status": "ANALYZED", "analysis_json": { ... } }
 *
 * Secrets used (server-side only):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — server-side only.
 *   GEMINI_API_KEY — server-side only, used for READING analysis.
 *   INFERENCE_SERVICE_URL, INFERENCE_SHARED_SECRET — optional microservice.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";
import { analyzeReading } from "../_shared/gemini/readingAnalysis.ts";
import type { TaskType } from "../_shared/types/index.ts";

const FUNCTION_NAME = "finalize-task";
const ALLOWED_TASK_TYPES: TaskType[] = ["SUSTAINED_VOWEL", "READING", "DDK"];

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

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const claims = await verifyAuth0Token(req);
    const userId = claims.sub;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid JSON body" }, 400);
    }

    const { session_id, task_type, transcript_text, transcript_words } = body;

    // Input validation
    if (!session_id || typeof session_id !== "string") {
      return respond({ error: "session_id is required" }, 400);
    }
    if (!task_type || !ALLOWED_TASK_TYPES.includes(task_type as TaskType)) {
      return respond({ error: `task_type must be one of: ${ALLOWED_TASK_TYPES.join(", ")}` }, 400);
    }
    if (!transcript_text || typeof transcript_text !== "string") {
      return respond({ error: "transcript_text is required (string)" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check: verify session belongs to this user
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("session_id, user_id, reading_original_text, status")
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return respond({ error: "Session not found or access denied" }, 404);
    }

    // Update task with transcript and mark as UPLOADED
    const { error: taskUpdateError } = await supabase
      .from("session_tasks")
      .update({
        transcript_text,
        transcript_words: transcript_words ?? null,
        task_status: "UPLOADED",
      })
      .eq("session_id", session_id)
      .eq("task_type", task_type);

    if (taskUpdateError) throw taskUpdateError;

    // Update session to PROCESSING while we run analysis
    await supabase
      .from("test_sessions")
      .update({ status: "PROCESSING" })
      .eq("session_id", session_id);

    let analysisJson: unknown = null;
    let finalTaskStatus = "UPLOADED";

    // -------------------------------------------------------------------------
    // READING task: run Gemini reading analysis
    // Compares user transcript to the original passage for alignment + fluency.
    // GEMINI_API_KEY is server-side only — never exposed to the client.
    // -------------------------------------------------------------------------
    if (task_type === "READING") {
      if (!session.reading_original_text) {
        return respond({ error: "Session has no reading_original_text stored" }, 400);
      }

      try {
        analysisJson = await analyzeReading({
          original_text: session.reading_original_text,
          transcript_text,
          transcript_words: transcript_words as Array<{ word: string; start_ms: number; end_ms: number }> | undefined,
        });
        finalTaskStatus = "ANALYZED";
      } catch (geminiErr) {
        logError(
          { request_id: requestId, function_name: FUNCTION_NAME, user_id: userId, session_id },
          "Gemini reading analysis failed",
          geminiErr
        );
        finalTaskStatus = "FAILED";
      }

      // Store analysis result
      await supabase
        .from("session_tasks")
        .update({ analysis_json: analysisJson, task_status: finalTaskStatus })
        .eq("session_id", session_id)
        .eq("task_type", task_type);
    }

    // -------------------------------------------------------------------------
    // SUSTAINED_VOWEL / DDK tasks: call optional inference microservice
    // If INFERENCE_SERVICE_URL is not configured, we skip ML inference.
    // INFERENCE_SHARED_SECRET is a pre-shared key so the microservice
    // knows the request came from our Edge Function, not an arbitrary caller.
    // -------------------------------------------------------------------------
    if (task_type === "SUSTAINED_VOWEL" || task_type === "DDK") {
      const inferenceUrl = Deno.env.get("INFERENCE_SERVICE_URL");
      if (inferenceUrl) {
        try {
          const inferenceResponse = await fetch(`${inferenceUrl}/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Shared secret authenticates this Edge Function to the microservice.
              // It must match INFERENCE_SHARED_SECRET on the microservice side.
              "X-Inference-Secret": Deno.env.get("INFERENCE_SHARED_SECRET") ?? "",
            },
            body: JSON.stringify({
              session_id,
              task_type,
              audio_path: `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/audio/${userId}/${session_id}/${task_type}`,
            }),
          });

          if (!inferenceResponse.ok) {
            throw new Error(`Inference service returned ${inferenceResponse.status}`);
          }

          // Inference service handles storing the prediction row
          finalTaskStatus = "ANALYZED";
          await supabase
            .from("session_tasks")
            .update({ task_status: "ANALYZED" })
            .eq("session_id", session_id)
            .eq("task_type", task_type);
        } catch (inferErr) {
          logError(
            { request_id: requestId, function_name: FUNCTION_NAME, user_id: userId, session_id },
            "Inference service call failed",
            inferErr
          );
          await supabase
            .from("session_tasks")
            .update({ task_status: "FAILED" })
            .eq("session_id", session_id)
            .eq("task_type", task_type);
          finalTaskStatus = "FAILED";
        }
      } else {
        // No inference service configured — mark as UPLOADED (not yet analyzed)
        finalTaskStatus = "UPLOADED";
      }
    }

    // Check if all tasks are now in a terminal state to mark session DONE
    const { data: allTasks } = await supabase
      .from("session_tasks")
      .select("task_status")
      .eq("session_id", session_id);

    const allDone = allTasks?.every(
      (t) => t.task_status === "ANALYZED" || t.task_status === "FAILED"
    );

    if (allDone) {
      const anyFailed = allTasks?.some((t) => t.task_status === "FAILED");
      await supabase
        .from("test_sessions")
        .update({ status: anyFailed ? "FAILED" : "DONE" })
        .eq("session_id", session_id);
    }

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        session_id,
        latency_ms: Date.now() - startTime,
      },
      `Task finalized: ${task_type} → ${finalTaskStatus}`
    );

    return respond(
      {
        task_status: finalTaskStatus,
        analysis_json: analysisJson,
      },
      200
    );
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to finalize task",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
