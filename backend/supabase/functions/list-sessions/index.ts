/**
 * Edge Function: list-sessions
 *
 * Purpose:
 *   Returns a paginated list of the authenticated user's test sessions,
 *   ordered by most recent first. Used by the Dashboard history view.
 *   Each item includes a summary of the latest prediction for quick display.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. Only returns sessions belonging to
 *   the requesting user.
 *
 * Expected request:
 *   GET /functions/v1/list-sessions?limit=10&offset=0
 *   Authorization: Bearer <auth0_token>
 *
 * Expected response (200):
 *   {
 *     "sessions": [
 *       {
 *         "session_id": "...",
 *         "created_at": "...",
 *         "status": "DONE",
 *         "latest_prediction": { "risk_score": 42, "risk_bucket": "MODERATE" }
 *       }
 *     ],
 *     "total": 5
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

const FUNCTION_NAME = "list-sessions";
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

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
    const limitParam = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const offsetParam = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const limit = isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);
    const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch sessions for this user, most recent first
    // Uses the idx_test_sessions_user_created index
    const { data: sessions, error: sessionsError, count } = await supabase
      .from("test_sessions")
      .select("session_id, created_at, status, reading_original_text", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionsError) throw sessionsError;

    // Fetch the latest prediction for each session to show a quick summary
    const sessionIds = (sessions ?? []).map((s) => s.session_id);
    let predictionsBySession: Record<string, { risk_score: number; risk_bucket: string } | null> = {};

    if (sessionIds.length > 0) {
      const { data: predictions, error: predError } = await supabase
        .from("predictions")
        .select("session_id, risk_score, risk_bucket, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false });

      if (!predError && predictions) {
        // Keep only the most recent prediction per session
        for (const pred of predictions) {
          if (!predictionsBySession[pred.session_id]) {
            predictionsBySession[pred.session_id] = {
              risk_score: pred.risk_score,
              risk_bucket: pred.risk_bucket,
            };
          }
        }
      }
    }

    const enrichedSessions = (sessions ?? []).map((s) => ({
      ...s,
      latest_prediction: predictionsBySession[s.session_id] ?? null,
    }));

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        latency_ms: Date.now() - startTime,
      },
      `Listed ${enrichedSessions.length} sessions`
    );

    return respond({ sessions: enrichedSessions, total: count ?? 0 }, 200);
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to list sessions",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
