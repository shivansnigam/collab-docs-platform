// src/pages/Workspaces.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    fetchWorkspaces();
  }, []); // eslint-disable-line

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const resp = await api.get("/workspaces");
      setWorkspaces(resp.data.workspaces || resp.data || []);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not load workspaces");
    } finally {
      setLoading(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      const resp = await api.post("/workspaces", { name, description });
      setShowCreate(false);
      setName("");
      setDescription("");
      nav(`/workspaces/${resp.data.workspace._id}`);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not create workspace");
    }
  };

  // modal UX: lock body scroll while modal open
  useEffect(() => {
    if (!showCreate) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showCreate]);

  // close modal on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && showCreate) setShowCreate(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreate]);

  return (
    <div className="container mt-4 ">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Workspaces</h3>
        <div>
          <button className="btn btn-outline-primary me-2" onClick={fetchWorkspaces}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Workspace
          </button>
        </div>
      </div>

      {loading ? (
        <div className="spinner-border" />
      ) : (
        <div className="row">
          {workspaces.map((ws) => (
            <div key={ws._id} className="col-md-4 mb-2">
              <div className="card h-100">
                <div className="card-body d-flex flex-column">
                  <h6 className="card-title fs-5 fw-semibold">{ws.name}</h6>

                  <p className="mb-3 fs-6">{ws.description || "No description"}</p>

                  <div className="mt-auto d-flex justify-content-between align-items-center">
                    <small className="fw-medium fs-6">Members: {ws.members?.length || 0}</small>

                    <button className="btn btn-sm btn-primary" onClick={() => nav(`/workspaces/${ws._id}`)}>
                      Open
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal — sx-dark styled (uses sx-dark CSS from your stylesheet) */}
      {showCreate && (
        <div
          className="sx-dark-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sx-ws-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
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
                <h4 id="sx-ws-title" className="sx-dark-title">Create workspace</h4>
                <p className="sx-dark-sub">Quickly create a workspace for your team</p>
              </header>

              <form onSubmit={create} className="sx-dark-form" autoComplete="off">
                <div className="sx-field">
                  <label className="sx-label" htmlFor="sx-ws-name">Name</label>
                  <input
                    id="sx-ws-name"
                    className="sx-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="sx-field">
                  <label className="sx-label" htmlFor="sx-ws-desc">Description</label>
                  <input
                    id="sx-ws-desc"
                    className="sx-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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

                  <button type="submit" className="sx-btn sx-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
