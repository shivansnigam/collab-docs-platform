// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import { getUser, setTokens, clearTokens } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [wsLoading, setWsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    // fetch profile if not in storage (oauth flow stores tokens then /protected/profile fetches)
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

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setWsLoading(true);
    try {
      const resp = await api.get("/workspaces");
      setWorkspaces(resp.data.workspaces || resp.data || []);
    } catch (err) {
      console.error("Load workspaces error:", err?.response?.data || err);
    } finally {
      setWsLoading(false);
    }
  };

  const createWorkspace = async (e) => {
    e.preventDefault();
    try {
      const resp = await api.post("/workspaces", {
        name: wsName,
        description: wsDesc,
      });
      setShowCreate(false);
      setWsName("");
      setWsDesc("");
      const id = resp?.data?.workspace?._id || resp?.data?._id;
      if (id) nav(`/workspaces/${id}`);
      else loadWorkspaces();
    } catch (err) {
      alert(err?.response?.data?.message || "Could not create workspace");
    }
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem("app_refresh_token");
      await api.post("/auth/logout", { refreshToken: refresh });
    } catch (e) {
    } finally {
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

  return (
    <div className="container mt-4">
      {/* ===== style added (kept inside component as you asked) ===== */}

      <div
        className="db-card p-3"
        style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10 }}
      >
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2>Dashboard</h2>
            <p>
              <strong>Name:</strong> {user?.name || user?.email}
            </p>
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
            <p>
              <strong>Provider:</strong> {user?.provider}
            </p>
            <p>
              <strong>Roles:</strong> {(user?.roles || []).join(", ")}
            </p>
          </div>
          <div>
            <button className="btn btn-outline-danger" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <hr />

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5>Workspaces</h5>
          <div>
            <button
              className="btn btn-sm btn-outline-secondary me-2"
              onClick={loadWorkspaces}
            >
              Refresh
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreate(true)}
            >
              + New Workspace
            </button>
          </div>
        </div>

        {wsLoading ? (
          <div className="spinner-border" />
        ) : (
          <>
            {workspaces.length === 0 ? (
              <div className="alert alert-secondary">
                Create Your Next Workspace
              </div>
            ) : (
              <div className="row">
                {workspaces.map((ws) => (
                  <div key={ws._id} className="col-md-4 mb-2">
                    <div className="card h-100">
                      <div className="card-body d-flex flex-column">
                        <h6 className="card-title fs-5 fw-semibold">
                          {ws.name}
                        </h6>

                        <p className="  mb-3 fs-6">
                          {ws.description || "No description"}
                        </p>

                        <div className="mt-auto d-flex justify-content-between align-items-center">
                          <small className="  fw-medium fs-6">
                            Members: {ws.members?.length || 0}
                          </small>

                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => nav(`/workspaces/${ws._id}`)}
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create workspace modal */}
      {/* Create workspace modal — dark-themed, matches app */}
      {showCreate && (
        <div className="sx-dark-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sx-dark-modal-wrap">
            <div className="sx-dark-modal-card" role="document">
              <button
                className="sx-dark-close"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                ✕
              </button>

              <header className="sx-dark-header">
                <h4 className="sx-dark-title">Create workspace</h4>
                <p className="sx-dark-sub">
                  Quickly create a workspace for your team
                </p>
              </header>

              <form
                onSubmit={createWorkspace}
                className="sx-dark-form"
                autoComplete="off"
              >
                <div className="sx-field">
                  <label className="sx-label" htmlFor="sx-ws-name">
                    Name
                  </label>
                  <input
                    id="sx-ws-name"
                    className="sx-input"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    required
                  />
                </div>

                <div className="sx-field">
                  <label className="sx-label" htmlFor="sx-ws-desc">
                    Description
                  </label>
                  <input
                    id="sx-ws-desc"
                    className="sx-input"
                    value={wsDesc}
                    onChange={(e) => setWsDesc(e.target.value)}
                  />
                </div>

                <div className="sx-actions">
                  <button
                    type="button"
                    className="sx-btn sx-ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="sx-btn sx-primary">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
