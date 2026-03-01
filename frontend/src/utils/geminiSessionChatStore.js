const STORAGE_KEY = "voxidria_gemini_session_chat_v1";

function readStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage write failures.
  }
}

export function getSessionGeminiChat(sessionId) {
  if (!sessionId) return null;
  const store = readStore();
  const raw = store[sessionId];
  if (!raw || typeof raw !== "object") return null;

  const initialFromDirect = typeof raw.initial_assistant_message === "string"
    ? raw.initial_assistant_message.trim()
    : "";

  const initialFromLegacyMessages = Array.isArray(raw.messages)
    ? (raw.messages.find((m) => m?.role === "assistant" && typeof m?.content === "string")?.content || "").trim()
    : "";

  const initialAssistantMessage = initialFromDirect || initialFromLegacyMessages;
  if (!initialAssistantMessage) return null;

  return {
    model: raw.model ?? null,
    resultsSnapshot: raw.resultsSnapshot ?? null,
    initial_assistant_message: initialAssistantMessage,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
  };
}

export function saveSessionGeminiChat(sessionId, chatData) {
  if (!sessionId || !chatData) return;
  const initialAssistantMessage = typeof chatData.initial_assistant_message === "string"
    ? chatData.initial_assistant_message.trim()
    : "";
  if (!initialAssistantMessage) return;

  const store = readStore();
  // Persist only the initial seed response for each session.
  // Follow-up turns are intentionally not persisted.
  store[sessionId] = {
    model: chatData.model ?? null,
    resultsSnapshot: chatData.resultsSnapshot ?? null,
    initial_assistant_message: initialAssistantMessage,
    created_at: chatData.created_at ?? new Date().toISOString(),
    updated_at: chatData.updated_at ?? new Date().toISOString(),
  };
  writeStore(store);
}
