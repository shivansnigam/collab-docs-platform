// routes/auth.routes.js
import express from "express";
import passport from "passport";
import {
  register,
  login,
  logout,
  refresh,
  me,
  googleOAuthRedirect,
  githubOAuthRedirect
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

// ===== GOOGLE OAUTH =====
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/api/v1/auth/oauth-fail" }),
  googleOAuthRedirect
);

// ===== GITHUB OAUTH =====
router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/api/v1/auth/oauth-fail" }),
  githubOAuthRedirect
);

router.get("/oauth-fail", (req, res) => res.status(400).json({ message: "OAuth failed" }));

export default router;
