import { Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import RecordPage from "./pages/RecordPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100vh", gap: "1rem",
        color: "#6b7280", fontFamily: "Montserrat, sans-serif",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid #e5e7eb", borderTopColor: "#21e6c1",
          animation: "spin 0.8s linear infinite",
        }} />
        <p>Loading…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <DashboardPage /> : <LandingPage />} />
      <Route path="/record" element={isAuthenticated ? <RecordPage /> : <LandingPage />} />
      <Route path="/results" element={isAuthenticated ? <ResultsPage /> : <LandingPage />} />
    </Routes>
  );
}
