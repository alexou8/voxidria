import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "list-sessions";

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
    const claims = await verifyAuth0Token(req);
    const userSub = claims?.sub;
    if (!userSub) return respond({ error: "Unauthorized", request_id: requestId }, 401);

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit") ?? "10";
    const limit = Math.max(1, Math.min(50, Number(limitRaw) || 10));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return respond(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", request_id: requestId },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("test_sessions")
      .select("id, status, created_at, completed_at, risk_score, risk_bucket, prediction, gemini_explanation")
      .eq("user_id", userSub)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError({ request_id: requestId, function_name: FUNCTION_NAME, supabase_error: error }, "List sessions failed");
      return respond({ error: "List sessions failed", details: error.message, request_id: requestId }, 500);
    }

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userSub,
        count: data?.length ?? 0,
        latency_ms: Date.now() - startTime,
      },
      "Sessions listed"
    );

    return respond({ sessions: data ?? [] }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;

    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "Failed to list sessions",
      err
    );

    return respond({ error: message, request_id: requestId }, status);
  }
});