import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getSession } from "../services/api";
import "./ResultsPage.css";
import { ensurePseudoResult, getPseudoResult, normalizeAge } from "../utils/pseudoResults";
import { getSessionGeminiChat, saveSessionGeminiChat } from "../utils/geminiSessionChatStore";

const REQUESTED_GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.0-flash";
const GEMINI_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
const VOX_NAME = "Vox";
const VOX_BRAND_SUBTITLE = "Vox powered by Gemini";
const VOX_PERSONALITY = (import.meta.env.VITE_VOX_PERSONALITY || "friendly, informative, medically professional").trim();

const bucketColor = { Low: "#21E6C1", Moderate: "#F7CC3B", High: "#EF4444" };
const bucketBg = { Low: "rgba(33,230,193,0.1)", Moderate: "rgba(247,204,59,0.1)", High: "rgba(239,68,68,0.1)" };
const statusColor = { normal: "#21E6C1", elevated: "#F7CC3B", high: "#EF4444" };

function nextStepsForBucket(bucket) {
  if (bucket === "Low") return [
    "Schedule a follow-up screening in 4–6 weeks to track any changes.",
    "If your voice feels quieter, monotone, or harder to control, consult a neurologist.",
    "Maintain vocal health with regular hydration and vocal exercises.",
  ];
  if (bucket === "Moderate") return [
    "Consider consulting a neurologist or speech-language pathologist.",
    "Schedule a follow-up screening in 2–3 weeks to monitor changes.",
    "Note any other symptoms: tremor, stiffness, slow movement.",
    "Avoid noisy environments that may mask vocal changes.",
  ];
  return [
    "Please consult a neurologist or movement disorder specialist promptly.",
    "Bring this screening report to your medical appointment.",
    "Schedule a follow-up screening after your consultation.",
    "Track daily changes in your voice and movement patterns.",
  ];
}

function normalizeGeminiModelName(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function getGeminiModelCandidates() {
  const requested = normalizeGeminiModelName(REQUESTED_GEMINI_MODEL);
  const models = [requested, ...GEMINI_FALLBACK_MODELS]
    .map((model) => normalizeGeminiModelName(model))
    .filter(Boolean);
  return [...new Set(models)];
}

function parseGeminiErrorMessage(status, bodyText) {
  if (!bodyText) return `Gemini request failed (${status})`;
  try {
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // Non-JSON error payload
  }
  return bodyText.length > 240 ? `${bodyText.slice(0, 240)}...` : bodyText;
}

function isModelUnavailableError(status, message) {
  if (status === 404) return true;
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("not found")
    && normalized.includes("generatecontent");
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={`${keyPrefix}-b-${idx}`}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={`${keyPrefix}-i-${idx}`}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${keyPrefix}-c-${idx}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={`${keyPrefix}-t-${idx}`}>{part}</span>;
  });
}

