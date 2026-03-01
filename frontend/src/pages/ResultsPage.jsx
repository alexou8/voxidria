import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getSession } from "../services/api";
import { ensurePseudoResult, getPseudoResult, normalizeAge } from "../utils/pseudoResults";
import "./ResultsPage.css";

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
  const ageFromQuery = normalizeAge(searchParams.get("age"));
  const { getAccessTokenSilently } = useAuth0();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pseudoResult, setPseudoResult] = useState(() => (sessionId ? getPseudoResult(sessionId) : null));
  const [animScore, setAnimScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    setPseudoResult(sessionId ? getPseudoResult(sessionId) : null);
  }, [sessionId]);

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

  const session = data?.session;
  const readingTask = data?.tasks?.find((t) => t.task_type === "READING");

  const score = pseudoResult?.score ?? null;
  const bucket = pseudoResult?.bucket ?? null;
  const featureSummary = pseudoResult?.featureSummary ?? null;
  const geminiExplanation = pseudoResult?.geminiExplanation ?? null;
  const qualityFlags = pseudoResult?.qualityFlags ?? null;
  const ageUsed = pseudoResult?.age ?? null;
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
