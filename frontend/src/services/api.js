/**
 * Voxidria API Client
 *
 * Calls Supabase Edge Functions with Auth0 JWT authentication.
 * All sensitive keys (Supabase Service Role, Gemini, ElevenLabs) stay server-side.
 *
 * Edge Function base URL: VITE_SUPABASE_URL/functions/v1/<function-name>
 */

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * The standard reading passage used for the READING task.
 * Stored here so the same text is always sent to create-session.
 */
export const READING_PASSAGE =
  "The North Wind and the Sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. "
+ "They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger than the other. "
+ "Then the North Wind blew as hard as he could, but the more he blew the more closely did the traveler fold his cloak around him; and at last the North Wind gave up the attempt. "
+ "Then the Sun shone out warmly, and immediately the traveler took off his cloak. "
+ "And so the North Wind was obliged to confess that the Sun was the stronger of the two.";

/**
 * Internal helper: call a Supabase Edge Function with Auth0 JWT.
 * Throws an Error with a human-readable message on non-2xx responses.
 */
async function callFunction(path, options, getToken) {
  const token = await getToken({
    authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
  });

  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Create a new screening session.
 * Returns { session_id, tasks }
 */
export async function createSession(consentVersion, deviceMeta, getToken) {
  return callFunction(
    "/create-session",
    {
      method: "POST",
      body: JSON.stringify({
        consent_version_accepted: consentVersion,
        device_meta: deviceMeta,
        reading_original_text: READING_PASSAGE,
      }),
    },
    getToken
  );
}

/**
 * Get a signed URL for uploading an audio file directly to Supabase Storage.
 * Returns { signedUrl, path, expiresIn }
 */
export async function getUploadUrl(sessionId, taskType, contentType, getToken) {
  return callFunction(
    "/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        task_type: taskType,
        content_type: contentType,
      }),
    },
    getToken
  );
}

/**
 * Upload an audio blob directly to Supabase Storage using the signed URL.
 * No Auth0 token needed — the signed URL is already scoped to this upload.
 */
export async function uploadAudioToStorage(signedUrl, audioBlob) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": audioBlob.type || "audio/webm" },
    body: audioBlob,
  });
  if (!res.ok) {
    throw new Error(`Audio upload to storage failed (${res.status})`);
  }
}

/**
 * Finalize a task: submit transcript and trigger Gemini reading analysis.
 * Returns { task_status, analysis_json }
 */
export async function finalizeTask(sessionId, taskType, transcriptText, getToken) {
  return callFunction(
    "/finalize-task",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        task_type: taskType,
        transcript_text: transcriptText || "",
      }),
    },
    getToken
  );
}

/**
 * Fetch a single session with tasks and predictions.
 * Returns { session, tasks, predictions }
 */
export async function getSession(sessionId, getToken) {
  return callFunction(
    `/get-session?session_id=${encodeURIComponent(sessionId)}`,
    { method: "GET" },
    getToken
  );
}

/**
 * List the user's past sessions (most recent first).
 * Returns { sessions, total }
 */
export async function listSessions(getToken, limit = 10) {
  return callFunction(
    `/list-sessions?limit=${limit}`,
    { method: "GET" },
    getToken
  );
}

/**
 * Delete a session and all its associated data (tasks, predictions, audio files).
 * Returns { deleted, session_id }
 */
export async function deleteSession(sessionId, getToken) {
  return callFunction(
    `/delete-session?session_id=${encodeURIComponent(sessionId)}`,
    { method: "DELETE", body: undefined, headers: {} },
    getToken
  );
}

/**
 * Call ElevenLabs TTS via the backend proxy.
 * Returns an audio/mpeg Blob for browser playback.
 * The ELEVENLABS_API_KEY stays server-side — this function only sends text.
 */
export async function synthesizeSpeech(text, mode = "CUSTOM", getToken, options = {}) {
  const token = await getToken({
    authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
  });

  const body = { text, mode };
  if (options.section) {
    body.section = options.section;
  }

  const res = await fetch(`${FUNCTIONS_BASE}/elevenlabs-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `TTS failed (${res.status})`);
  }

  return res.blob();
}
