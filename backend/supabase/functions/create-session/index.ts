/**
 * Edge Function: create-session
 *
 * Purpose:
 *   Creates a new Voxidria test session for an authenticated user.
 *   Upserts the user record (keeping email fresh from Auth0 token),
 *   creates a test_sessions row in PENDING status, and creates
 *   session_tasks rows for each supported task type.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required in Authorization header.
 *   We extract the user ID from the verified token — never from the request body.
 *
 * Expected request:
 *   POST /functions/v1/create-session
 *   Content-Type: application/json
 *   Authorization: Bearer <auth0_token>
 *   Body: {
 *     "consent_version_accepted": "1.0",
 *     "device_meta": { "browser": "Chrome", "sample_rate": 48000 },
 *     "reading_original_text": "The rainbow is a division of white light..."
 *   }
 *
 * Expected response (201):
 *   { "session_id": "<uuid>", "tasks": [...] }
 *
 * Secrets used (server-side only):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — never exposed to the frontend.
 *   The Service Role key bypasses Row Level Security; it stays server-side only.
 *   AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_ISSUER_BASE_URL — for JWT verification.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "create-session";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  // Handle CORS preflight
  // const corsResponse = handleCors(req);
  // if (corsResponse) return corsResponse;

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
    // Verify Auth0 JWT — the 'sub' claim is the authoritative user ID.
    // We do NOT accept a user_id from the request body.
    const claims = await verifyAuth0Token(req);
    const userId = claims.sub;

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid JSON body" }, 400);
    }

    const { consent_version_accepted, device_meta, reading_original_text } = body;

    // Input validation
    if (!consent_version_accepted || typeof consent_version_accepted !== "string") {
      return respond({ error: "consent_version_accepted is required (string)" }, 400);
    }
    if (!reading_original_text || typeof reading_original_text !== "string") {
      return respond({ error: "reading_original_text is required (string)" }, 400);
    }
    if (reading_original_text.length > 2000) {
      return respond({ error: "reading_original_text exceeds 2000 characters" }, 400);
    }

    // SUPABASE_SERVICE_ROLE_KEY bypasses RLS — it must ONLY be used server-side.
    // This key should never appear in frontend code or be returned to clients.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert user — Auth0 is the source of truth for identity.
    // We store the sub so we can join sessions to users without Auth0 API calls.
    const upsertData = {
      user_id: userId,
      email: claims.email ?? null,
    };

    if (typeof consent_version_accepted !== "undefined") {
      upsertData.consent_version_accepted = String(consent_version_accepted);
    }

    const { error: userError } = await supabase.from("users").upsert(
      upsertData,
      { onConflict: "user_id" }
    );
    if (userError) throw userError;

    // Create the test session in PENDING status
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: userId,
        status: "PENDING",
        device_meta: device_meta ?? null,
        reading_original_text,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Create one task row per supported task type.
    // All start as PENDING — the client will upload audio and call finalize-task for each.
    const taskTypes = ["SUSTAINED_VOWEL", "READING", "DDK"] as const;
    const tasksPayload = taskTypes.map((task_type) => ({
      session_id: session.session_id,
      task_type,
      task_status: "PENDING",
    }));

    const { data: tasks, error: tasksError } = await supabase
      .from("session_tasks")
      .insert(tasksPayload)
      .select();

    if (tasksError) throw tasksError;

    logInfo(
      { request_id: requestId, function_name: FUNCTION_NAME, user_id: userId, session_id: session.session_id, latency_ms: Date.now() - startTime },
      "Session created"
    );

    return respond({ session_id: session.session_id, tasks }, 201);
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to create session",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
