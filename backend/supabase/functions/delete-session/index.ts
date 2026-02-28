/**
 * Edge Function: delete-session
 *
 * Purpose:
 *   Permanently deletes a test session and all associated data, including:
 *   - All session_tasks rows (via CASCADE)
 *   - All predictions rows (via CASCADE)
 *   - All audio files in Supabase Storage for this session
 *   - The test_sessions row itself
 *
 *   This implements the "delete my data" privacy right. Users can remove
 *   any session and its recordings at any time.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. Session ownership is strictly verified.
 *
 * Expected request:
 *   DELETE /functions/v1/delete-session?session_id=<uuid>
 *   Authorization: Bearer <auth0_token>
 *
 * Expected response (200):
 *   { "deleted": true, "session_id": "<uuid>" }
 *
 * Secrets used (server-side only):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "delete-session";
const BUCKET = "audio";

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

  if (req.method !== "DELETE") {
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

    // Ownership check before any deletion — critical security gate
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("session_id, user_id")
      .eq("session_id", session_id)
      .eq("user_id", userId)  // must belong to this user
      .single();

    if (sessionError || !session) {
      return respond({ error: "Session not found or access denied" }, 404);
    }

    // Step 1: Delete all audio storage objects for this session.
    // List all files under audio/{user_id}/{session_id}/
    // We do this BEFORE deleting DB rows so we have the audio_path references.
    const { data: tasks } = await supabase
      .from("session_tasks")
      .select("audio_path")
      .eq("session_id", session_id);

    const storagePaths = (tasks ?? [])
      .map((t) => t.audio_path)
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove(storagePaths);

      if (storageError) {
        // Log but don't block — partial storage deletion is better than no DB deletion
        logError(
          { request_id: requestId, function_name: FUNCTION_NAME, user_id: userId, session_id },
          "Partial storage deletion failure (continuing with DB deletion)",
          storageError
        );
      }
    }

    // Step 2: Delete the session row.
    // CASCADE on session_tasks and predictions handles child rows automatically.
    const { error: deleteError } = await supabase
      .from("test_sessions")
      .delete()
      .eq("session_id", session_id)
      .eq("user_id", userId);  // double-check ownership in the DELETE too

    if (deleteError) throw deleteError;

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        session_id,
        latency_ms: Date.now() - startTime,
      },
      "Session deleted"
    );

    return respond({ deleted: true, session_id }, 200);
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to delete session",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
