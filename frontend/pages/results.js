import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";

const MOCK_RESULT = {
  session_id: "mock",
  date: "2026-02-28",
  risk_score: 34,
  risk_bucket: "Low",
  quality_flags: { overall: "Good", notes: "Clear recording detected." },
  feature_summary: {
    jitter:         { value: 0.42, label: "Jitter (pitch cycle variation)",  status: "normal"   },
    shimmer:        { value: 0.61, label: "Shimmer (amplitude variation)",   status: "normal"   },
    hnr:            { value: 21.4, label: "Harmonics-to-Noise Ratio",        status: "normal"   },
    speech_fluency: { value: 0.87, label: "Speech Fluency",                  status: "normal"   },
  },
  gemini_explanation: `Your voice sample shows characteristics that fall within a typical range for the vocal biomarkers we measured.

**What we found:** Your pitch stability (jitter) and volume consistency (shimmer) were both within normal limits. Your harmonics-to-noise ratio suggests a relatively clear vocal quality and your speech fluency was consistent.

**What this means:** A low risk score like yours suggests that your voice does not currently show the acoustic patterns most commonly associated with Parkinson's-related speech changes at this time.

**What to do next:** Continue checking in periodically — vocal changes can develop gradually. If you notice changes in your voice such as reduced volume, monotone quality, or difficulty articulating, consider discussing them with a healthcare professional.`,
  next_steps: [
    "Schedule a follow-up screening in 4–6 weeks to track any changes.",
    "If your voice feels quieter, monotone, or harder to control, consult a neurologist.",
    "Maintain vocal health with regular hydration and vocal exercises.",
  ],
};

const bucketColor = { Low: "#21E6C1", Moderate: "#F7CC3B", High: "#EF4444" };
const bucketBg    = { Low: "rgba(33,230,193,0.1)", Moderate: "rgba(247,204,59,0.1)", High: "rgba(239,68,68,0.1)" };
const statusColor = { normal: "#21E6C1", elevated: "#F7CC3B", high: "#EF4444" };

