// src/pages/Analytics.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWorkspaceAnalytics } from "../services/analytics.service";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import api from "../services/api";

export default function AnalyticsPage() {
  const { id: workspaceId } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await getWorkspaceAnalytics(workspaceId);
      setAnalytics(resp.analytics || null);
      setActivities(resp.activities || []);
    } catch (err) {
      console.error("Load analytics error:", err);
      setError(err?.response?.data?.message || "Could not load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // auto-refresh small interval so UI feels realtime (optional)
    const t = setInterval(() => load(), 30 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [workspaceId]);

  // prepare series for charts
  const editsSeries = useMemo(() => (analytics?.dailyEdits || []).map(d => ({ date: d.date, count: d.count })), [analytics]);
  const uploadsSeries = useMemo(() => (analytics?.dailyUploads || []).map(d => ({ date: d.date, count: d.count })), [analytics]);

  if (loading)
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border" />
      </div>
    );

  if (error)
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Workspace Analytics</h4>
        <div>
          <button className="btn btn-outline-secondary me-2" onClick={() => load()}>Refresh</button>
          <button className="btn btn-outline-primary" onClick={() => nav(`/workspaces/${workspaceId}`)}>Back</button>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-md-3 mb-2">
          <div className="card p-3">
            <div className=" small">Active users</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics?.activeUsersCount ?? 0}</div>
          </div>
        </div>
        <div className="col-md-3 mb-2">
          <div className="card p-3">
            <div className=" small">Total edits</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics?.editsCount ?? 0}</div>
          </div>
        </div>
        <div className="col-md-3 mb-2">
          <div className="card p-3">
            <div className=" small">Comments</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics?.commentsCount ?? 0}</div>
          </div>
        </div>
        <div className="col-md-3 mb-2">
          <div className="card p-3">
            <div className=" small">File uploads</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics?.uploadsCount ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="card p-3" style={{ height: 320 }}>
            <h6>Daily edits</h6>
            {editsSeries.length === 0 ? (
              <div className="text-muted mt-3">No edits data</div>
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={editsSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card p-3" style={{ height: 320 }}>
            <h6>Daily uploads</h6>
            {uploadsSeries.length === 0 ? (
              <div className="text-muted mt-3">No uploads data</div>
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={uploadsSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card p-3">
        <h6>Recent activity</h6>
        {activities.length === 0 ? (
          <div className="text-muted">No recent activity</div>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
            {activities.map((a) => (
              <li key={a._id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontWeight: 700 }}>{a.action}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>{a.user?.name || "System"}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#334155" }}>
                      {a.document?.title ? `${a.document.title}` : ""}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{a.meta && Object.keys(a.meta).length ? JSON.stringify(a.meta) : ""}</div>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
