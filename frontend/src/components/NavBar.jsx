// src/components/NavBar.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUser, clearTokens } from "../services/auth.service";
import { fetchMyNotifications, markNotificationAsRead } from "../services/api";
import {
  connectSocket,
  subscribeToNotifications,
} from "../services/realtime.service";

export default function NavBar({ onLoginClick }) {
  const [user] = useState(() => getUser());

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const logout = () => {
    clearTokens();
    window.location.href = "/";
  };

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
      `}</style>

      <div className="nb-root">
        <div className="nb-container">
          <Link to="/" className="nb-brand">
            CollabDocs
          </Link>

          <div className="nb-right">
            {user ? (
              <>
                <span className="nb-user">Hi, {user.name || user.email}</span>

                {/* common dashboard link */}
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
