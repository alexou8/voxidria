import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./LandingPage.css";

export default function LandingPage() {
  const { loginWithRedirect } = useAuth0();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.title = "Voxidria — Voice AI for Health Discovery";
  }, []);

  return (
    <>
      {/* NAV */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <img src="/logo.png" alt="Voxidria" height="44" />
        </div>
        <div className="nav-btns">
          <button className="btn-nav-outline" onClick={() => loginWithRedirect()}>
            Dashboard
          </button>
          <button className="btn-nav-filled" onClick={() => loginWithRedirect()}>
            Sign In
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <img
          src="/logo-icon.png"
          alt="Voxidria Icon"
          className={`hero-logo${mounted ? " fade-up" : ""}`}
        />

        <div className={`badge${mounted ? " fade-up delay-1" : ""}`}>
          <div className="badge-dot" />
          Voice AI · Early Detection · Parkinson&apos;s Screening
        </div>

        <h1 className={mounted ? "fade-up delay-1" : ""}>
          Hear what your
          <br />
          <em>voice reveals</em>
        </h1>

        <p className={`subtitle${mounted ? " fade-up delay-2" : ""}`}>
          Two short voice tasks. Advanced ML analysis. Plain-language results
          powered by Gemini AI. Parkinson&apos;s speech-risk screening in under
          2 minutes.
        </p>

        <div className={`cta-row${mounted ? " fade-up delay-3" : ""}`}>
          <button className="btn-primary-hero" onClick={() => loginWithRedirect()}>
            Start Free Screening →
          </button>
          <button
            className="btn-secondary-hero"
            onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
          >
            How it works
          </button>
        </div>

        <div className={`wave-visual${mounted ? " fade-up delay-4" : ""}`}>
          {[14, 22, 38, 50, 44, 58, 34, 48, 60, 42, 52, 38, 44, 26, 18, 32, 50, 44, 28, 16].map(
            (h, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{
                  "--min-h": `${Math.max(6, h * 0.3)}px`,
                  "--max-h": `${h}px`,
                  "--dur": `${0.6 + (i % 5) * 0.15}s`,
                  animationDelay: `${i * 0.07}s`,
                }}
              />
            )
          )}
        </div>
      </section>

      {/* STATS */}
      <div className="stats-row">
        {[
          { num: "2", unit: " min", label: "Average screening time" },
          { num: "85", unit: "%+", label: "Model accuracy on test data" },
          { num: "2", unit: " tasks", label: "Voice recordings required" },
          { num: "0", unit: " cost", label: "Free to screen" },
        ].map((s, i) => (
          <div className="stat-item" key={i}>
            <div className="stat-num">
              {s.num}
              <span>{s.unit}</span>
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* DISCLAIMER */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 3rem 0" }}>
        <div className="l-disclaimer">
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <p>
            <strong>Medical Disclaimer: </strong>
            Voxidria is a screening tool only and does not provide a medical diagnosis. Results are
            indicative only. If you have concerns about your health, please consult a qualified
            healthcare professional.
          </p>
        </div>
      </div>

      {/* FEATURES */}
      <div className="l-section">
        <div className="section-label">Core capabilities</div>
        <div className="section-title">Built on clinical voice biomarkers</div>
        <div className="l-cards">
          {[
            { n: "01", title: "Jitter & Shimmer Analysis", desc: "Measures cycle-to-cycle pitch and amplitude variation — key acoustic biomarkers associated with vocal tremor in Parkinson's." },
            { n: "02", title: "MFCCs & Harmonics", desc: "Mel-frequency cepstral coefficients capture fine spectral texture. Harmonics-to-noise ratio quantifies vocal breathiness." },
            { n: "03", title: "Gemini AI Explanation", desc: "Your results are translated into plain language by Gemini, with personalised next steps — never a wall of numbers." },
            { n: "04", title: "Auth0 Secure Login", desc: "Your voice data is encrypted and tied to your authenticated identity. You control deletion at any time." },
            { n: "05", title: "Longitudinal Tracking", desc: "Track your vocal health over time. Compare sessions and monitor trends with a simple dashboard history." },
          ].map((c) => (
            <div className="l-card" key={c.n}>
              <div className="card-num">{c.n}</div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="how-section-bg">
        <div className="l-section" id="how">
          <div className="section-label">Process</div>
          <div className="section-title">Two tasks. Under two minutes.</div>
          <div className="l-steps">
            {[
              { n: "1", title: 'Sustained Pitch — "Ahhh"', desc: "Hold the vowel sound for ~5 seconds in a quiet environment. This reveals pitch stability, jitter, shimmer, and harmonic structure." },
              { n: "2", title: "Sentence Reading", desc: "Read a fixed sentence aloud at a natural pace. Gemini analyses pauses, hesitation markers, and fluency in real time." },
            ].map((s) => (
              <div className="l-step" key={s.n}>
                <div className="l-step-num">{s.n}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "3rem", textAlign: "center" }}>
            <button className="btn-primary-hero" onClick={() => loginWithRedirect()}>
              Begin Your Screening →
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-logo">
          <img src="/logo.png" alt="Voxidria" height="28" style={{ opacity: 0.7, filter: "brightness(0) invert(1)" }} />
          <span>VOXIDRIA</span>
        </div>
        <span>© 2026 Voxidria. Built at a hackathon.</span>
        <span>Not a medical device · Auth0 · Gemini · Supabase</span>
      </footer>
    </>
  );
}
