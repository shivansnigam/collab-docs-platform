// src/components/PresenceBar.jsx
import React, { useMemo } from "react";

/**
 * PresenceBar
 * - handles many incoming shapes: { userId, name, socketId, isTyping, selection }
 *   and { user: { id, name, socketId }, isTyping }
 * - shows "Name is typing…" when user is typing
 */

export default function PresenceBar({ presence = [] }) {
  if (!presence || presence.length === 0) return null;

  const grouped = useMemo(() => {
    const map = new Map();

    presence.forEach((p) => {
      // support both top-level fields and nested `user`
      const nestedUser = p.user || null;
      const userId = p.userId || nestedUser?.id || nestedUser?.userId || p.id || null;
      const socketId = p.socketId || nestedUser?.socketId || null;
      const key = userId || socketId || p.id || socketId || Math.random().toString(36).slice(2, 9);

      if (!map.has(key)) map.set(key, { key, sockets: [] });

      // normalize entry shape we store per-socket
      map.get(key).sockets.push({
        socketId,
        userId,
        name: p.name || nestedUser?.name || nestedUser?.user?.name || p.user?.name || undefined,
        isTyping: !!p.isTyping,
        selection: p.selection || null,
      });
    });

    const list = Array.from(map.values()).map((g) => {
      // representative socket = last one (most recent)
      const rep = g.sockets[g.sockets.length - 1] || {};

      const name =
        rep.name ||
        rep.userId ||
        (rep.socketId ? `socket-${String(rep.socketId).slice(-6)}` : "User");

      return {
        key: g.key,
        count: g.sockets.length,
        name,
        isTyping: g.sockets.some((s) => !!s.isTyping),
        selection: rep.selection || null,
      };
    });

    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [presence]);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: 12 }}>
      {grouped.map((u) => (
        <div key={u.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#34d399",
              boxShadow: "0 0 6px rgba(52,211,153,0.25)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <small style={{ color: "#e6eef8", fontWeight: 600, fontSize: 13 }}>
                {u.name.length > 12 ? u.name.slice(0, 12) + "…" : u.name}
              </small>

              {u.count > 1 && (
                <small
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    padding: "2px 6px",
                    fontSize: 11,
                    color: "#cbd5e1",
                  }}
                >
                  {u.count}
                </small>
              )}

              {u.isTyping && (
                <small style={{ fontSize: 12, color: "#60a5fa", marginLeft: 6 }}>
                  {u.name} is typing…
                </small>
              )}
            </div>

            <div>
              {u.selection ? (
                <small style={{ color: "#9aaac3", fontSize: 11 }}>
                  cursor {typeof u.selection.from === "number" ? u.selection.from : "—"}
                </small>
              ) : (
                <small style={{ color: "#8897a6", fontSize: 11 }}>online</small>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
