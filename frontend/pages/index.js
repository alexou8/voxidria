import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";

export default function Landing() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  return (
    <>
      <Head>
        <title>Voxidria — Voice AI for Health Discovery</title>
      </Head>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :root {
          --navy: #1a2e44;
          --green: #21e6c1;
          --lime: #a4ff00;
          --slate: #f9fafb;
          --white: #ffffff;
          --muted: #6b7280;
          --border: #e5e7eb;
          --danger: #ef4444;
          --warn: #f7cc3b;
          --font: "Montserrat", sans-serif;
        }

        html,
        body {
          background: var(--slate);
          color: var(--navy);
          font-family: var(--font);
          overflow-x: hidden;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes pulse-dot {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes wave-bar {
          from {
            height: var(--min-h, 8px);
          }
          to {
            height: var(--max-h, 40px);
          }
        }

        .fade-up {
          animation: fadeUp 0.8s ease both;
        }
        .delay-1 {
          animation-delay: 0.15s;
        }
        .delay-2 {
          animation-delay: 0.3s;
        }
        .delay-3 {
          animation-delay: 0.45s;
        }
        .delay-4 {
          animation-delay: 0.6s;
        }

        /* NAV */
        nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.2rem 3rem 1.2rem 1.0rem;;
          background: var(--white);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 8px rgba(26, 46, 68, 0.06);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .nav-logo img {
          height: 55px;
          width: auto;
        }
        .nav-logo-text {
          font-size: 1.3rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .nav-btns {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .btn-nav-outline {
          background: transparent;
          border: 1.5px solid var(--navy);
          color: var(--navy);
          padding: 0.5rem 1.3rem;
          border-radius: 6px;
          font-family: var(--font);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-nav-outline:hover {
          background: var(--navy);
          color: white;
        }
        .btn-nav-filled {
          background: linear-gradient(135deg, var(--navy), var(--green));
          color: white;
          padding: 0.5rem 1.3rem;
          border-radius: 6px;
          font-family: var(--font);
          font-size: 0.85rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-nav-filled:hover {
          opacity: 0.88;
          transform: translateY(-1px);
        }

        /* HERO */
        .hero {
          min-height: 88vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 2rem 4rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(33, 230, 193, 0.07) 0%,
            rgba(26, 46, 68, 0.04) 60%,
            rgba(164, 255, 0, 0.05) 100%
          );
          pointer-events: none;
        }

        .hero-logo {
        width: 270px; 
        height: auto; 
        margin-bottom: 2rem;
        margin-left: auto; 
        margin-right: auto;
        image-rendering: -webkit-optimize-contrast;
        animation: float 5s ease-in-out infinite;
}

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          animation: pulse-dot 1.5s ease-out infinite;
        }

        h1 {
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          margin-bottom: 1.4rem;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(33, 230, 193, 0.1);
          border: 1px solid rgba(33, 230, 193, 0.35);
          color: #0fa88a;
          padding: 0.35rem 1rem;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 1.8rem;
          align-self: center;
        }
          color: var(--navy);
        }
        h1 em {
          font-style: normal;
          background: linear-gradient(135deg, var(--navy), var(--green));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          max-width: 560px;
          color: var(--muted);
          font-size: 1.05rem;
          line-height: 1.75;
          font-weight: 400;
          margin-bottom: 2.8rem;
        }

        .cta-row {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3.5rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--navy), var(--green));
          color: white;
          font-family: var(--font);
          font-weight: 700;
          font-size: 1rem;
          padding: 0.9rem 2.4rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(33, 230, 193, 0.25);
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(33, 230, 193, 0.35);
        }

        .btn-secondary {
          background: white;
          color: var(--navy);
          font-family: var(--font);
          font-weight: 600;
          font-size: 1rem;
          padding: 0.9rem 2.4rem;
          border-radius: 8px;
          border: 1.5px solid var(--border);
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          border-color: var(--green);
          color: #0fa88a;
        }

        /* Waveform */
        .wave-visual {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 56px;
          animation: float 4s ease-in-out infinite;
        }
        .wave-bar {
          width: 4px;
          border-radius: 2px;
          background: linear-gradient(to top, var(--navy), var(--green));
          opacity: 0.6;
          animation: wave-bar var(--dur, 1s) ease-in-out infinite alternate;
        }

        /* STATS */
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
          padding: 2.5rem 3rem;
          background: var(--white);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .stat-item {
          text-align: center;
        }
        .stat-num {
          font-size: 2rem;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -0.02em;
        }
        .stat-num span { color: #6B9E9A; }
        }
        .stat-label {
          font-size: 0.78rem;
          color: var(--muted);
          font-weight: 400;
          margin-top: 0.25rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        /* SECTIONS */
        .section {
          padding: 5rem 3rem;
          max-width: 1100px;
          margin: 0 auto;
        }
        .section-label {
          font-size: 0.72rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--green);
          margin-bottom: 0.75rem;
          font-weight: 700;
        }
        .section-title {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 3rem;
          color: var(--navy);
        }

        /* CARDS */
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          transition: all 0.25s;
          box-shadow: 0 1px 4px rgba(26, 46, 68, 0.05);
        }
        .card:hover {
          border-color: var(--green);
          box-shadow: 0 4px 20px rgba(33, 230, 193, 0.12);
          transform: translateY(-2px);
        }
        .card-num {
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          color: var(--green);
          margin-bottom: 1rem;
          text-transform: uppercase;
          font-weight: 700;
        }
        .card h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 0.6rem;
          color: var(--navy);
        }
        .card p {
          font-size: 0.83rem;
          color: var(--muted);
          line-height: 1.7;
          font-weight: 400;
        }

        /* HOW IT WORKS */
        .steps {
          display: flex;
          flex-direction: column;
        }
        .step {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 2rem;
          padding: 2.2rem 0;
          border-bottom: 1px solid var(--border);
          align-items: start;
        }
        .step:last-child {
          border-bottom: none;
        }
        .step-num {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--navy), var(--green));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          font-weight: 800;
          color: white;
        }
        .step h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.4rem;
          color: var(--navy);
        }
        .step p {
          font-size: 0.83rem;
          color: var(--muted);
          line-height: 1.7;
        }

        /* DISCLAIMER */
        .disclaimer {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 1.2rem 1.8rem;
          margin: 2rem 0;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }
        .disclaimer p {
          font-size: 0.8rem;
          color: #7f1d1d;
          line-height: 1.6;
        }
        .disclaimer strong {
          font-weight: 700;
        }

        /* FOOTER */
        footer {
          background: var(--navy);
          color: rgba(255, 255, 255, 0.6);
          padding: 2rem 3rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        footer .footer-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        footer .footer-logo img {
          height: 28px;
          filter: brightness(0) invert(1);
          opacity: 0.7;
        }
        footer .footer-logo span {
          color: white;
          font-weight: 700;
          letter-spacing: 0.05em;
          font-size: 0.9rem;
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <Image src="/logo.png" alt="Voxidria" width={132} height={44} />
        </div>
        <div className="nav-btns">
          <button
            className="btn-nav-outline"
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </button>
          <button
            className="btn-nav-filled"
            onClick={() => router.push("/record")}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <Image
          src="/logo-icon.png"
          alt="Voxidria Icon"
          width={120}
          height={120}
          className={`hero-logo ${mounted ? "fade-up" : ""}`}
        />

        <div className={`badge ${mounted ? "fade-up delay-1" : ""}`}>
          <div className="badge-dot" />
          Voice AI · Early Detection · Parkinson&apos;s Screening
        </div>

        <h1 className={`${mounted ? "fade-up delay-1" : ""}`}>
          Hear what your
          <br />
          <em>voice reveals</em>
        </h1>

        <p className={`subtitle ${mounted ? "fade-up delay-2" : ""}`}>
          Two short voice tasks. Advanced ML analysis. Plain-language results
          powered by Gemini AI. Parkinson&apos;s speech-risk screening in under
          2 minutes.
        </p>

        <div className={`cta-row ${mounted ? "fade-up delay-3" : ""}`}>
          <button
            className="btn-primary"
            onClick={() => router.push("/record")}
          >
            Start Free Screening →
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              document
                .getElementById("how")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            How it works
          </button>
        </div>

        <div className={`wave-visual ${mounted ? "fade-up delay-4" : ""}`}>
          {[
            14, 22, 38, 50, 44, 58, 34, 48, 60, 42, 52, 38, 44, 26, 18, 32, 50,
            44, 28, 16,
          ].map((h, i) => (
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
          ))}
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
        <div className="disclaimer">
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <p>
            <strong>Medical Disclaimer: </strong>
            Voxidria is a screening tool only and does not provide a medical
            diagnosis. Results are indicative only. If you have concerns about
            your health, please consult a qualified healthcare professional.
          </p>
        </div>
      </div>

      {/* FEATURES */}
      <div className="section">
        <div className="section-label">Core capabilities</div>
        <div className="section-title">Built on clinical voice biomarkers</div>
        <div className="cards">
          {[
            {
              n: "01",
              title: "Jitter & Shimmer Analysis",
              desc: "Measures cycle-to-cycle pitch and amplitude variation — key acoustic biomarkers associated with vocal tremor in Parkinson's.",
            },
            {
              n: "02",
              title: "MFCCs & Harmonics",
              desc: "Mel-frequency cepstral coefficients capture fine spectral texture. Harmonics-to-noise ratio quantifies vocal breathiness.",
            },
            {
              n: "03",
              title: "Gemini AI Explanation",
              desc: "Your results are translated into plain language by Gemini, with personalised next steps — never a wall of numbers.",
            },
            {
              n: "04",
              title: "Auth0 Secure Login",
              desc: "Your voice data is encrypted and tied to your authenticated identity. You control deletion at any time.",
            },
            {
              n: "05",
              title: "Longitudinal Tracking",
              desc: "Track your vocal health over time. Compare sessions and monitor trends with a simple dashboard history.",
            },
          ].map((c) => (
            <div className="card" key={c.n}>
              <div className="card-num">{c.n}</div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div
        style={{
          background: "var(--white)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="section" id="how">
          <div className="section-label">Process</div>
          <div className="section-title">Two tasks. Under two minutes.</div>
          <div className="steps">
            {[
              {
                n: "1",
                title: 'Sustained Pitch — "Ahhh"',
                desc: "Hold the vowel sound for ~5 seconds in a quiet environment. This reveals pitch stability, jitter, shimmer, and harmonic structure.",
              },
              {
                n: "2",
                title: "Sentence Reading",
                desc: "Read a fixed sentence aloud at a natural pace. Gemini analyses pauses, hesitation markers, and fluency in real time.",
              },
            ].map((s) => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "3rem", textAlign: "center" }}>
            <button
              className="btn-primary"
              onClick={() => router.push("/record")}
            >
              Begin Your Screening →
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          <Image src="/logo.png" alt="Voxidria" width={84} height={28} />
          <span>VOXIDRIA</span>
        </div>
        <span>© 2026 Voxidria. Built at a hackathon.</span>
        <span>Not a medical device · Auth0 · Gemini · Supabase</span>
      </footer>
    </>
  );
}
