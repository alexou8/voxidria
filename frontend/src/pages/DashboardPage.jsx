import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { listSessions, deleteSession } from "../services/api";
import "./DashboardPage.css";

const bucketColor = { Low: "#21E6C1", Moderate: "#F7CC3B", High: "#EF4444" };
const bucketBg = { Low: "rgba(33,230,193,0.1)", Moderate: "rgba(247,204,59,0.1)", High: "rgba(239,68,68,0.1)" };

function toTitleCase(str) {
  if (!str) return str;
  return str.charAt(0) + str.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { logout, getAccessTokenSilently } = useAuth0();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions(getAccessTokenSilently);
      setSessions(data.sessions ?? []);
    } catch {
      setError("Could not load session history.");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    fetchSessions();
    document.title = "Dashboard — Voxidria";
  }, [fetchSessions]);

  const handleDelete = async (sessionId) => {
    if (!window.confirm("Delete this session and all its recordings? This cannot be undone.")) return;
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId, getAccessTokenSilently);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch {
      setError("Could not delete session. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const latest = sessions[0];
  const latestPred = latest?.latest_prediction;
  const latestBucket = latestPred ? toTitleCase(latestPred.risk_bucket) : null;

  return (
    <>
      {/* NAV */}
      <nav className="db-nav">
        <div className="db-nav-logo" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="Voxidria" height="38" />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            className="db-btn db-btn-outline"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Sign Out
          </button>
          <button className="db-btn db-btn-primary" onClick={() => navigate("/record")}>
            + New Screening
          </button>
        </div>
      </nav>

      <main className="db-main">
        <div className="fade-in">
          <div className="db-page-title">Your Dashboard</div>
          <div className="db-page-sub">Voice screening history and risk overview</div>
        </div>

        {/* STATS (when sessions are loaded) */}
        {!loading && sessions.length > 0 && latestPred && (
          <div className="db-stats">
            <div className="db-stat">
              <div className="db-stat-label">Latest Score</div>
              <div className="db-stat-value" style={{ color: bucketColor[latestBucket] }}>
                {latestPred.risk_score}
              </div>
              <div className="db-stat-sub">out of 100 · risk proxy</div>
            </div>
            <div className="db-stat">
              <div className="db-stat-label">Risk Level</div>
              <div className="db-stat-value" style={{ color: bucketColor[latestBucket], fontSize: "1.5rem" }}>
                {latestBucket}
              </div>
              <div className="db-stat-sub">Latest screening</div>
            </div>
            <div className="db-stat">
              <div className="db-stat-label">Total Screenings</div>
              <div className="db-stat-value">{sessions.length}</div>
              <div className="db-stat-sub">All sessions</div>
            </div>
            <div className="db-stat">
              <div className="db-stat-label">Average Score</div>
              <div className="db-stat-value">
                {Math.round(
                  sessions
                    .filter((s) => s.latest_prediction?.risk_score != null)
                    .reduce((a, s) => a + s.latest_prediction.risk_score, 0) /
                    Math.max(sessions.filter((s) => s.latest_prediction?.risk_score != null).length, 1)
                )}
              </div>
              <div className="db-stat-sub">All-time average</div>
            </div>
          </div>
        )}

        {/* SESSION HISTORY */}
        <div className="db-section-header">
          <div className="db-section-title">Screening History</div>
          <button className="db-btn db-btn-primary" onClick={() => navigate("/record")}>
            + New Screening
          </button>
        </div>

        {error && <p className="db-error">{error}</p>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2, 3].map((i) => <div key={i} className="db-skeleton" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="db-empty">
            <h3>No screenings yet</h3>
            <p>Complete your first voice screening to see results here.</p>
            <button className="db-btn db-btn-primary" style={{ marginTop: "1.5rem" }} onClick={() => navigate("/record")}>
              Start First Screening →
            </button>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Risk Score</th>
                  <th>Level</th>
                  <th>Quality</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const pred = s.latest_prediction;
                  const bucket = pred ? toTitleCase(pred.risk_bucket) : null;
                  const color = bucket ? bucketColor[bucket] : "var(--db-muted)";
                  const quality = pred?.quality_flags?.overall || "—";
                  return (
                    <tr key={s.session_id}>
                      <td style={{ color: "var(--db-muted)", fontSize: "0.82rem" }}>
                        {new Date(s.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </td>
                      <td>
                        {pred ? (
                          <div className="db-score-bar-wrap">
                            <span style={{ fontWeight: 700, minWidth: 28 }}>{pred.risk_score}</span>
                            <div className="db-score-bar">
                              <div className="db-score-bar-fill" style={{ width: `${pred.risk_score}%`, background: color }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--db-muted)", fontSize: "0.82rem" }}>
                            {s.status === "DONE" ? "—" : s.status}
                          </span>
                        )}
                      </td>
                      <td>
                        {bucket ? (
                          <span className="db-bucket-badge" style={{ color, background: bucketBg[bucket] }}>
                            {bucket}
                          </span>
                        ) : (
                          <span style={{ color: "var(--db-muted)", fontSize: "0.82rem" }}>—</span>
                        )}
                      </td>
                      <td style={{ color: quality === "Noisy" ? "var(--db-warn)" : "var(--db-muted)", fontSize: "0.82rem" }}>
                        {quality}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="db-btn db-btn-outline"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.8rem" }}
                            onClick={() => navigate(`/results?session=${s.session_id}`)}
                          >
                            View →
                          </button>
                          <button
                            className="db-btn db-btn-danger"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.8rem" }}
                            onClick={() => handleDelete(s.session_id)}
                            disabled={deletingId === s.session_id}
                          >
                            {deletingId === s.session_id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="db-disclaimer">
          ⚠️ <strong>Not a medical diagnosis.</strong> This tool screens for vocal biomarkers only.
          If you are concerned about your health, please consult a healthcare professional.
        </div>
      </main>
    </>
  );
}
