import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import { listSessions, deleteSession } from "../services/api";
import "./DashboardPage.css";

const BUCKET_COLORS = { LOW: "#22c55e", MODERATE: "#f59e0b", HIGH: "#ef4444" };

export default function DashboardPage() {
  const { user, getAccessTokenSilently } = useAuth0();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions(getAccessTokenSilently);
      setSessions(data.sessions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError("Could not load session history.");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (sessionId) => {
    if (!window.confirm("Delete this session and all its recordings? This cannot be undone.")) return;
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId, getAccessTokenSilently);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err) {
      setError("Could not delete session. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>Welcome back, {user?.given_name || user?.name || "there"}</h1>
        <p className="text-muted">Ready to take a voice screening? It only takes a minute.</p>
      </div>

      <div className="dashboard-actions">
        <Link to="/record" className="action-card action-card--primary">
          <div className="action-icon">🎙️</div>
          <h3>New Screening</h3>
          <p>Record a voice task and get your speech analysis with AI-powered explanation.</p>
        </Link>

        <div className="action-card">
          <div className="action-icon">📋</div>
          <h3>How It Works</h3>
          <ol className="how-it-works">
            <li>Consent to recording (privacy-first)</li>
            <li>Choose a voice task (sustained vowel, reading, or rapid syllables)</li>
            <li>Record and upload your voice</li>
            <li>Gemini analyzes your speech patterns</li>
          </ol>
        </div>
      </div>

      {/* Session history */}
      <div className="session-history">
        <div className="session-history-header">
          <h2>Past Screenings {total > 0 && <span className="count-badge">{total}</span>}</h2>
          <button className="btn btn-outline btn-sm" onClick={fetchSessions} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {!loading && sessions.length === 0 && (
          <p className="text-muted empty-state">No screenings yet. Record your first one above!</p>
        )}

        {sessions.length > 0 && (
          <ul className="session-list">
            {sessions.map((s) => {
              const pred = s.latest_prediction;
              const bucketColor = pred ? BUCKET_COLORS[pred.risk_bucket] : undefined;
              return (
                <li key={s.session_id} className="session-item">
                  <div className="session-meta">
                    <span className="session-date">{formatDate(s.created_at)}</span>
                    <span className={`session-status session-status--${s.status.toLowerCase()}`}>
                      {s.status}
                    </span>
                  </div>
                  {pred ? (
                    <div className="session-prediction">
                      <span className="pred-score">Score: {pred.risk_score}</span>
                      <span
                        className="pred-bucket"
                        style={{ color: bucketColor }}
                      >
                        {pred.risk_bucket}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted pred-none">No prediction yet</span>
                  )}
                  <button
                    className="btn btn-outline btn-sm btn-danger"
                    onClick={() => handleDelete(s.session_id)}
                    disabled={deletingId === s.session_id}
                    aria-label="Delete session"
                  >
                    {deletingId === s.session_id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="dashboard-disclaimer">
        <p>
          <strong>Disclaimer:</strong> Voxidria is a screening tool and does not
          provide medical diagnoses. Always consult a qualified healthcare
          professional for medical advice.
        </p>
      </div>
    </div>
  );
}
