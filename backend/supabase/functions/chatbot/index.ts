/**
 * Edge Function: chatbot
 *
 * Purpose:
 *   Handles chat messages from authenticated users and returns AI responses
 *   using the Google Gemini API. The chatbot (Vox) answers questions about the
 *   Voxidria platform: how to use it, what the voice tasks are, how data is
 *   stored and used, privacy information, and results interpretation.
 *
 * Auth requirements:
 *   Bearer token (Auth0 JWT) required.
 *
 * Expected request:
 *   POST /functions/v1/chatbot
 *   Content-Type: application/json
 *   Authorization: Bearer <auth0_token>
 *   Body: {
 *     "message": "How do I use the platform?",
 *     "history": [{ "role": "user" | "assistant", "content": "..." }]
 *   }
 *
 * Expected response (200):
 *   { "response": "Here's how to use Voxidria..." }
 *
 * Secrets used (server-side only):
 *   GEMINI_API_KEY — never exposed to the client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth0Token } from "../_shared/auth/verifyAuth0.ts";
import { handleCors, getCorsHeaders } from "../_shared/utils/cors.ts";
import { logInfo, logError } from "../_shared/utils/logger.ts";

const FUNCTION_NAME = "chatbot";

const SYSTEM_PROMPT = `You are Vox, a friendly and knowledgeable assistant for the Voxidria platform. Voxidria is a voice-based Parkinson's disease screening web application that uses voice biomarkers to detect potential early signs of Parkinson's disease.

**What Voxidria does:**
- Voxidria is a clinical screening tool that records and analyzes users' voices to identify acoustic features associated with Parkinson's disease
- Users complete three short voice tasks, which are analyzed by machine learning models and AI
- The platform is for screening purposes only — results are not a medical diagnosis

**The three voice tasks:**
1. **Sustained Vowel (AHHH):** Say "ahhh" for as long and steadily as possible. Tests voice stability, tremor, and breathiness.
2. **DDK / Rapid Syllables (PA-TA-KA):** Rapidly repeat "pa-ta-ka" for several seconds. Tests motor speech coordination and rhythm.
3. **Reading Task:** Read a standardized passage aloud. Analyzed for hesitations, word substitutions, repetitions, and fluency patterns.

**How to use the platform:**
1. Log in with your account
2. From the Dashboard, click "Start New Screening" to begin a session
3. A voice guide (the Voxidria medical assistant) will walk you through each task
4. Complete all three voice tasks following the on-screen instructions
5. After completing the session, results appear in your Dashboard history
6. Click any past session to view detailed analysis results

**How your data is used:**
- Voice recordings and transcripts are stored securely in encrypted cloud storage (Supabase)
- Data is linked to your user account and is private — only you can access it
- Recordings are analyzed by AI (Google Gemini) and machine learning models to generate screening results
- Your data is used only for screening purposes and is not shared with third parties without your consent
- You can delete any session and all its associated data from the Dashboard at any time

**Privacy and security:**
- All data is encrypted in transit (HTTPS) and at rest in the cloud
- Sensitive API keys are never exposed to the browser — all AI processing happens server-side
- Authentication is handled by Auth0, a trusted identity provider
- You can request deletion of all your data at any time through the Dashboard

**Understanding your results:**
- Results are for screening purposes only and are NOT a medical diagnosis
- The platform provides a preliminary voice-based assessment
- Always consult a qualified healthcare professional for medical advice or diagnosis
- Results show metrics such as voice stability, reading fluency, and motor speech patterns

Keep responses concise (2-4 sentences when possible), friendly, and helpful. If a question is outside the scope of the Voxidria platform, gently let the user know and redirect them back to platform-related topics. Never provide medical diagnoses, treatment recommendations, or advice outside your knowledge of this platform.`;

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
    await verifyAuth0Token(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid JSON body" }, 400);
    }

    const { message, history } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return respond({ error: "message is required" }, 400);
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-pro";

    if (!geminiApiKey) {
      return respond({ error: "Gemini API not configured" }, 500);
    }

    // Build conversation history for Gemini multi-turn chat
    const conversationHistory = Array.isArray(history) ? history : [];
    const contents = [
      ...conversationHistory
        .filter((msg: unknown) => typeof (msg as Record<string, unknown>).role === "string" && typeof (msg as Record<string, unknown>).content === "string")
        .map((msg: unknown) => {
          const m = msg as { role: string; content: string };
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          };
        }),
      {
        role: "user",
        parts: [{ text: message.trim() }],
      },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      logError(
        { request_id: requestId, function_name: FUNCTION_NAME },
        "Gemini API error",
        errText
      );
      return respond({ error: "Failed to get response from AI" }, 502);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return respond({ error: "Empty response from AI" }, 502);
    }

    logInfo(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        latency_ms: Date.now() - startTime,
      },
      "Chatbot response generated"
    );

    return respond({ response: responseText }, 200);
  } catch (err) {
    logError(
      {
        request_id: requestId,
        function_name: FUNCTION_NAME,
        latency_ms: Date.now() - startTime,
      },
      "Chatbot request failed",
      err
    );
    const status = String(err.message).includes("Unauthorized") ? 401 : 500;
    return respond({ error: err.message, request_id: requestId }, status);
  }
});
