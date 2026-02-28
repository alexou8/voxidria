/**
 * Edge Function: get-session
 *
 * Purpose:
 *   Retrieves a single test session with its tasks and predictions.
 *   Used by the Results page to display the score, explanation, and task analysis.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. Session ownership is verified —
 *   only the user who created the session can retrieve it.
 *
 * Expected request:
 *   GET /functions/v1/get-session?session_id=<uuid>
 *   Authorization: Bearer <auth0_token>
 *
 * Expected response (200):
 *   {
 *     "session": { ...session row },
 *     "tasks": [...task rows],
 *     "predictions": [...prediction rows]
 *   }
 *
 * Secrets used (server-side only):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "get-session";

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
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const claims = await verifyAuth0Token(req);
    const userId = claims.sub;

    const url = new URL(req.url);
    const session_id = url.searchParams.get("session_id");

    if (!session_id) {
      return respond({ error: "session_id query parameter is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check: user_id must match — prevents users reading each other's data
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("*")
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return respond({ error: "Session not found or access denied" }, 404);
    }

    // Fetch associated tasks and predictions in parallel
    const [tasksResult, predictionsResult] = await Promise.all([
      supabase
        .from("session_tasks")
        .select("*")
        .eq("session_id", session_id)
        .order("task_type"),
      supabase
        .from("predictions")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false }),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (predictionsResult.error) throw predictionsResult.error;

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        session_id,
        latency_ms: Date.now() - startTime,
      },
      "Session retrieved"
    );

    return respond(
      {
        session,
        tasks: tasksResult.data ?? [],
        predictions: predictionsResult.data ?? [],
      },
      200
    );
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to get session",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
