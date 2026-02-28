/**
 * Edge Function: elevenlabs-tts
 *
 * Purpose:
 *   Accessibility voice assistant endpoint. Converts text to speech using
 *   ElevenLabs and returns the audio bytes as audio/mpeg.
 *
 * WHY we proxy ElevenLabs through this Edge Function:
 *   - The ELEVENLABS_API_KEY must never be sent to or visible in the browser.
 *   - Client-side key exposure would allow unauthorized usage and billing abuse.
 *   - Proxying here lets us enforce per-user rate limits server-side.
 *   - We can audit and log which text is being synthesized.
 *
 * Auth requirements:
 *   - For SITE_HELP and RESULTS_HELP modes: requires Auth0 JWT (authenticated users only).
 *   - Rationale: even for "generic" help text, requiring auth prevents anonymous
 *     abuse of the ElevenLabs quota. Change REQUIRE_AUTH_FOR_SITE_HELP env var to
 *     "false" to allow anonymous access for the landing page if needed.
 *
 * Rate limiting (TODO for production):
 *   Track calls per user in a rate_limit table. Reject if > N calls/minute/user.
 *   ElevenLabs also has a character quota; monitor via their usage API.
 *
 * Expected request:
 *   POST /functions/v1/elevenlabs-tts
 *   Content-Type: application/json
 *   Authorization: Bearer <auth0_token>
 *   Body: {
 *     "text": "Welcome to Voxidria. Here's how your results are calculated...",
 *     "mode": "SITE_HELP"  // "SITE_HELP" | "RESULTS_HELP" | "CUSTOM"
 *   }
 *
 * Expected response (200):
 *   Content-Type: audio/mpeg
 *   [binary audio data]
 *
 * Secrets used (server-side only):
 *   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID
 *   These are never returned to the client or included in any response body.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { synthesizeSpeech } from "../_shared/elevenlabs/tts.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "elevenlabs-tts";

// Predefined scripts for common modes so clients don't have to send long text blobs
const SITE_HELP_SCRIPT = `Welcome to Voxidria, a voice-based speech screening tool.
This application records short voice samples and analyzes them to provide a
speech risk score. This is not a medical diagnosis. If you have concerns
about your health, please consult a healthcare professional.
To begin, log in and follow the guided recording tasks.`;

const RESULTS_HELP_SCRIPT = `Your results are displayed as a risk score from 0 to 100,
divided into low, moderate, and high categories. This score is based on vocal
biomarkers such as jitter, shimmer, and harmonics-to-noise ratio.
Remember: this is a screening tool only and does not diagnose any medical condition.`;

type TTSMode = "SITE_HELP" | "RESULTS_HELP" | "CUSTOM";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const respondError = (error: string, status: number) =>
    new Response(JSON.stringify({ error, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return respondError("Method not allowed", 405);
  }

  try {
    // Require Auth0 JWT for all modes (prevents anonymous quota abuse)
    const claims = await verifyAuth0Token(req);
    const userId = claims.sub;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respondError("Invalid JSON body", 400);
    }

    const { text, mode } = body;
    const ttsMode = (mode as TTSMode) ?? "CUSTOM";

    const validModes: TTSMode[] = ["SITE_HELP", "RESULTS_HELP", "CUSTOM"];
    if (!validModes.includes(ttsMode)) {
      return respondError(`mode must be one of: ${validModes.join(", ")}`, 400);
    }

    // Determine the text to synthesize
    let synthesisText: string;
    if (ttsMode === "SITE_HELP") {
      synthesisText = SITE_HELP_SCRIPT;
    } else if (ttsMode === "RESULTS_HELP") {
      synthesisText = RESULTS_HELP_SCRIPT;
    } else {
      // CUSTOM mode: use provided text
      if (!text || typeof text !== "string") {
        return respondError("text is required for CUSTOM mode", 400);
      }
      synthesisText = text;
    }

    // Call ElevenLabs — API key stays server-side in synthesizeSpeech()
    const audioBytes = await synthesizeSpeech({ text: synthesisText });

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        latency_ms: Date.now() - startTime,
      },
      `TTS synthesized: mode=${ttsMode}, chars=${synthesisText.length}`
    );

    // Return raw audio bytes — client plays this directly
    return new Response(audioBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBytes.byteLength),
        // Prevent caching of personalized audio
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logError(
      { request_id: requestId, function_name: FUNCTION_NAME, latency_ms: Date.now() - startTime },
      "TTS synthesis failed",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respondError(err.message, status);
  }
});
