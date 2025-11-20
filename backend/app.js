// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import protectedRoutes from "./routes/protected.routes.js";
import setupPassport from "./config/passport.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

setupPassport();
app.use(passport.initialize());

app.get("/", (req, res) => res.send("Auth API running"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/protected", protectedRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;
