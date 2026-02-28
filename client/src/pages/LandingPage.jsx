import { useAuth0 } from "@auth0/auth0-react";
import "./LandingPage.css";

export default function LandingPage() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="landing">
      <section className="hero">
        <h1 className="hero-title">
          Voice-Powered <span className="highlight">Parkinson's</span> Screening
        </h1>
        <p className="hero-subtitle">
          Record a short voice task. Our speech analysis model estimates your
          risk level, and AI explains the results in plain language.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => loginWithRedirect()}
        >
          Get Started
        </button>
      </section>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon">🎙️</div>
          <h3>Record</h3>
          <p>Complete short voice tasks designed to capture vocal biomarkers.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🧠</div>
          <h3>Analyze</h3>
          <p>
            Our ML model evaluates jitter, shimmer, HNR, and other features to
            estimate risk.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💬</div>
          <h3>Understand</h3>
          <p>
            Gemini explains your results and next steps in clear, simple
            language.
          </p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          Voxidria is a screening tool, not a medical diagnosis. Consult a
          healthcare professional for medical advice.
        </p>
      </footer>
    </div>
  );
}
