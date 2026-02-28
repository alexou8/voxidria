/**
 * Edge Function: upload-url
 *
 * Purpose:
 *   Generates a short-lived signed upload URL for a specific task's audio file.
 *   The client uploads directly to Supabase Storage using this URL.
 *   This keeps the audio upload off our Edge Function (no piping large blobs).
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required. We verify session ownership — the
 *   requesting user must own the session_id in the request body.
 *
 * Expected request:
 *   POST /functions/v1/upload-url
 *   Content-Type: application/json
 *   Authorization: Bearer <auth0_token>
 *   Body: {
 *     "session_id": "<uuid>",
 *     "task_type": "READING",
 *     "content_type": "audio/webm"
 *   }
 *
 * Expected response (200):
 *   { "signedUrl": "...", "path": "audio/{sub}/{session_id}/READING.webm", "expiresIn": 300 }
 *
 * Secrets used (server-side only):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — service role is needed to create
 *   signed URLs for a private bucket without requiring the user to be authed
 *   through Supabase Auth (we use Auth0 instead).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";
import type { TaskType } from "../_shared/types/index.ts";

const FUNCTION_NAME = "upload-url";
const BUCKET = "audio";
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes to complete the upload

const ALLOWED_TASK_TYPES: TaskType[] = ["SUSTAINED_VOWEL", "READING", "DDK"];
const ALLOWED_CONTENT_TYPES = ["audio/webm", "audio/wav", "audio/mpeg", "audio/ogg", "audio/mp4", "audio/x-wav"];

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

    const { session_id, task_type, content_type } = body;

    // Validate inputs
    if (!session_id || typeof session_id !== "string") {
      return respond({ error: "session_id is required" }, 400);
    }
    if (!task_type || !ALLOWED_TASK_TYPES.includes(task_type as TaskType)) {
      return respond({ error: `task_type must be one of: ${ALLOWED_TASK_TYPES.join(", ")}` }, 400);
    }
    if (!content_type || !ALLOWED_CONTENT_TYPES.includes(content_type as string)) {
      return respond({ error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}` }, 400);
    }

    // SUPABASE_SERVICE_ROLE_KEY is server-side only — never returned to clients
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ownership check: ensure this session belongs to the authenticated user.
    // We never trust client-provided session IDs without verifying ownership.
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("session_id, user_id")
      .eq("session_id", session_id)
      .eq("user_id", userId)  // <-- enforces ownership
      .single();

    if (sessionError || !session) {
      return respond({ error: "Session not found or access denied" }, 404);
    }

    // Storage path encodes the user's Auth0 sub and session/task identifiers.
    // We construct the path server-side; clients never choose where files are stored.
    const fileExtension = content_type === "audio/webm" ? "webm"
      : content_type === "audio/wav" || content_type === "audio/x-wav" ? "wav"
      : content_type === "audio/mpeg" ? "mp3"
      : content_type === "audio/ogg" ? "ogg"
      : "mp4";

    const storagePath = `audio/${userId}/${session_id}/${task_type}.${fileExtension}`;

    // Generate a signed upload URL (POST to this URL puts the file in the bucket)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError) throw signedError;

    // Record the intended storage path in session_tasks so we can reference it later
    const { error: updateError } = await supabase
      .from("session_tasks")
      .update({
        audio_path: storagePath,
        task_status: "PENDING",
      })
      .eq("session_id", session_id)
      .eq("task_type", task_type);

    if (updateError) throw updateError;

    logInfo(
      { request_id: requestId, function_name: FUNCTION_NAME, user_id: userId, session_id, latency_ms: Date.now() - startTime },
      "Signed upload URL generated"
    );

    return respond(
      {
        signedUrl: signedData.signedUrl,
        path: storagePath,
        expiresIn: SIGNED_URL_EXPIRY_SECONDS,
      },
      200
    );
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to generate upload URL",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