export default function Results() {
  const router = useRouter();
  const { session } = router.query;
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [animScore, setAnimScore]     = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    setTimeout(() => { setResult(MOCK_RESULT); setLoading(false); }, 400);
  }, [router.isReady, session]);

  useEffect(() => {
    if (!result) return;
    let current = 0;
    const target = result.risk_score;
    const interval = setInterval(() => {
      current += 1;
      setAnimScore(current);
      if (current >= target) { clearInterval(interval); setShowExplanation(true); }
    }, 25);
    return () => clearInterval(interval);
  }, [result]);

  const formatExplanation = (text) =>
    text.split("\n\n").map((para, i) => {
      const formatted = para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} style={{ marginBottom:"1rem" }} />;
    });

  return (
    <>
      <Head>
        <title>Your Results — Voxidria</title>
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy:  #1A2E44;
          --green: #21E6C1;
          --lime:  #A4FF00;
          --slate: #F9FAFB;
          --white: #FFFFFF;
          --muted: #6B7280;
          --border:#E5E7EB;
          --danger:#EF4444;
          --warn:  #F7CC3B;
          --font:  'Montserrat', sans-serif;
        }
        html, body { background: var(--slate); color: var(--navy); font-family: var(--font); }

        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .fade-up  { animation: fadeUp 0.6s ease both; }
        .delay-1  { animation-delay: 0.1s; }
        .delay-2  { animation-delay: 0.25s; }
        .delay-3  { animation-delay: 0.4s; }

        nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 2.5rem; background: var(--white);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 1px 8px rgba(26,46,68,0.06);
        }
        .nav-logo { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .nav-logo img { height: 38px; width: auto; }
        .btn {
          padding: 0.5rem 1.2rem; border-radius: 6px; font-family: var(--font);
          font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-outline { background: transparent; border: 1.5px solid var(--border); color: var(--muted); }
        .btn-outline:hover { border-color: var(--navy); color: var(--navy); }
        .btn-primary {
          background: linear-gradient(135deg, var(--navy), var(--green));
          border: none; color: white; font-weight: 700;
          box-shadow: 0 2px 12px rgba(33,230,193,0.2);
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

        main { max-width: 820px; margin: 0 auto; padding: 2.5rem 2rem; }

        /* Score hero */
        .score-hero {
          display: grid; grid-template-columns: 1fr 260px; gap: 0;
          border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
          background: var(--white); margin-bottom: 1.5rem;
          box-shadow: 0 2px 12px rgba(26,46,68,0.07);
        }
        .score-left { padding: 2.2rem; }
        .score-date { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 1rem; font-weight: 600; }
        .score-title { font-size: 0.85rem; font-weight: 600; color: var(--muted); margin-bottom: 0.4rem; }
        .score-num { font-size: 6rem; font-weight: 800; letter-spacing: -0.05em; line-height: 1; margin-bottom: 0.4rem; }
        .score-sub { font-size: 0.75rem; color: var(--muted); }
        .bucket-pill { display: inline-block; padding: 0.35rem 1rem; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-top: 0.8rem; }
        .score-right {
          padding: 2.2rem; border-left: 1px solid var(--border);
          background: linear-gradient(135deg, rgba(26,46,68,0.02), rgba(33,230,193,0.04));
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem;
        }
        .gauge-sub { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 600; }

        /* Features */
        .section-title { font-size: 1rem; font-weight: 700; color: var(--navy); margin-bottom: 1rem; }
        .features { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--white); margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(26,46,68,0.05); }
        .feature-row { padding: 0.9rem 1.2rem; display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid var(--border); }
        .feature-row:last-child { border-bottom: none; }
        .feature-label { flex: 1; font-size: 0.8rem; color: var(--muted); font-weight: 500; }
        .feature-bar-wrap { flex: 1.5; display: flex; align-items: center; gap: 0.6rem; }
        .feature-bar { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .feature-bar-fill { height: 100%; border-radius: 3px; }
        .feature-value { font-size: 0.78rem; font-weight: 700; min-width: 38px; text-align: right; }
        .feature-status { font-size: 0.67rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 700; }

        /* Gemini */
        .gemini-card { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--white); margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(26,46,68,0.05); }
        .gemini-header { background: linear-gradient(135deg, rgba(26,46,68,0.04), rgba(33,230,193,0.06)); padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.8rem; }
        .gemini-icon { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, var(--navy), var(--green)); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; color: white; font-weight: 700; }
        .gemini-title { font-size: 0.9rem; font-weight: 700; color: var(--navy); }
        .gemini-sub { font-size: 0.72rem; color: var(--muted); }
        .gemini-body { padding: 1.5rem; font-size: 0.85rem; color: var(--muted); line-height: 1.8; }
        .gemini-body strong { color: var(--navy); font-weight: 700; }

        /* Next steps */
        .next-steps { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--white); margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(26,46,68,0.05); }
        .next-header { background: var(--slate); padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; font-weight: 700; color: var(--navy); }
        .next-list { list-style: none; }
        .next-list li { padding: 0.9rem 1.5rem; border-bottom: 1px solid var(--border); font-size: 0.82rem; color: var(--muted); line-height: 1.6; display: flex; gap: 0.7rem; }
        .next-list li:last-child { border-bottom: none; }
        .next-list li::before { content: '→'; color: var(--green); flex-shrink: 0; font-weight: 700; }

        .disclaimer { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 1rem 1.4rem; font-size: 0.78rem; color: #7f1d1d; line-height: 1.6; margin-bottom: 1.5rem; }
        .disclaimer strong { font-weight: 700; }

        .btn-row { display: flex; gap: 1rem; flex-wrap: wrap; }

        .loading-wrap { text-align: center; padding: 6rem 2rem; }
        .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }

        @media(max-width:640px) {
          .score-hero { grid-template-columns: 1fr; }
          .score-right { border-left: none; border-top: 1px solid var(--border); }
        }
      `}</style>

      <nav>
        <div className="nav-logo" onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Voxidria" width={84} height={28} />
        </div>
        <div style={{ display:"flex", gap:"0.75rem" }}>
          <button className="btn btn-outline" onClick={() => router.push("/dashboard")}>← Dashboard</button>
          <button className="btn btn-primary" onClick={() => router.push("/record")}>New Screening</button>
        </div>
      </nav>

      <main>
        {loading ? (
          <div className="loading-wrap">
            <div className="spinner" />
            <p style={{ fontSize:"0.82rem", color:"var(--muted)" }}>Loading your results...</p>
          </div>
        ) : result && (
          <>
            {/* SCORE HERO */}
            <div className="score-hero fade-up">
              <div className="score-left">
                <div className="score-date">
                  Screened {new Date(result.date).toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
                </div>
                <div className="score-title">Parkinson&apos;s Speech Risk Score</div>
                <div className="score-num" style={{ color: bucketColor[result.risk_bucket] }}>{animScore}</div>
                <div className="score-sub">out of 100 · probability proxy, not a diagnosis</div>
                <div className="bucket-pill" style={{ color: bucketColor[result.risk_bucket], background: bucketBg[result.risk_bucket] }}>
                  {result.risk_bucket} Risk
                </div>
                <div style={{ marginTop:"0.75rem", fontSize:"0.75rem", color: result.quality_flags.overall === "Good" ? "#0fa88a" : "var(--warn)", fontWeight:600 }}>
                  ● Audio quality: {result.quality_flags.overall} — {result.quality_flags.notes}
                </div>
              </div>
              <div className="score-right">
                <svg width="150" height="85" viewBox="0 0 160 90">
                  <path d="M 10 85 A 70 70 0 0 1 150 85" fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round"/>
                  <path d="M 10 85 A 70 70 0 0 1 150 85" fill="none" stroke={bucketColor[result.risk_bucket]} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(animScore/100)*220} 220`} style={{ transition:"stroke-dasharray 1s ease" }} />
                  <text x="80" y="72" textAnchor="middle" fill={bucketColor[result.risk_bucket]} fontSize="26" fontWeight="800" fontFamily="Montserrat">{animScore}</text>
                </svg>
                <div className="gauge-sub">Risk Score Gauge</div>
                <div style={{ display:"flex", gap:"0.8rem", marginTop:"0.4rem" }}>
                  {["Low","Moderate","High"].map(b => (
                    <div key={b} style={{ display:"flex", alignItems:"center", gap:4, fontSize:"0.65rem", color: b === result.risk_bucket ? bucketColor[b] : "var(--muted)", fontWeight: b === result.risk_bucket ? 700 : 400 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background: b === result.risk_bucket ? bucketColor[b] : "var(--border)" }} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FEATURES */}
            <div className="fade-up delay-1">
              <div className="section-title">Vocal Biomarker Breakdown</div>
              <div className="features">
                {Object.entries(result.feature_summary).map(([key, f]) => (
                  <div className="feature-row" key={key}>
                    <div className="feature-label">{f.label}</div>
                    <div className="feature-bar-wrap">
                      <div className="feature-bar">
                        <div className="feature-bar-fill" style={{ width:`${Math.min(f.value*60,100)}%`, background: statusColor[f.status] }} />
                      </div>
                      <div className="feature-value" style={{ color: statusColor[f.status] }}>{f.value}</div>
                    </div>
                    <span className="feature-status" style={{ color: statusColor[f.status], background:`${statusColor[f.status]}18` }}>{f.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GEMINI */}
            {showExplanation && (
              <div className="gemini-card fade-up delay-2">
                <div className="gemini-header">
                  <div className="gemini-icon">✦</div>
                  <div>
                    <div className="gemini-title">Gemini AI Explanation</div>
                    <div className="gemini-sub">Plain-language analysis of your results</div>
                  </div>
                </div>
                <div className="gemini-body">{formatExplanation(result.gemini_explanation)}</div>
              </div>
            )}

            {/* NEXT STEPS */}
            <div className="next-steps fade-up delay-3">
              <div className="next-header">Recommended Next Steps</div>
              <ul className="next-list">
                {result.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            {/* DISCLAIMER */}
            <div className="disclaimer fade-up delay-3">
              ⚠️ <strong>Not a medical diagnosis.</strong> This screening tool estimates Parkinson&apos;s speech-related risk only.
              Please consult a qualified healthcare professional if you have concerns.
            </div>

            {/* ACTIONS */}
            <div className="btn-row fade-up delay-3">
              <button className="btn btn-primary" onClick={() => router.push("/record")}>Take Another Screening →</button>
              <button className="btn btn-outline" onClick={() => router.push("/dashboard")}>View All History</button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
