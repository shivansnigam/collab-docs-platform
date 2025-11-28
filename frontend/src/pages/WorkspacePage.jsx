// src/pages/WorkspacePage.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useParams, useNavigate } from "react-router-dom";
import WorkspaceTree from "../components/WorkspaceTree";
import "../styles/workspace-tree.css"; // optional - import once

// small UI helper for role badge
function RoleBadge({ role }) {
  const base = {
    Viewer: { bg: "#e6f0ff", color: "#0b63d6" },
    Editor: { bg: "#fff7e6", color: "#c56b00" },
    Admin: { bg: "#ffe6f0", color: "#d0006f" },
    Owner: { bg: "#e6fff2", color: "#007a4d" },
  }[role] || { bg: "#f4f6f9", color: "#556" };

  return (
    <span
      style={{
        background: base.bg,
        color: base.color,
        padding: "3px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        marginLeft: 8,
      }}
    >
      {role}
    </span>
  );
}

export default function WorkspacePage() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState("");
  const [tags, setTags] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const [wResp, dResp] = await Promise.all([
        api.get(`/workspaces/${id}`),
        api.get(`/documents?workspaceId=${id}`)
      ]);
      setWorkspace(wResp.data.workspace || wResp.data);
      setDocs(dResp.data.documents || dResp.data || []);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not load workspace");
    } finally {
      setLoading(false);
    }
  };

  const createDoc = async (e) => {
    e.preventDefault();
    try {
      const tagsArr = (tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const resp = await api.post(`/documents/workspace/${id}`, {
        title,
        content: "# New Page",
        parent: parent || null,
        tags: tagsArr
      });
      setShowCreateDoc(false);
      setTitle("");
      setParent("");
      setTags("");
      nav(`/documents/${resp.data.document._id}`);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not create document");
    }
  };

  const openDoc = (doc) => nav(`/documents/${doc._id}`);

  if (loading) return <div className="container mt-4"><div className="spinner-border" /></div>;
  if (!workspace) return <div className="container mt-4">Workspace not found</div>;

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h3 style={{ marginBottom: 4 }}>{workspace.name}</h3>
          <div style={{ fontSize: 17 }}>{workspace.description}</div>
        </div>

        {/* 🔥 UPDATED BUTTON BLOCK (only this changed) */}
        <div>
          <button className="btn btn-outline-secondary me-2" onClick={load}>Refresh</button>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => nav(`/workspaces/${id}/analytics`)}
          >
            Analytics
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateDoc(true)}>+ New Page</button>
        </div>
      </div>

      <div className="row">
        {/* LEFT: sidebar (members + tree + activity) */}
        <div className="col-md-4">
          <div className="card p-3 mb-3" style={{ position: "sticky", top: 12 }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h6 style={{ margin: 0 }}>Team</h6>
                <div style={{ fontSize: 17, color: "#8695a8" }}>Members and roles</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <ul style={{ listStyle: "none", paddingLeft: 0, marginBottom: 0 }}>
                {/* Owner row */}
                <li style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{workspace.owner?.name || workspace.owner}</div>
                    <div style={{ fontSize: 16, color: "#90a0b6" }}>{workspace.owner?.email || ""}</div>
                  </div>
                  <div>
                    <RoleBadge role="Owner" />
                  </div>
                </li>

                {/* Other members */}
                {workspace.members?.map((m, idx) => (
                  <li key={m.user?._id || idx} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.user?.name || m.user}</div>
                      <div style={{ fontSize: 15, color: "#90a0b6" }}>{m.user?.email || ""}</div>
                    </div>
                    <div>
                      <RoleBadge role={m.role || "Viewer"} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ borderTop: "1px solid #eef2f6", marginTop: 12, paddingTop: 12 }}>
              <InviteMember workspaceId={id} onAdded={load} />
            </div>
          </div>

          <div className="card p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>Pages</strong>
            </div>
            <div style={{ maxHeight: 380, overflow: "auto" }}>
              <WorkspaceTree workspaceId={id} />
            </div>
          </div>

          <div className="card p-3">
            <h6 style={{ marginBottom: 8 }}>Activity</h6>
            <div style={{ fontSize: 16, color: "#6f7d8a" }}>Recent actions in this workspace</div>
            <div style={{ marginTop: 10, fontSize: 16, color: "#495763" }}>
              {workspace.activity?.length ? (
                <ul style={{ paddingLeft: 16 }}>
                  {workspace.activity.slice(0, 6).map((a, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{a.action}</div>
                      <div style={{ fontSize: 12, color: "#8091a2" }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "#90a0b6" }}>No recent activity</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: main content */}
        <div className="col-md-8">
          <div className="card p-3 mb-3">
            <h5 style={{ marginBottom: 6 }}>Selected workspace actions</h5>
            <p style={{ marginBottom: 12 }}>
              Open or create documents. Click a document in the left tree to open editor.
            </p>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary" onClick={() => nav("/workspaces")}>
                Back to list
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateDoc(true)}>
                Create page
              </button>
            </div>
          </div>

          <div className="card p-3">
            <h6>Workspace overview</h6>
            <div style={{ marginTop: 8 }}>
              <div><strong>Pages:</strong> {docs.length}</div>
              <div><strong>Members:</strong> {workspace.members?.length || 0}</div>
              <div style={{ marginTop: 8 }}>{workspace.description}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create page modal */}
      {showCreateDoc && (
        <div
          className="wp-sx-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wp-sx-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateDoc(false); }}
        >
          <div className="wp-sx-modal-wrap">
            <div className="wp-sx-modal-card" role="document">
              <button
                className="wp-sx-close"
                onClick={() => setShowCreateDoc(false)}
                aria-label="Close"
              >
                ✕
              </button>

              <header className="wp-sx-header">
                <h4 id="wp-sx-title" className="wp-sx-title">Create page</h4>
                <p className="wp-sx-sub">Add a new document to this workspace</p>
              </header>

              <form onSubmit={createDoc} className="wp-sx-form" autoComplete="off">
                <div className="wp-sx-field">
                  <label className="wp-sx-label" htmlFor="wp-sx-title">Title</label>
                  <input
                    id="wp-sx-title"
                    className="wp-sx-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="wp-sx-field">
                  <label className="wp-sx-label" htmlFor="wp-sx-tags">Tags (comma separated)</label>
                  <input
                    id="wp-sx-tags"
                    className="wp-sx-input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="intro,getting-started"
                  />
                </div>

                <div className="wp-sx-field">
                  <label className="wp-sx-label" htmlFor="wp-sx-parent">Parent (optional)</label>
                  <select
                    id="wp-sx-parent"
                    className="wp-sx-input"
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {docs.map((d) => (
                      <option key={d._id} value={d._id}>{d.title}</option>
                    ))}
                  </select>
                </div>

                <div className="wp-sx-actions">
                  <button
                    type="button"
                    className="wp-sx-btn wp-sx-ghost"
                    onClick={() => setShowCreateDoc(false)}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="wp-sx-btn wp-sx-primary">
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

/* InviteMember component unchanged — same logic as before */
function InviteMember({ workspaceId, onAdded }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Viewer");

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/workspaces/${workspaceId}/members`, { email, role });
      setEmail("");
      setRole("Viewer");
      onAdded?.();
      alert("Member added");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Could not add member");
    }
  };

  return (
    <form onSubmit={add} className="mt-2">
      <div className="mb-2">
        <label className="form-label">Invite by email</label>
        <input
          className="form-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
      </div>
      <div className="mb-2 d-flex gap-2 align-items-center">
        <div style={{ flex: 1 }}>
          <label className="form-label">Role</label>
          <select
            className="form-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option>Viewer</option>
            <option>Editor</option>
            <option>Admin</option>
          </select>
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button className="btn btn-sm btn-primary" type="submit">Invite</button>
        </div>
      </div>
    </form>
  );
}
