/**
 * CORS Headers Utility
 *
 * Restricts cross-origin requests to the configured frontend domain.
 * The ALLOWED_ORIGIN env var should be set to your production frontend URL
 * (e.g., https://voxidria.vercel.app). During local development, set it to
 * http://localhost:5173.
 *
 * We do NOT use wildcard (*) in production to prevent unauthorized origins
 * from calling our Edge Functions.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "http://localhost:5173";

  // Reflect the request origin only if it matches our allowed list.
  // This enables preflight to work correctly without allowing arbitrary origins.
  const origin = requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

/** Return a 200 response for CORS preflight OPTIONS requests. */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }
  return null;
}
