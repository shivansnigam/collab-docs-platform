// src/components/NavBar.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUser, clearTokens } from "../services/auth.service";
import { fetchMyNotifications, markNotificationAsRead } from "../services/api";
import {
  connectSocket,
  subscribeToNotifications,
} from "../services/realtime.service";
import api from "../services/api";
import { searchDocuments } from "../services/document.service";

export default function NavBar({ onLoginClick }) {
  const [user, setUser] = useState(() => getUser());

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const nav = useNavigate();

  const logout = () => {
    clearTokens();
    window.location.href = "/";
  };

  const getCleanSnippet = (raw) => {
    if (!raw) return "No preview";

    let text = String(raw);
    text = text.replace(/<img[^>]*>/gi, " ");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/src="[^"]*"/gi, " ");
    text = text.replace(/https?:\/\/\S+/gi, " ");
    text = text.replace(/\s+/g, " ").trim();

    if (!text) return "No preview";
    return text.length > 80 ? text.slice(0, 80) + "..." : text;
  };

  useEffect(() => {
    if (user) return;

    const id = setInterval(() => {
      const stored = getUser();
      if (stored) {
        setUser(stored);
        clearInterval(id);
      }
    }, 300);

    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadWorkspaces = async () => {
      try {
        const resp = await api.get("/workspaces");
        const ws = resp.data.workspaces || resp.data || [];
        setWorkspaces(ws);
        if (!activeWorkspaceId && ws.length > 0) {
          setActiveWorkspaceId(ws[0]._id);
        }
      } catch (err) {
        console.error(
          "navbar load workspaces error:",
          err?.response?.data || err
        );
      }
    };

    loadWorkspaces();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const resp = await fetchMyNotifications();
        const list = resp.data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      } catch (e) {
        console.error("load notifications error", e?.response?.data || e);
      }
    };

    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const resp = await fetchMyNotifications();
        const list = resp.data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      } catch (e) {
        console.error("poll notifications error", e?.response?.data || e);
      }
    }, 17000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    connectSocket({});

    const unsubscribe = subscribeToNotifications((payload) => {
      const notif = payload?.notification || payload;

      setNotifications((prev) => {
        const next = [notif, ...prev];
        return next.slice(0, 20);
      });

      if (!notif.read) {
        setUnreadCount((c) => c + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleNotificationClick = async (notif) => {
    if (!notif) return;

    if (!notif.read) {
      try {
        await markNotificationAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {
        console.error("mark read failed", e?.response?.data || e);
      }
    }
  };

  const renderLabel = (notif) => {
    if (!notif) return "Notification";

    if (notif.title) return notif.title;
    if (notif.type === "comment") return "New comment";
    if (notif.type === "mention") return "You were mentioned";
    if (notif.type === "share") return "Document shared with you";
    return "Notification";
  };

  const runSearch = async (query, workspaceId) => {
    if (!query.trim() || !workspaceId) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const resp = await searchDocuments({
        workspaceId,
        q: query.trim(),
        page: 1,
        limit: 10,
      });
      setSearchResults(resp.data.documents || []);
      setSearchOpen(true);
    } catch (err) {
      console.error("navbar search error:", err?.response?.data || err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    if (!activeWorkspaceId) return;

    const t = setTimeout(() => {
      runSearch(searchQuery, activeWorkspaceId);
    }, 400);

    return () => clearTimeout(t);
  }, [searchQuery, activeWorkspaceId]);

  const handleResultClick = (doc) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    nav(`/documents/${doc._id}`);
  };

  return (
    <>
      <style>{`
        .nb-root {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          padding: 14px 0;
          position: sticky;
          top: 0;
          z-index: 3000;
          animation: nb-fade 0.35s ease forwards;
        }

        @keyframes nb-fade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0px); }
        }

        .nb-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 92%;
          max-width: 1180px;
          margin: auto;
        }

        .nb-brand {
          font-size: 24px;
          font-weight: 800;
          text-decoration: none;
          background: linear-gradient(90deg,#60a5fa,#38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nb-user {
          color: #e2e8f0;
          font-size: 15px;
          margin-right: 8px;
        }

        .nb-btn {
          padding: 6px 16px;
          font-size: 14px;
          border-radius: 10px;
          border: 1px solid #ef4444;
          color: #ffb4b4;
          background: transparent;
          transition: all .2s ease;
          font-weight: 600;
          margin-left: 8px;
        }

        .nb-btn:hover {
          background: rgba(255,76,76,0.14);
          color: #fff;
        }

        .nb-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nb-nav-link {
          padding: 6px 14px;
          font-size: 13px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.7);
          background: rgba(15,23,42,0.72);
          color: #e2e8f0;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 96px;
          transition: background .18s ease, border-color .18s ease, color .18s ease;
        }

        .nb-nav-link:hover {
          background: rgba(37,99,235,0.35);
          border-color: rgba(96,165,250,0.9);
          color: #f9fafb;
        }

        .nb-notify-wrap {
          position: relative;
        }

        .nb-bell-btn {
          position: relative;
          border: 1px solid rgba(148,163,184,0.6);
          background: rgba(15,23,42,0.6);
          border-radius: 999px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #e2e8f0;
        }

        .nb-bell-btn span.nb-bell-icon {
          font-size: 16px;
        }

        .nb-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .nb-dropdown {
          position: absolute;
          right: 0;
          margin-top: 8px;
          width: 280px;
          max-height: 360px;
          background: rgba(15,23,42,0.98);
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.6);
          border: 1px solid rgba(148,163,184,0.35);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 4000;
        }

        .nb-dd-header {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(51,65,85,0.9);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nb-dd-title {
          font-size: 13px;
          font-weight: 600;
          color: #e5e7eb;
        }

        .nb-dd-count {
          font-size: 11px;
          color: #9ca3af;
        }

        .nb-dd-list {
          padding: 4px 0;
          overflow-y: auto;
        }

        .nb-dd-empty {
          padding: 14px 12px 16px;
          font-size: 13px;
          color: #9ca3af;
        }

        .nb-dd-item {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12px;
          cursor: pointer;
        }

        .nb-dd-item:hover {
          background: rgba(31,41,55,0.9);
        }

        .nb-dd-item.unread {
          background: rgba(30,64,175,0.25);
        }

        .nb-dd-item-title {
          font-weight: 600;
          color: #e5e7eb;
        }

        .nb-dd-item-body {
          color: #9ca3af;
          font-size: 12px;
        }

        .nb-dd-item-meta {
          margin-top: 2px;
          font-size: 11px;
          color: #6b7280;
        }

        .nb-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-right: 12px;
          z-index: 3500;
        }

        .nb-search-select {
          background: rgba(15,23,42,0.9);
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.7);
          color: #e5e7eb;
          font-size: 12px;
          padding: 4px 10px;
          max-width: 160px;
        }

        .nb-search-input {
          background: rgba(15,23,42,0.9);
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.7);
          color: #e5e7eb;
          font-size: 13px;
          padding: 6px 12px;
          min-width: 190px;
          outline: none;
        }

        .nb-search-input::placeholder {
          color: #9ca3af;
        }

        .nb-search-dd {
          position: absolute;
          top: 110%;
          right: 0;
          left: auto;
          width: 420px;
          max-width: min(420px, 80vw);
          max-height: 380px;
          background: rgba(15,23,42,0.98);
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.6);
          border: 1px solid rgba(148,163,184,0.35);
          overflow-y: auto;
          z-index: 3800;
        }

        .nb-search-item {
          padding: 8px 12px;
          cursor: pointer;
        }

        .nb-search-item:hover {
          background: rgba(31,41,55,0.95);
        }

        .nb-search-title {
          font-size: 13px;
          font-weight: 600;
          color: #e5e7eb;
          margin-bottom: 2px;
        }

        .nb-search-snippet {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nb-search-meta {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        .nb-search-empty {
          padding: 10px 12px;
          font-size: 12px;
          color: #9ca3af;
        }

        @media (max-width: 768px) {
          .nb-search-wrap {
            flex-wrap: wrap;
            gap: 6px;
            margin-right: 0;
          }
          .nb-search-select {
            max-width: 140px;
          }
          .nb-search-input {
            min-width: 160px;
          }
          .nb-search-dd {
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100%;
          }
        }

        @media (max-width: 640px) {
          .nb-container {
            flex-wrap: wrap;
            row-gap: 8px;
          }
          .nb-search-wrap {
            order: 3;
            width: 100%;
            justify-content: flex-start;
          }
          .nb-search-select,
          .nb-search-input {
            width: 100%;
            max-width: 100%;
          }
          .nb-search-dd {
            top: 104%;
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100%;
          }
        }
      `}</style>

      <div className="nb-root">
        <div className="nb-container">
          <Link to="/" className="nb-brand">
            CollabDocs
          </Link>

          <div className="nb-right">
            {user ? (
              <>
                {workspaces.length > 0 && (
                  <div className="nb-search-wrap">
                    <select
                      className="nb-search-select"
                      value={activeWorkspaceId}
                      onChange={(e) => setActiveWorkspaceId(e.target.value)}
                    >
                      {workspaces.map((ws) => (
                        <option key={ws._id} value={ws._id}>
                          {ws.name}
                        </option>
                      ))}
                    </select>

                    <div style={{ position: "relative" }}>
                      <input
                        className="nb-search-input"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                          if (searchResults.length > 0) setSearchOpen(true);
                        }}
                      />
                      {searchOpen && (
                        <div className="nb-search-dd">
                          {searchLoading ? (
                            <div className="nb-search-empty">
                              Searching...
                            </div>
                          ) : searchResults.length === 0 ? (
                            <div className="nb-search-empty">
                              No documents found
                            </div>
                          ) : (
                            searchResults.map((doc) => (
                              <div
                                key={doc._id}
                                className="nb-search-item"
                                onClick={() => handleResultClick(doc)}
                              >
                                <div className="nb-search-title">
                                  {doc.title}
                                </div>
                                <div className="nb-search-snippet">
                                  {getCleanSnippet(doc.snippet)}
                                </div>
                                <div className="nb-search-meta">
                                  Updated:{" "}
                                  {doc.updatedAt
                                    ? new Date(
                                        doc.updatedAt
                                      ).toLocaleDateString()
                                    : "-"}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <span className="nb-user">Hi, {user.name || user.email}</span>

                <Link to="/dashboard" className="nb-nav-link">
                  Dashboard
                </Link>

                <div className="nb-notify-wrap">
                  <button
                    type="button"
                    className="nb-bell-btn"
                    onClick={() => setOpen((o) => !o)}
                  >
                    <span className="nb-bell-icon">🔔</span>
                    <span style={{ fontSize: 12 }}>
                      {unreadCount > 0 ? "Notifications" : "No alerts"}
                    </span>
                    {unreadCount > 0 && (
                      <span className="nb-badge">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {open && (
                    <div className="nb-dropdown">
                      <div className="nb-dd-header">
                        <div className="nb-dd-title">Notifications</div>
                        <div className="nb-dd-count">{unreadCount} unread</div>
                      </div>

                      <div className="nb-dd-list">
                        {notifications.length === 0 ? (
                          <div className="nb-dd-empty">
                            No new notifications
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n._id}
                              className={
                                "nb-dd-item" + (!n.read ? " unread" : "")
                              }
                              onClick={() => handleNotificationClick(n)}
                            >
                              <div className="nb-dd-item-title">
                                {renderLabel(n)}
                              </div>
                              {n.body && (
                                <div className="nb-dd-item-body">
                                  {n.body.length > 80
                                    ? n.body.slice(0, 80) + "..."
                                    : n.body}
                                </div>
                              )}
                              <div className="nb-dd-item-meta">
                                {n.type || "custom"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button className="nb-btn" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </>
  );
}