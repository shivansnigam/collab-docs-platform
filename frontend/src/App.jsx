// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Signup from "./pages/Signup";
import OAuthSuccess from "./pages/OAuthSuccess";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import NavBar from "./components/NavBar";
import LoginModal from "./components/LoginModal";
import { getAccessToken } from "./services/auth.service";

// Added imports for workspaces/documents pages
import Workspaces from "./pages/Workspaces";
import WorkspacePage from "./pages/WorkspacePage";
import DocumentEditor from "./pages/DocumentEditor";
import DocumentVersions from "./pages/DocumentVersions";
import NewPage from "./pages/NewPage"; // NEW

// <-- ADDED: analytics page import
import AnalyticsPage from "./pages/Analytics";

export default function App() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Agar user logged out hai aur root ya login route visit kar raha hai -> modal khol do
    const token = getAccessToken();
    const onRoot = location.pathname === "/" || location.pathname === "/login";
    if (!token && onRoot) setShowLoginModal(true);
  }, [location]);

  return (
    <>
      <NavBar onLoginClick={() => setShowLoginModal(true)} />
      <LoginModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="container mt-4">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/oauth-success" element={<OAuthSuccess />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Workspaces & Documents routes (protected) */}
          <Route
            path="/workspaces"
            element={
              <ProtectedRoute>
                <Workspaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:id"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />

          {/* NEW: route for creating a page from workspace (used by +New button) */}
          <Route
            path="/workspaces/:id/newpage"
            element={
              <ProtectedRoute>
                <NewPage />
              </ProtectedRoute>
            }
          />

          {/* <-- ADDED: Analytics route (workspace level) */}
          <Route
            path="/workspaces/:id/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/:id/versions"
            element={
              <ProtectedRoute>
                <DocumentVersions />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </div>
    </>
  );
}
