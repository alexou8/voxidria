import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { user } = useAuth0();

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>
          Welcome back, {user?.given_name || user?.name || "there"}
        </h1>
        <p className="text-muted">
          Ready to take a voice screening? It only takes a minute.
        </p>
      </div>

      <div className="dashboard-actions">
        <Link to="/record" className="action-card action-card--primary">
          <div className="action-icon">🎙️</div>
          <h3>New Screening</h3>
          <p>Record a voice task and get your risk assessment with AI-powered explanation.</p>
        </Link>

        <div className="action-card">
          <div className="action-icon">📋</div>
          <h3>How It Works</h3>
          <ol className="how-it-works">
            <li>Choose a voice task (sustained vowel, sentence reading, or free speech)</li>
            <li>Record your voice using your microphone</li>
            <li>Our model analyzes vocal biomarkers</li>
            <li>Get your risk score with a plain-language explanation</li>
          </ol>
        </div>
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
