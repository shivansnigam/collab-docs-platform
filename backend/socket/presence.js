// socket/presence.js
const presence = new Map(); // docId -> Map<socketId, meta>

export function presenceAdd(docId, socketId, meta) {
  if (!presence.has(docId)) presence.set(docId, new Map());
  presence.get(docId).set(socketId, meta);
}

export function presenceRemove(docId, socketId) {
  if (!presence.has(docId)) return;
  presence.get(docId).delete(socketId);
  if (presence.get(docId).size === 0) presence.delete(docId);
}

export function getRoomPresence(docId) {
  const map = presence.get(docId) || new Map();
  return Array.from(map.entries()).map(([socketId, meta]) => ({
    socketId,
    userId: meta.id,
    name: meta.name,
    selection: meta.selection || null,
    isTyping: meta.isTyping || false
  }));
}
