// scripts/socket-listener.js
import ioClient from "socket.io-client";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlY2YzNDUxMGVhYTYzOGRhM2YyMTAiLCJyb2xlcyI6WyJWaWV3ZXIiXSwiaWF0IjoxNzY0Njc1MzgwLCJleHAiOjE3NjQ2NzYyODB9.Pxa1Ec50H88tyioQVRbH4DNzRQcHO59zbHfMlmMdx0E";
const DOC_ID = "692ecfc9510eaa638da3f21b";
const workspaceId = "692ecf70510eaa638da3f214";


const REALTIME_URL = `http://localhost:${process.env.REALTIME_PORT || 1234}`;

console.log("Connecting to:", REALTIME_URL);

const socket = ioClient(REALTIME_URL, {
  auth: { token: TOKEN },
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("connected", socket.id);
  socket.emit("join", { token: TOKEN, docId: DOC_ID, workspaceId });
});

socket.on("notification", (data) => {
  console.log("GOT NOTIFICATION:", JSON.stringify(data, null, 2));
});

socket.on("connect_error", (err) => console.error("connect_error", err.message));
