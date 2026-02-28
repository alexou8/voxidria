/**
 * ElevenLabs Text-to-Speech Module
 *
 * WHY we proxy ElevenLabs through a server-side Edge Function:
 *   - The ELEVENLABS_API_KEY must never be sent to or visible in the browser.
 *   - Client-side API key exposure would allow unauthorized usage and billing abuse.
 *   - Proxying here also lets us enforce per-user rate limits server-side.
 *
 * Rate limiting idea (not implemented — add before production):
 *   - Track calls in Supabase using a rate_limit table keyed on user_id + minute.
 *   - Reject calls exceeding N requests/minute/user (e.g., 5).
 *   - ElevenLabs also has its own character quota; monitor via their API.
 */

export interface TTSRequest {
  text: string;
  voice_id?: string;   // Override the default voice from env
  model_id?: string;   // Override the default model from env
}

/**
 * Call ElevenLabs TTS API and return the audio bytes.
 *
 * The ELEVENLABS_API_KEY is read from server-side env — never exposed to clients.
 * Returns raw audio/mpeg bytes suitable for streaming back to the client.
 */
export async function synthesizeSpeech(request: TTSRequest): Promise<Uint8Array> {
  // Keys come exclusively from server-side environment variables
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY environment variable is not configured");

  const voiceId = request.voice_id ?? Deno.env.get("ELEVENLABS_VOICE_ID");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID environment variable is not configured");

  const modelId = request.model_id ?? Deno.env.get("ELEVENLABS_MODEL_ID") ?? "eleven_multilingual_v2";

  // Enforce reasonable text length to prevent abuse
  if (!request.text || request.text.trim().length === 0) {
    throw new Error("text must not be empty");
  }
  if (request.text.length > 5000) {
    throw new Error("text exceeds maximum length of 5000 characters");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey, // ElevenLabs auth header — server-side only
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: request.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  // Return raw bytes; the Edge Function will stream these back as audio/mpeg
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
