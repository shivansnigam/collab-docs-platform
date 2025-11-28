// src/services/realtime.service.js
import { io } from "socket.io-client";

const REALTIME = import.meta.env.VITE_REALTIME_URL || "http://localhost:1234";

let socket = null;

/**
 * connectSocket(options)
 * options: { token, onConnect, onInit, onDocUpdate, onPresence, onCursor, onTyping }
 * onTyping will be called for 'presence:typing' or 'typing' events from server
 */
export function connectSocket({ token, onConnect, onInit, onDocUpdate, onPresence, onCursor, onTyping }) {
  if (socket && socket.connected) return socket;

  socket = io(REALTIME, { autoConnect: true });

  socket.on("connect", () => {
    onConnect?.(socket.id);
    // caller usually emits join after getting socket
  });

  socket.on("init", (data) => onInit?.(data));
  socket.on("doc:update", (payload) => onDocUpdate?.(payload));
  socket.on("presence:update", (p) => onPresence?.(p));
  socket.on("cursor:update", (c) => onCursor?.(c));
  // server may emit presence:typing or typing — forward both to callback
  socket.on("presence:typing", (t) => onTyping?.(t));
  socket.on("typing", (t) => onTyping?.(t));

  socket.on("disconnect", () => { /* optional cleanup */ });

  // helper emit wrappers
  // ✅ FIX: forward workspaceId from wrapper to server
  socket.joinDoc = ({ token, docId, workspaceId }) =>
    socket.emit("join", { token, docId, workspaceId });

  socket.leaveDoc = (docId) => socket.emit("leave", { docId });
  socket.sendDocUpdate = (payload) => socket.emit("doc:update", payload);
  socket.sendCursorUpdate = (payload) => socket.emit("cursor:update", payload);
  socket.sendTyping = (payload) => socket.emit("typing", payload);

  return socket;
}

export function disconnectSocket() {
  try {
    socket?.disconnect();
  } catch (e) {}
  socket = null;
}

export function getSocket() { return socket; }
