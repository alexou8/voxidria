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
 *   - For all modes: requires Auth0 JWT (authenticated users only).
 *   - Rationale: requiring auth prevents anonymous abuse of the ElevenLabs quota.
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
 *     "mode": "SITE_HELP", // "SITE_HELP" | "RESULTS_HELP" | "MEDICAL_ASSISTANT" | "CUSTOM"
 *     "section": "CONSENT_OVERVIEW" // only for MEDICAL_ASSISTANT mode
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

const MEDICAL_ASSISTANT_SCRIPTS = {
  CONSENT_OVERVIEW: `Hello. I am your Voxidria medical assistant.
Voxidria is a voice-based screening tool that analyzes short voice tasks for speech biomarkers linked to neurological changes.
Before recording, please confirm you understand that your voice sample will be securely stored and analyzed to generate a screening score.
This score is informational and does not provide a diagnosis. Only a licensed healthcare professional can diagnose a medical condition.
By continuing, you agree to microphone access and to the secure processing of your recordings for this screening session.`,
  AHHH_TEST: `For the ahhh test, sit comfortably and keep the microphone about six to eight inches from your mouth.
Take a deep breath, then say ahhh in one steady tone for about five seconds.
Try to keep your volume and pitch as stable as possible, and avoid trailing off at the end.`,
  PA_TA_KA_TEST: `For the pa-ta-ka test, keep the same microphone distance and speak clearly at your natural loudness.
Repeat pa-ta-ka continuously for about ten seconds, as quickly and accurately as you can.
Focus on crisp consonants and a steady rhythm without pausing between syllables.`,
  READING_TEST: `For the reading task, read the passage out loud at a comfortable pace and natural volume.
Keep your pronunciation clear and avoid whispering. If you make a small mistake, keep going.`,
} as const;

type TTSMode = "SITE_HELP" | "RESULTS_HELP" | "MEDICAL_ASSISTANT" | "CUSTOM";
type MedicalAssistantSection = keyof typeof MEDICAL_ASSISTANT_SCRIPTS;

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

    const { text, mode, section } = body;
    const ttsMode = (mode as TTSMode) ?? "CUSTOM";

    const validModes: TTSMode[] = ["SITE_HELP", "RESULTS_HELP", "MEDICAL_ASSISTANT", "CUSTOM"];
    if (!validModes.includes(ttsMode)) {
      return respondError(`mode must be one of: ${validModes.join(", ")}`, 400);
    }

    // Determine the text to synthesize
    let synthesisText: string;
    let voiceIdOverride: string | undefined;
    if (ttsMode === "SITE_HELP") {
      synthesisText = SITE_HELP_SCRIPT;
    } else if (ttsMode === "RESULTS_HELP") {
      synthesisText = RESULTS_HELP_SCRIPT;
    } else if (ttsMode === "MEDICAL_ASSISTANT") {
      const sectionInput = typeof section === "string" ? section : "CONSENT_OVERVIEW";
      const requestedSection = sectionInput.toUpperCase();
      const medicalSection = requestedSection as MedicalAssistantSection;
      if (!(medicalSection in MEDICAL_ASSISTANT_SCRIPTS)) {
        const validSections = Object.keys(MEDICAL_ASSISTANT_SCRIPTS).join(", ");
        return respondError(`section must be one of: ${validSections}`, 400);
      }
      synthesisText = MEDICAL_ASSISTANT_SCRIPTS[medicalSection];
      voiceIdOverride = Deno.env.get("ELEVENLABS_MEDICAL_ASSISTANT_VOICE_ID") ?? undefined;
    } else {
      // CUSTOM mode: use provided text
      if (!text || typeof text !== "string") {
        return respondError("text is required for CUSTOM mode", 400);
      }
      synthesisText = text;
    }

    // Call ElevenLabs — API key stays server-side in synthesizeSpeech()
    const audioBytes = await synthesizeSpeech({
      text: synthesisText,
      voice_id: voiceIdOverride,
    });

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        user_id: userId,
        latency_ms: Date.now() - startTime,
      },
      `TTS synthesized: mode=${ttsMode}, section=${String(section ?? "")}, chars=${synthesisText.length}`
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
