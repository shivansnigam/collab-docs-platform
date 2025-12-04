// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import protectedRoutes from "./routes/protected.routes.js";
import setupPassport from "./config/passport.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import documentRoutes from "./routes/document.routes.js";
import uploadsRoutes from './routes/uploads.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import commentRoutes from "./routes/comment.routes.js";


import { sendEmail } from "./lib/email.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

setupPassport();
app.use(passport.initialize());

app.get("/", (req, res) => res.send("Auth API running"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/protected", protectedRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use("/api/v1/comments", commentRoutes);

/*
  Quick test route for sending email (used by Postman or local quick tests).
  POST /api/v1/test-email
  body: { "to": "someone@example.com", "subject": "optional", "text": "optional", "html": "optional" }
*/
app.post("/api/v1/test-email", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to) return res.status(400).json({ error: "Missing 'to' in request body" });

    await sendEmail({
      to,
      subject: subject || "Test email from NoteApp",
      text: text || "ok",
      html: html || "<p>ok</p>"
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("test-email failed", e);
    return res.status(500).json({ error: e.message || "Send failed" });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;
