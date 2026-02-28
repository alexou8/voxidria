import "./ResultsCard.css";

export default function ResultsCard({ results }) {
  const { riskScore, features, explanation } = results;

  const riskLevel =
    riskScore <= 25
      ? "low"
      : riskScore <= 50
        ? "mild"
        : riskScore <= 75
          ? "moderate"
          : "elevated";

  const riskColor =
    riskScore <= 25
      ? "var(--success)"
      : riskScore <= 50
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div className="results-card">
      <h2>Your Results</h2>

      {/* Risk score gauge */}
      <div className="risk-gauge">
        <div className="gauge-ring" style={{ "--score": riskScore, "--color": riskColor }}>
          <div className="gauge-inner">
            <span className="gauge-score">{riskScore}</span>
            <span className="gauge-label">/100</span>
          </div>
        </div>
        <p className="risk-level" style={{ color: riskColor }}>
          {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
        </p>
      </div>

      {/* Feature summary */}
      <div className="features-grid">
        <div className="feature-item">
          <span className="feature-label">Jitter</span>
          <span className="feature-value">{features.jitter}</span>
        </div>
        <div className="feature-item">
          <span className="feature-label">Shimmer</span>
          <span className="feature-value">{features.shimmer}</span>
        </div>
        <div className="feature-item">
          <span className="feature-label">HNR</span>
          <span className="feature-value">{features.hnr} dB</span>
        </div>
        <div className="feature-item">
          <span className="feature-label">MFCC Var.</span>
          <span className="feature-value">{features.mfccVariance}</span>
        </div>
      </div>

      {/* Gemini explanation */}
      <div className="explanation">
        <h3>AI Explanation</h3>
        <div className="explanation-text">{explanation}</div>
      </div>

      <p className="results-disclaimer">
        This is a screening tool, not a diagnosis. Please consult a healthcare
        professional for medical advice.
      </p>
    </div>
  );
}
