// test-socket.js
import { io } from "socket.io-client";

const REALTIME_URL = "http://localhost:1234";
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTI4MjI5MDI4MTk4MjRlMmExODJjNTQiLCJyb2xlcyI6WyJWaWV3ZXIiXSwiaWF0IjoxNzY0MjM4OTgwLCJleHAiOjE3NjQyMzk4ODB9.mTMtkRaAPSonlzh3IL00SGJ_DYrj6Oy25b9IGzre6tU"; // paste your token
const DOC_ID = "692823702819824e2a182c62";        // paste doc id
const WORKSPACE_ID = "692823022819824e2a182c5b"; // paste workspace id

const socket = io(REALTIME_URL, { transports: ["websocket"] });

socket.on("connect", () => {
  console.log("connected", socket.id);

  // send join (include workspaceId)
  socket.emit("join", { token: ACCESS_TOKEN, docId: DOC_ID, workspaceId: WORKSPACE_ID });

  // after 1s, send a doc:update
  setTimeout(() => {
    socket.emit("doc:update", {
      token: ACCESS_TOKEN,
      docId: DOC_ID,
      workspaceId: WORKSPACE_ID,
      delta: { snapshot: `hello ${new Date().toISOString()}` } // full snapshot used by server
    });
  }, 1000);

  // after 2s, leave
  setTimeout(() => {
    socket.emit("leave", { docId: DOC_ID, workspaceId: WORKSPACE_ID });
    socket.disconnect();
  }, 2000);
});

socket.on("init", (d) => console.log("init:", d));
socket.on("doc:update", (u) => console.log("doc:update recv:", u));
socket.on("presence:update", (p) => console.log("presence:update:", p));
socket.on("error", (e) => console.error("socket error:", e));
