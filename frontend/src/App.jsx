import { Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import RecordPage from "./pages/RecordPage";
import Chatbot from "./components/Chatbot";

export default function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <DashboardPage /> : <LandingPage />}
          />
          <Route
            path="/record"
            element={isAuthenticated ? <RecordPage /> : <LandingPage />}
          />
        </Routes>
      </main>
      <Chatbot />
    </>
  );
}
