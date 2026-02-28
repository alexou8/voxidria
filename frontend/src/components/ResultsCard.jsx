import "./ResultsCard.css";

const TASK_LABELS = {
  SUSTAINED_VOWEL: "Sustained Vowel",
  READING: "Reading Task",
  DDK: "Rapid Syllables",
};

export default function ResultsCard({ results }) {
  const { task_type, task_status, analysis_json, riskScore, features, explanation } = results;

  // Support both old (riskScore) and new (analysis_json) result shapes
  const isReadingAnalysis = task_type === "READING" && analysis_json;
  const isLegacyResult = typeof riskScore === "number";

  const taskLabel = TASK_LABELS[task_type] || task_type || "Voice Task";

  if (isReadingAnalysis) {
    const { alignment, fluency, metrics, summary } = analysis_json;
    return (
      <div className="results-card">
        <h2>Reading Task Results</h2>
        <p className="task-label">{taskLabel}</p>

        {/* Metrics */}
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-label">Coverage</span>
            <span className="feature-value">
              {Math.round((metrics?.coverage_ratio ?? 0) * 100)}%
            </span>
          </div>
          <div className="feature-item">
            <span className="feature-label">Word Error Rate</span>
            <span className="feature-value">
              {Math.round((metrics?.word_error_rate_estimate ?? 0) * 100)}%
            </span>
          </div>
          {alignment && (
            <div className="feature-item">
              <span className="feature-label">Substitutions</span>
              <span className="feature-value">{alignment.substitutions?.length ?? 0}</span>
            </div>
          )}
          {fluency && (
            <div className="feature-item">
              <span className="feature-label">Hesitations</span>
              <span className="feature-value">
                {fluency.hesitation_markers?.reduce((acc, h) => acc + (h.count || 0), 0) ?? 0}
              </span>
            </div>
          )}
        </div>

        {/* Alignment details */}
        {alignment?.missing_phrases?.length > 0 && (
          <div className="analysis-section">
            <h4>Skipped Phrases</h4>
            <ul className="phrase-list">
              {alignment.missing_phrases.map((p, i) => (
                <li key={i} className="phrase-item phrase-item--missing">"{p}"</li>
              ))}
            </ul>
          </div>
        )}

        {alignment?.substitutions?.length > 0 && (
          <div className="analysis-section">
            <h4>Substitutions</h4>
            <ul className="phrase-list">
              {alignment.substitutions.map((s, i) => (
                <li key={i} className="phrase-item">
                  <span className="sub-expected">"{s.expected}"</span>
                  <span className="sub-arrow">→</span>
                  <span className="sub-said">"{s.said}"</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fluency?.hesitation_markers?.length > 0 && (
          <div className="analysis-section">
            <h4>Hesitation Markers</h4>
            <div className="hesitation-chips">
              {fluency.hesitation_markers.map((h, i) => (
                <span key={i} className="hesitation-chip">
                  "{h.token}" ×{h.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Plain-language summary */}
        {summary?.length > 0 && (
          <div className="explanation">
            <h3>Summary</h3>
            <ul className="summary-list">
              {summary.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="results-disclaimer">
          This is a screening tool only — not a medical diagnosis. Please consult
          a qualified healthcare professional for any health concerns.
        </p>
      </div>
    );
  }

  // Legacy / ML-inference result (score + features + explanation)
  if (isLegacyResult) {
    const riskLevel =
      riskScore <= 25 ? "Low"
        : riskScore <= 50 ? "Mild"
        : riskScore <= 75 ? "Moderate"
        : "Elevated";

    const riskColor =
      riskScore <= 25 ? "var(--success)"
        : riskScore <= 50 ? "var(--warning)"
        : "var(--danger)";

    return (
      <div className="results-card">
        <h2>Your Results</h2>
        {task_type && <p className="task-label">{taskLabel}</p>}

        <div className="risk-gauge">
          <div className="gauge-ring" style={{ "--score": riskScore, "--color": riskColor }}>
            <div className="gauge-inner">
              <span className="gauge-score">{riskScore}</span>
              <span className="gauge-label">/100</span>
            </div>
          </div>
          <p className="risk-level" style={{ color: riskColor }}>{riskLevel} Risk</p>
        </div>

        {features && (
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
        )}

        {explanation && (
          <div className="explanation">
            <h3>AI Explanation</h3>
            <div className="explanation-text">{explanation}</div>
          </div>
        )}

        <p className="results-disclaimer">
          This is a screening tool, not a diagnosis. Please consult a healthcare
          professional for medical advice.
        </p>
      </div>
    );
  }

  // Fallback for non-READING tasks that haven't been ML-analyzed yet
  return (
    <div className="results-card">
      <h2>Recording Saved</h2>
      <p className="task-label">{taskLabel}</p>
      <p>
        Status: <strong>{task_status || "Uploaded"}</strong>
      </p>
      <p className="text-muted">
        {task_type === "READING"
          ? "Your reading task audio has been stored and analyzed."
          : "Your audio has been stored. ML analysis for this task type requires the inference service."}
      </p>
      <p className="results-disclaimer">
        This is a screening tool only — not a medical diagnosis.
      </p>
    </div>
  );
}