function renderChatMessageContent(text) {
  const blocks = String(text || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return blocks.map((block, blockIdx) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isList = lines.length > 0 && lines.every((line) => /^([-*]|\d+\.)\s+/.test(line));

    if (isList) {
      return (
        <ul key={`b-${blockIdx}`} className="res-chat-md-list res-chat-md-block">
          {lines.map((line, lineIdx) => (
            <li key={`l-${blockIdx}-${lineIdx}`} className="res-chat-md-list-item">
              {renderInlineMarkdown(line.replace(/^([-*]|\d+\.)\s+/, ""), `list-${blockIdx}-${lineIdx}`)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${blockIdx}`} className="res-chat-md-p res-chat-md-block">
        {lines.map((line, lineIdx) => (
          <span key={`s-${blockIdx}-${lineIdx}`}>
            {renderInlineMarkdown(line, `p-${blockIdx}-${lineIdx}`)}
            {lineIdx < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  });
}

function getVoxPersonalityBlock() {
  return `Personality and tone requirements:
- You are ${VOX_NAME}, ${VOX_BRAND_SUBTITLE}.
- Style: ${VOX_PERSONALITY}.
- Be calm, supportive, and clear.
- Be medically responsible: informative but never diagnostic.
- Do not prescribe treatment. Encourage clinician follow-up when appropriate.`;
}

function makeInitialAssistantMessage(content, createdAt) {
  return [{ role: "assistant", content, created_at: createdAt || new Date().toISOString() }];
}

function isCompleteInitialExplanation(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  const lowered = value.toLowerCase();
  const hasRequiredSections = lowered.includes("model summary:")
    && lowered.includes("age-calibrated context:")
    && lowered.includes("clinical guidance:");

  const endsCleanly = /[.!?]["']?$/.test(value);

  return hasRequiredSections && value.length >= 180 && endsCleanly;
}

async function callGeminiText(prompt, options = {}) {
  const candidateModels = getGeminiModelCandidates();
  let lastErrorMessage = "";
  const maxOutputTokens = Number.isFinite(options.maxOutputTokens) ? options.maxOutputTokens : 1200;
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.2;

  for (const model of candidateModels) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const message = parseGeminiErrorMessage(res.status, errText);
      lastErrorMessage = message;

      if (isModelUnavailableError(res.status, message)) {
        continue;
      }

      throw new Error(message || `Gemini request failed (${res.status})`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = Array.isArray(parts)
      ? parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim()
      : "";

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return { text, model, finishReason };
  }

  throw new Error(
    `No compatible Gemini model is available for this key. Tried: ${getGeminiModelCandidates().join(", ")}.`
    + (lastErrorMessage ? ` Last error: ${lastErrorMessage}` : "")
  );
}

function parseOpenAITextResponse(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const chunks = [];

  for (const item of output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

async function callOpenAIText(prompt, options = {}) {
  const maxOutputTokens = Number.isFinite(options.maxOutputTokens) ? options.maxOutputTokens : 1200;
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.2;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      temperature,
      max_output_tokens: maxOutputTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(parseGeminiErrorMessage(res.status, errText));
  }

  const data = await res.json();
  const text = parseOpenAITextResponse(data);

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return {
    text,
    model: OPENAI_MODEL,
    finishReason: data?.status || null,
    provider: "openai",
  };
}

async function callVoxText(prompt, options = {}) {
  const errors = [];
  const validator = typeof options.validator === "function" ? options.validator : null;

  if (GEMINI_API_KEY) {
    try {
      const result = await callGeminiText(prompt, options);
      if (validator && !validator(result.text)) {
        throw new Error(`Gemini response was incomplete${result.finishReason ? ` (${result.finishReason})` : ""}.`);
      }
      return { ...result, provider: "gemini" };
    } catch (err) {
      errors.push(`Gemini: ${err.message || "Request failed"}`);
    }
  } else {
    errors.push("Gemini: API key missing");
  }

  if (OPENAI_API_KEY) {
    try {
      const result = await callOpenAIText(prompt, options);
      if (validator && !validator(result.text)) {
        throw new Error("OpenAI response was incomplete.");
      }
      return result;
    } catch (err) {
      errors.push(`OpenAI: ${err.message || "Request failed"}`);
    }
  } else {
    errors.push("OpenAI: API key missing");
  }

  throw new Error(`No provider produced a valid response. ${errors.join(" | ")}`);
}

function initialExplanationPrompt(snapshot) {
  return `You are ${VOX_NAME}, the patient-facing screening assistant for Voxidria.

Write a plain-language explanation for this screening result.
Use only the provided values. Do not invent values.

${getVoxPersonalityBlock()}

Result snapshot JSON:
${JSON.stringify(snapshot, null, 2)}

Formatting:
- Return exactly 3 short paragraphs.
- Start each paragraph with these labels in this order:
  1) Model Summary:
  2) Age-Calibrated Context:
  3) Clinical Guidance:
- Keep the language clear and reassuring.
- Do not claim diagnosis or treatment.
- Mention this is a screening aid, not a diagnosis.`;
}

function followupPrompt(snapshot, history, question) {
  const recentTurns = history
    .slice(-12)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  return `You are ${VOX_NAME}, the follow-up assistant for Voxidria.

Use only this fixed result snapshot. If data is missing, say so.
Never diagnose.
${getVoxPersonalityBlock()}

Result snapshot JSON:
${JSON.stringify(snapshot, null, 2)}

Recent conversation:
${recentTurns || "(no prior messages)"}

User question:
${question}

Respond with plain text only.`;
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessTokenSilently } = useAuth0();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animScore, setAnimScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const ageFromQuery = normalizeAge(searchParams.get("age"));
  const [pseudoResult, setPseudoResult] = useState(() => (sessionId ? getPseudoResult(sessionId) : null));

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatLogRef = useRef(null);

  useEffect(() => {
    document.title = "Your Results — Voxidria";
    setError(null);
    if (!sessionId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSession(sessionId, getAccessTokenSilently)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Could not load results.");
        setLoading(false);
      });
  }, [sessionId, getAccessTokenSilently]);

  useEffect(() => {
    if (!sessionId || pseudoResult) return;

    const ageFromSession = normalizeAge(data?.session?.device_meta?.age);
    if (ageFromQuery == null && loading) return;

    const generated = ensurePseudoResult(sessionId, ageFromQuery ?? ageFromSession ?? 55);
    if (generated) setPseudoResult(generated);
  }, [sessionId, pseudoResult, ageFromQuery, data, loading]);

  useEffect(() => {
    setPseudoResult(sessionId ? getPseudoResult(sessionId) : null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setChatMessages([]);
      setChatInput("");
      setChatError(null);
      return;
    }

    const stored = getSessionGeminiChat(sessionId);
    const storedInitial = typeof stored?.initial_assistant_message === "string"
      ? stored.initial_assistant_message
      : "";
    const shouldUseStoredInitial = storedInitial && isCompleteInitialExplanation(storedInitial);

    setChatMessages(
      shouldUseStoredInitial
        ? makeInitialAssistantMessage(storedInitial, stored?.created_at)
        : []
    );

    setChatInput("");
    setChatError(null);
  }, [sessionId]);

  // Animate score counter
  useEffect(() => {
    const target = pseudoResult?.score;
    if (target == null) return;
    setAnimScore(0);
    setShowExplanation(false);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setAnimScore(current);
      if (current >= target) {
        clearInterval(interval);
        setShowExplanation(true);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [pseudoResult?.score]);

  const session = data?.session;
  const readingTask = data?.tasks?.find((t) => t.task_type === "READING");

  const score = pseudoResult?.score ?? null;
  const bucket = pseudoResult?.bucket ?? null;
  const featureSummary = pseudoResult?.featureSummary ?? null;
  const geminiExplanation = pseudoResult?.geminiExplanation ?? null;
  const qualityFlags = pseudoResult?.qualityFlags ?? null;
  const ageUsed = pseudoResult?.age ?? null;
  const nextSteps = bucket ? nextStepsForBucket(bucket) : [];

  const readingSummary = useMemo(() => {
    if (!Array.isArray(readingTask?.analysis_json?.summary)) return [];
    return readingTask.analysis_json.summary
      .filter((point) => typeof point === "string")
      .map((point) => point.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [readingTask]);

  const resultSnapshot = useMemo(
    () => ({
      session_id: sessionId,
      score,
      bucket,
      age: ageUsed,
      quality_flags: qualityFlags,
      feature_summary: featureSummary,
      reading_summary: readingSummary,
      screened_at: session?.created_at ?? null,
    }),
    [sessionId, score, bucket, ageUsed, qualityFlags, featureSummary, readingSummary, session?.created_at]
  );

  useEffect(() => {
    if (!sessionId || !showExplanation || chatMessages.length > 0) return;

    const existing = getSessionGeminiChat(sessionId);
    if (existing?.initial_assistant_message && isCompleteInitialExplanation(existing.initial_assistant_message)) {
      setChatMessages(makeInitialAssistantMessage(existing.initial_assistant_message, existing.created_at));
      return;
    }

    const now = new Date().toISOString();

    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
      const fallback = geminiExplanation || "AI response unavailable. Add a provider key to enable Vox chat.";
      const seeded = {
        model: normalizeGeminiModelName(REQUESTED_GEMINI_MODEL),
        resultsSnapshot: resultSnapshot,
        initial_assistant_message: fallback,
        created_at: now,
        updated_at: now,
      };
      saveSessionGeminiChat(sessionId, seeded);
      setChatMessages(makeInitialAssistantMessage(seeded.initial_assistant_message, now));
      setChatError("No AI key configured. Add VITE_GEMINI_API_KEY and/or VITE_OPENAI_API_KEY in frontend/.env.");
      return;
    }

    let cancelled = false;
    setChatLoading(true);
    setChatError(null);

    callVoxText(initialExplanationPrompt(resultSnapshot), {
      maxOutputTokens: 1200,
      temperature: 0.2,
      validator: isCompleteInitialExplanation,
    })
      .then(({ text: assistantText, model }) => {
        if (cancelled) return;
        const seeded = {
          model,
          resultsSnapshot: resultSnapshot,
          initial_assistant_message: assistantText,
          created_at: now,
          updated_at: now,
        };
        saveSessionGeminiChat(sessionId, seeded);
        setChatMessages(makeInitialAssistantMessage(seeded.initial_assistant_message, now));
      })
      .catch((err) => {
        if (cancelled) return;
        const fallback = geminiExplanation || "I could not generate an explanation right now.";
        const seeded = {
          model: normalizeGeminiModelName(REQUESTED_GEMINI_MODEL),
          resultsSnapshot: resultSnapshot,
          initial_assistant_message: fallback,
          created_at: now,
          updated_at: now,
        };
        saveSessionGeminiChat(sessionId, seeded);
        setChatMessages(makeInitialAssistantMessage(seeded.initial_assistant_message, now));
        setChatError(err.message || "Could not create Gemini explanation.");
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, showExplanation, chatMessages.length, resultSnapshot, geminiExplanation]);

  useEffect(() => {
    if (!chatLogRef.current) return;
    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  async function handleSendQuestion(event) {
    event.preventDefault();

    const question = chatInput.trim();
    if (!question || !sessionId || chatLoading) return;

    const now = new Date().toISOString();
    const userMessage = { role: "user", content: question, created_at: now };
    const existing = getSessionGeminiChat(sessionId) || {};
    const snapshot = existing.resultsSnapshot || resultSnapshot;
    const baseMessages = chatMessages.length > 0
      ? chatMessages
      : (existing.initial_assistant_message
        ? makeInitialAssistantMessage(existing.initial_assistant_message, existing.created_at)
        : []);

    const withUser = [...baseMessages, userMessage];

    setChatInput("");
    setChatError(null);
    setChatLoading(true);
    setChatMessages(withUser);

    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
      setChatError("No AI key configured. Add VITE_GEMINI_API_KEY and/or VITE_OPENAI_API_KEY in frontend/.env.");
      setChatLoading(false);
      return;
    }

    try {
      const { text: assistantText } = await callVoxText(
        followupPrompt(snapshot, withUser, question),
        { maxOutputTokens: 900, temperature: 0.2 }
      );
      const assistantMessage = {
        role: "assistant",
        content: assistantText,
        created_at: new Date().toISOString(),
      };
      const withAssistant = [...withUser, assistantMessage];
      setChatMessages(withAssistant);
    } catch (err) {
      setChatError(err.message || "Could not get Gemini response.");
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <nav className="res-nav">
          <div className="res-nav-logo" onClick={() => navigate("/")}>
            <img src="/logo.png" alt="Voxidria" height="38" />
          </div>
        </nav>
        <div className="res-loading-wrap">
          <div className="res-spinner" />
          <p style={{ fontSize: "0.82rem", color: "var(--res-muted)" }}>Loading your results…</p>
        </div>
      </>
    );
  }

  if ((error && !pseudoResult) || !sessionId) {
    return (
      <>
        <nav className="res-nav">
          <div className="res-nav-logo" onClick={() => navigate("/")}>
            <img src="/logo.png" alt="Voxidria" height="38" />
          </div>
        </nav>
        <div className="res-loading-wrap">
          <p className="res-error">{error || "No session specified."}</p>
          <button className="res-btn res-btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/")}>
            Go to Dashboard
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <nav className="res-nav">
        <div className="res-nav-logo" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="Voxidria" height="38" />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="res-btn res-btn-outline" onClick={() => navigate("/")}>← Dashboard</button>
          <button className="res-btn res-btn-primary" onClick={() => navigate("/record")}>New Screening</button>
        </div>
      </nav>

      <main className="res-main">
        {/* SCORE HERO */}
        <div className="res-score-hero res-fade-up">
          <div className="res-score-left">
            <div className="res-score-date">
              Screened{" "}
              {session?.created_at
                ? new Date(session.created_at).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })
                : "—"}
            </div>
            <div className="res-score-title">Parkinson&apos;s Speech Risk Score</div>

            {score != null ? (
              <>
                <div className="res-score-num" style={{ color: bucketColor[bucket] }}>{animScore}</div>
                <div className="res-score-sub">
                  out of 100 · age-calibrated risk proxy{ageUsed != null ? ` (Age ${ageUsed})` : ""}
                </div>
                <div
                  className="res-bucket-pill"
                  style={{ color: bucketColor[bucket], background: bucketBg[bucket] }}
                >
                  {bucket} Risk
                </div>
                {qualityFlags?.overall && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: qualityFlags.overall === "Good" ? "#0fa88a" : "var(--res-warn)", fontWeight: 600 }}>
                    ✓ Audio quality: {qualityFlags.overall}{qualityFlags.notes ? ` — ${qualityFlags.notes}` : ""}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="res-score-num" style={{ color: "var(--res-muted)", fontSize: "2.5rem", marginTop: "0.5rem" }}>—</div>
                <div className="res-score-sub">Score unavailable for this session.</div>
              </>
            )}
          </div>

          {score != null && (
            <div className="res-score-right">
              <svg width="150" height="85" viewBox="0 0 160 90">
                <path d="M 10 85 A 70 70 0 0 1 150 85" fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
                <path
                  d="M 10 85 A 70 70 0 0 1 150 85"
                  fill="none"
                  stroke={bucketColor[bucket]}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(animScore / 100) * 220} 220`}
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
                <text x="80" y="72" textAnchor="middle" fill={bucketColor[bucket]} fontSize="26" fontWeight="800" fontFamily="Montserrat">
                  {animScore}
                </text>
              </svg>
              <div className="res-gauge-sub">Risk Score Gauge</div>
              <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.4rem" }}>
                {["Low", "Moderate", "High"].map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: b === bucket ? bucketColor[b] : "var(--res-muted)", fontWeight: b === bucket ? 700 : 400 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: b === bucket ? bucketColor[b] : "var(--res-border)" }} />
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FEATURE SUMMARY */}
        {featureSummary && Object.keys(featureSummary).length > 0 && (
          <div className="res-fade-up res-delay-1">
            <div className="res-section-title">Vocal Biomarker Breakdown</div>
            <div className="res-features">
              {Object.entries(featureSummary).map(([key, f]) => (
                <div className="res-feature-row" key={key}>
                  <div className="res-feature-label">{f.label || key}</div>
                  <div className="res-feature-bar-wrap">
                    <div className="res-feature-bar">
                      <div
                        className="res-feature-bar-fill"
                        style={{ width: `${Math.min((f.value ?? 0) * 100, 100)}%`, background: statusColor[f.status] || "#21E6C1" }}
                      />
                    </div>
                    <div className="res-feature-value" style={{ color: statusColor[f.status] || "#21E6C1" }}>
                      {f.value}
                    </div>
                  </div>
                  <span className="res-feature-status" style={{ color: statusColor[f.status] || "#21E6C1", background: `${statusColor[f.status] || "#21E6C1"}18` }}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* READING ANALYSIS */}
        {readingTask?.analysis_json && (
          <div className="res-fade-up res-delay-1">
            <div className="res-section-title">Reading Task Analysis</div>
            <div className="res-gemini-card">
              <div className="res-gemini-header">
                <div className="res-gemini-icon">G</div>
                <div>
                  <div className="res-gemini-title">Gemini Reading Analysis</div>
                  <div className="res-gemini-sub">Speech fluency and alignment analysis</div>
                </div>
              </div>
              <div className="res-gemini-body">
                {readingTask.analysis_json.summary?.map((point, i) => (
                  <p key={i} style={{ marginBottom: "0.5rem" }}>• {point}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GEMINI EXPLANATION CHAT (LOCAL PERSISTENCE) */}
        {showExplanation && (
          <div className="res-gemini-card res-fade-up res-delay-2">
              <div className="res-gemini-header">
              <div className="res-gemini-icon">V</div>
              <div>
                <div className="res-gemini-title">{VOX_NAME}</div>
                <div className="res-gemini-sub">{VOX_BRAND_SUBTITLE}</div>
              </div>
            </div>

            <div className="res-gemini-chat-log" ref={chatLogRef}>
              {chatMessages.map((message, idx) => (
                <div
                  key={`${message.created_at || idx}-${idx}`}
                  className={`res-chat-row ${message.role === "user" ? "res-chat-row-user" : "res-chat-row-assistant"}`}
                >
                  <div className={`res-chat-bubble ${message.role === "user" ? "res-chat-bubble-user" : "res-chat-bubble-assistant"}`}>
                    {renderChatMessageContent(message.content)}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="res-chat-row res-chat-row-assistant">
                  <div className="res-chat-bubble res-chat-bubble-assistant">{VOX_NAME} is thinking…</div>
                </div>
              )}
            </div>

            <form className="res-gemini-chat-form" onSubmit={handleSendQuestion}>
              <input
                className="res-gemini-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask ${VOX_NAME} about this screening result`}
                disabled={chatLoading}
              />
              <button className="res-btn res-btn-primary" type="submit" disabled={chatLoading || !chatInput.trim()}>
                {chatLoading ? "…" : "Ask"}
              </button>
            </form>

            {!GEMINI_API_KEY && !OPENAI_API_KEY && (
              <p className="res-chat-hint">
                Add <code>VITE_GEMINI_API_KEY</code> and/or <code>VITE_OPENAI_API_KEY</code> in <code>frontend/.env</code> to enable live {VOX_NAME} replies.
              </p>
            )}

            {chatError && <p className="res-chat-error">{chatError}</p>}
          </div>
        )}

        {/* NEXT STEPS */}
        {nextSteps.length > 0 && (
          <div className="res-next-steps res-fade-up res-delay-3">
            <div className="res-next-header">Recommended Next Steps</div>
            <ul className="res-next-list">
              {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {/* DISCLAIMER */}
        <div className="res-disclaimer res-fade-up res-delay-3">
          ⚠️ <strong>Not a medical diagnosis.</strong> This screening tool estimates Parkinson&apos;s
          speech-related risk only. Please consult a qualified healthcare professional if you have concerns.
        </div>

        {/* ACTIONS */}
        <div className="res-btn-row res-fade-up res-delay-3">
          <button className="res-btn res-btn-primary" onClick={() => navigate("/record")}>
            Take Another Screening →
          </button>
          <button className="res-btn res-btn-outline" onClick={() => navigate("/")}>
            View All History
          </button>
        </div>
      </main>
    </>
  );
}
