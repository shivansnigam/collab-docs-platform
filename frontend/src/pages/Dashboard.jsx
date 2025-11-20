import React, { useEffect, useState } from "react";
import api from "../services/api";
import { getUser, setTokens, clearTokens } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const resp = await api.get("/protected/profile");
        setUser(resp.data.user);

        setTokens(
          localStorage.getItem("app_access_token"),
          localStorage.getItem("app_refresh_token"),
          resp.data.user
        );
      } catch (err) {
        setError(err?.response?.data?.message || "Could not load profile");
        if (err?.response?.status === 401) {
          clearTokens();
          nav("/");
        }
      } finally {
        setLoading(false);
      }
    };

    if (!user) fetchProfile();
  }, []);

  const logout = async () => {
    try {
      const refresh = localStorage.getItem("app_refresh_token");
      await api.post("/auth/logout", { refreshToken: refresh });
    } catch (e) {}
    finally {
      clearTokens();
      nav("/");
      window.location.reload();
    }
  };

  if (loading)
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-light" />
      </div>
    );

  if (error)
    return <div className="alert alert-danger mt-4">{error}</div>;

  const roles = user?.roles || [];

  return (
    <>
      <style>{`
        body {
          background: radial-gradient(circle at top, #0f172a, #020617);
          color: #e2e8f0;
          min-height: 100vh;
        }

        .db-container {
          width: 100%;
          max-width: 1080px;
          margin: 40px auto;
          padding: 20px;
        }

        .db-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .db-profile-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 18px;
          margin-bottom: 22px;
        }

        .db-title {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
        }

        .db-info p {
          margin: 4px 0;
          font-size: 15px;
          color: #cbd5e1;
        }

        .db-info strong {
          color: #e2e8f0;
        }

        .db-logout {
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 600;
          background: transparent;
          border: 1px solid #ef4444;
          color: #ffb4b4;
          transition: all 0.2s ease;
        }

        .db-logout:hover {
          background: rgba(255,80,80,0.12);
          color: #fff;
        }

        .roles-title {
          font-size: 20px;
          margin-bottom: 12px;
          font-weight: 600;
          color: #f8fafc;
        }

        .role-block {
          padding: 14px 18px;
          border-radius: 12px;
          margin-bottom: 12px;
          font-weight: 500;
          backdrop-filter: blur(6px);
        }

        .role-admin {
          border-left: 4px solid #60a5fa;
          background: rgba(96,165,250,0.08);
        }

        .role-editor {
          border-left: 4px solid #4ade80;
          background: rgba(74,222,128,0.08);
        }

        .role-viewer {
          border-left: 4px solid #cbd5e1;
          background: rgba(203,213,225,0.08);
        }
      `}</style>

      <div className="db-container">
        <div className="db-card">

          {/* Profile header */}
          <div className="db-profile-header">
            <div className="db-info">
              <h2 className="db-title">Dashboard</h2>

              <p><strong>Name:</strong> {user.name || user.email}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Provider:</strong> {user.provider}</p>
              <p><strong>Roles:</strong> {roles.join(", ")}</p>
            </div>

            <button className="db-logout" onClick={logout}>
              Logout
            </button>
          </div>

          {/* Role sections */}
          <div>
            <h4 className="roles-title">Role based access</h4>

            {roles.includes("Admin") && (
              <div className="role-block role-admin">
                Admin area — Full controls, user management etc.
              </div>
            )}

            {roles.includes("Editor") && (
              <div className="role-block role-editor">
                Editor panel — Create and manage content.
              </div>
            )}

            {roles.includes("Viewer") && (
              <div className="role-block role-viewer">
                Viewer section — You can view read-only content.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
