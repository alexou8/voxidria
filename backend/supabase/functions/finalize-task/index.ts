/**
 * Edge Function: finalize-task
 *
 * Called after the client uploads audio to Supabase Storage.
 * Marks the task UPLOADED, then calls the Python inference microservice
 * which handles all analysis (ML for vowel, biomarkers for reading).
 *
 * After the inference service responds, if both tasks are now ANALYZED,
 * this function triggers /generate-summary on the inference service so
 * Gemini produces the full-session explanation.
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
 *     "task_type": "SUSTAINED_VOWEL" | "READING",
 *     "language_code": "en"          // optional, defaults to "en"
 *   }
 *
 * Expected response (200):
 *   { "task_status": "ANALYZED" | "FAILED" | "REJECTED_SHORT_AUDIO", ... }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";
import type { TaskType } from "../_shared/types/index.ts";

const FUNCTION_NAME = "finalize-task";
const ALLOWED_TASK_TYPES: TaskType[] = ["SUSTAINED_VOWEL", "READING"];

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

    const { session_id, task_type, language_code = "en" } = body;

    if (!session_id || typeof session_id !== "string") {
      return respond({ error: "session_id is required" }, 400);
    }
    if (!task_type || !ALLOWED_TASK_TYPES.includes(task_type as TaskType)) {
      return respond({ error: `task_type must be one of: ${ALLOWED_TASK_TYPES.join(", ")}` }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("session_id, user_id")
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return respond({ error: "Session not found or access denied" }, 404);
    }

    // Mark task as UPLOADED (audio is in storage, analysis starting)
    await supabase
      .from("session_tasks")
      .update({ task_status: "UPLOADED" })
      .eq("session_id", session_id)
      .eq("task_type", task_type);

    // Mark session as PROCESSING
    await supabase
      .from("test_sessions")
      .update({ status: "PROCESSING" })
      .eq("session_id", session_id);

    // ── Call Python inference microservice ───────────────────────────────────
    const inferenceUrl = Deno.env.get("INFERENCE_SERVICE_URL");
    if (!inferenceUrl) {
      logError(
        { request_id: requestId, function_name: FUNCTION_NAME },
        "INFERENCE_SERVICE_URL is not configured"
      );
      return respond({ error: "Inference service not configured" }, 503);
    }

    const audioPath = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/audio/${userId}/${session_id}/${task_type}`;

    const inferenceResp = await fetch(`${inferenceUrl}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inference-Secret": Deno.env.get("INFERENCE_SHARED_SECRET") ?? "",
      },
      body: JSON.stringify({
        session_id,
        task_type,
        audio_path: audioPath,
        language_code: typeof language_code === "string" ? language_code : "en",
      }),
    });

    const inferenceBody = await inferenceResp.json().catch(() => ({}));

    if (!inferenceResp.ok) {
      // REJECTED_SHORT_AUDIO is a known, non-crash failure — pass it to the client
      if (inferenceBody.error === "AUDIO_TOO_SHORT") {
        return respond(inferenceBody, 400);
      }
      logError(
        { request_id: requestId, function_name: FUNCTION_NAME, session_id },
        "Inference service error",
        inferenceBody
      );
      return respond({ error: "Analysis failed", detail: inferenceBody }, 502);
    }

    const finalTaskStatus: string = inferenceBody.task_status ?? "ANALYZED";

    // ── Check whether all tasks are done → trigger summary ──────────────────
    const { data: allTasks } = await supabase
      .from("session_tasks")
      .select("task_status")
      .eq("session_id", session_id);

    const allTerminal = allTasks?.every((t: { task_status: string }) =>
      ["ANALYZED", "FAILED", "REJECTED_SHORT_AUDIO"].includes(t.task_status)
    );

    if (allTerminal) {
      const anyFailed = allTasks?.some(
        (t: { task_status: string }) =>
          t.task_status === "FAILED" || t.task_status === "REJECTED_SHORT_AUDIO"
      );

      await supabase
        .from("test_sessions")
        .update({ status: anyFailed ? "FAILED" : "DONE" })
        .eq("session_id", session_id);

      // Both tasks ANALYZED → fire-and-forget Gemini summary
      const allAnalyzed = allTasks?.every((t: { task_status: string }) => t.task_status === "ANALYZED");
      if (allAnalyzed) {
        fetch(`${inferenceUrl}/generate-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Inference-Secret": Deno.env.get("INFERENCE_SHARED_SECRET") ?? "",
          },
          body: JSON.stringify({ session_id }),
        }).catch((err) => {
          logError(
            { request_id: requestId, function_name: FUNCTION_NAME, session_id },
            "generate-summary call failed (non-blocking)",
            err
          );
        });
      }
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

    return respond({ task_status: finalTaskStatus, ...inferenceBody }, 200);
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to finalize task",
      err
    );
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Unauthorized") ? 401 : 500;
    return respond({ error: message, request_id: requestId }, status);
  }
});
