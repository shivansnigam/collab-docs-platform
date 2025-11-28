import { io } from "socket.io-client";
const URL = import.meta.env.VITE_REALTIME_URL || "http://localhost:1234";
let socket = null;
export function getSocket() {
  if (!socket) socket = io(URL, { autoConnect: false });
  return socket;
}
