import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getSession } from "../services/api";
import "./ResultsPage.css";

const bucketColor = { Low: "#21E6C1", Moderate: "#F7CC3B", High: "#EF4444" };
const bucketBg = { Low: "rgba(33,230,193,0.1)", Moderate: "rgba(247,204,59,0.1)", High: "rgba(239,68,68,0.1)" };
const statusColor = { normal: "#21E6C1", elevated: "#F7CC3B", high: "#EF4444" };

function toTitleCase(str) {
  if (!str) return str;
  return str.charAt(0) + str.slice(1).toLowerCase();
}

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

function formatExplanation(text) {
  if (!text) return null;
  return text.split("\n\n").map((para, i) => {
    const formatted = para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return (
      <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} style={{ marginBottom: "1rem" }} />
    );
  });
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

  useEffect(() => {
    document.title = "Your Results — Voxidria";
    if (!sessionId) { setLoading(false); return; }

    const TERMINAL = ["ANALYZED", "FAILED", "REJECTED_SHORT_AUDIO"];
    let cancelled = false;

    const poll = async () => {
      try {
        const d = await getSession(sessionId, getAccessTokenSilently);
        if (cancelled) return;
        setData(d);
        setLoading(false);

        const tasks = (d.tasks ?? []).filter((t) =>
          ["SUSTAINED_VOWEL", "READING"].includes(t.task_type)
        );
        const allTerminal = tasks.length > 0 && tasks.every((t) => TERMINAL.includes(t.task_status));
        const hasExplanation = !!d.session?.gemini_explanation;
        const sessionDone = ["DONE", "FAILED"].includes(d.session?.status);

        if (allTerminal && (hasExplanation || sessionDone)) return;
        if (!cancelled) setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not load results.");
        setLoading(false);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [sessionId, getAccessTokenSilently]);

  // Animate score counter
  useEffect(() => {
    const score = data?.session?.risk_score;
    if (score == null) return;
    let current = 0;
    const target = score;
    const interval = setInterval(() => {
      current += 1;
      setAnimScore(current);
      if (current >= target) { clearInterval(interval); setShowExplanation(true); }
    }, 25);
    return () => clearInterval(interval);
  }, [data]);

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

  if (error || !sessionId) {
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

  // Risk data lives on session directly; tasks come from task_map
  const session = data?.session;
  const vowelTask = data?.task_map?.["SUSTAINED_VOWEL"] ?? data?.tasks?.find((t) => t.task_type === "SUSTAINED_VOWEL");
  const readingTask = data?.task_map?.["READING"] ?? data?.tasks?.find((t) => t.task_type === "READING");

  const TERMINAL = ["ANALYZED", "FAILED", "REJECTED_SHORT_AUDIO"];
  const isStillProcessing =
    !data ||
    !(data.tasks ?? [])
      .filter((t) => ["SUSTAINED_VOWEL", "READING"].includes(t.task_type))
      .every((t) => TERMINAL.includes(t.task_status));

  // Risk score + bucket are columns on test_sessions
  const hasPrediction = session?.risk_score != null;
  const rawBucket = session?.risk_bucket ?? null;
  const bucket = rawBucket ? toTitleCase(rawBucket) : null;
  const score = session?.risk_score ?? null;
  const geminiExplanation = session?.gemini_explanation ?? null;

  // Feature summary from vowel task's analysis_json
  const featureSummary = vowelTask?.analysis_json?.feature_summary ?? null;

  const readingBiomarkers = readingTask?.analysis_json ?? null;

  const qualityFlags = null; // quality_flags no longer stored

  // If no prediction yet, check session status
  const isScoreProcessing = !hasPrediction && isStillProcessing;
  const nextSteps = bucket ? nextStepsForBucket(bucket) : [];

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
        {/* TASK STATUS PANEL — shown while any task is still running */}
        {isStillProcessing && (
          <div className="res-fade-up" style={{ marginBottom: "1.5rem" }}>
            <div className="res-section-title">Analysis in progress…</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[vowelTask, readingTask].map((t) => {
                if (!t) return null;
                const label = t.task_type === "SUSTAINED_VOWEL" ? "Sustained Vowel" : "Sentence Reading";
                const status = t?.task_status ?? "PENDING";
                const running = !TERMINAL.includes(status);
                return (
                  <div key={t.task_type} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.75rem 1rem", borderRadius: "10px",
                    background: "var(--res-card)", border: "1px solid var(--res-border)",
                    fontSize: "0.82rem", fontWeight: 600,
                  }}>
                    {running ? (
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "2px solid var(--res-border)", borderTopColor: "#21E6C1",
                        animation: "res-spin 0.8s linear infinite", flexShrink: 0,
                      }} />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: status === "ANALYZED" ? "#21E6C1" : "#EF4444", flexShrink: 0 }} />
                    )}
                    <span style={{ color: "var(--res-heading)" }}>{label}</span>
                    <span style={{ marginLeft: "auto", color: running ? "#F7CC3B" : status === "ANALYZED" ? "#21E6C1" : "#EF4444" }}>
                      {status === "PENDING" || status === "UPLOADED" ? "Waiting…"
                        : status === "PROCESSING" ? "Analyzing…"
                        : status === "ANALYZED" ? "Done"
                        : status === "REJECTED_SHORT_AUDIO" ? "Too short"
                        : "Failed"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REJECTED SHORT AUDIO */}
        {readingTask?.task_status === "REJECTED_SHORT_AUDIO" && (
          <div className="res-fade-up" style={{
            padding: "1rem 1.2rem", borderRadius: "10px", marginBottom: "1.5rem",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            fontSize: "0.85rem", color: "#EF4444", fontWeight: 600,
          }}>
            Reading audio was too short (minimum 13 seconds). Please take a new screening.
          </div>
        )}

        {/* TASK FAILED */}
        {(vowelTask?.task_status === "FAILED" || readingTask?.task_status === "FAILED") && (
          <div className="res-fade-up" style={{
            padding: "1rem 1.2rem", borderRadius: "10px", marginBottom: "1.5rem",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            fontSize: "0.85rem", color: "#EF4444",
          }}>
            {[vowelTask, readingTask]
              .filter((t) => t?.task_status === "FAILED")
              .map((t) => (
                <div key={t.task_type}>
                  <strong>{t.task_type === "SUSTAINED_VOWEL" ? "Vowel" : "Reading"} analysis failed:</strong>{" "}
                  {t.error_message || "An unexpected error occurred."}
                </div>
              ))}
          </div>
        )}

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

            {isScoreProcessing ? (
              <>
                <div className="res-score-num" style={{ color: "var(--res-muted)", fontSize: "2.5rem", marginTop: "0.5rem" }}>
                  Processing…
                </div>
                <div className="res-score-sub">Analysis is still running. Check back shortly.</div>
              </>
            ) : score != null ? (
              <>
                <div className="res-score-num" style={{ color: bucketColor[bucket] }}>{animScore}</div>
                <div className="res-score-sub">out of 100 · probability proxy, not a diagnosis</div>
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
                <div className="res-score-sub">No ML prediction available for this session.</div>
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
                        style={{ width: `${Math.min((f.value ?? 0) * 60, 100)}%`, background: statusColor[f.status] || "#21E6C1" }}
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

        {/* READING BIOMARKERS */}
        {readingBiomarkers && readingTask?.task_status === "ANALYZED" && (
          <div className="res-fade-up res-delay-1">
            <div className="res-section-title">Reading Task Biomarkers</div>
            <div className="res-features">
              {[
                { key: "pause_ratio",       label: "Pause Ratio",       fmt: (v) => `${(v * 100).toFixed(1)}%` },
                { key: "pitch_std_hz",      label: "Pitch Variability", fmt: (v) => `${v} Hz` },
                { key: "loudness_cv",       label: "Loudness Variability", fmt: (v) => v?.toFixed(3) },
                { key: "speech_rate_wpm",   label: "Speech Rate",       fmt: (v) => v != null ? `${v} WPM` : "—" },
                { key: "reading_speed_cps", label: "Reading Speed",     fmt: (v) => `${v} CPS` },
              ].map(({ key, label, fmt }) => {
                const val = readingBiomarkers[key];
                if (val == null) return null;
                return (
                  <div className="res-feature-row" key={key}>
                    <div className="res-feature-label">{label}</div>
                    <div className="res-feature-bar-wrap">
                      <div className="res-feature-bar">
                        <div className="res-feature-bar-fill" style={{ width: "40%", background: "#21E6C1" }} />
                      </div>
                      <div className="res-feature-value" style={{ color: "#21E6C1" }}>{fmt(val)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {readingBiomarkers.transcript && (
              <div style={{
                marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: "10px",
                background: "var(--res-card)", border: "1px solid var(--res-border)",
                fontSize: "0.8rem", color: "var(--res-muted)", lineHeight: 1.6,
              }}>
                <strong style={{ color: "var(--res-heading)", display: "block", marginBottom: "0.35rem" }}>Transcript</strong>
                {readingBiomarkers.transcript}
              </div>
            )}
          </div>
        )}

        {/* GEMINI EXPLANATION */}
        {showExplanation && geminiExplanation && (
          <div className="res-gemini-card res-fade-up res-delay-2">
            <div className="res-gemini-header">
              <div className="res-gemini-icon">G</div>
              <div>
                <div className="res-gemini-title">Gemini AI Explanation</div>
                <div className="res-gemini-sub">Plain-language analysis of your results</div>
              </div>
            </div>
            <div className="res-gemini-body">{formatExplanation(geminiExplanation)}</div>
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
