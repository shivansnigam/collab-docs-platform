// controllers/auth.controller.js
import User from "../models/User.js";
import {
  createAccessToken,
  createRefreshToken,
  findRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken
} from "../services/jwt.service.js";

// =============================
// REGISTER
// =============================
const register = async (req, res, next) => {
  try {
    const { name, email, password, roles } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    let exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "User already exists" });

    const user = await User.create({
      name,
      email,
      password,
      roles: roles || ["Viewer"]
    });

    const accessToken = createAccessToken({ userId: user._id, roles: user.roles });
    const refreshToken = await createRefreshToken(user._id);

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, roles: user.roles },
      accessToken,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

// =============================
// LOGIN
// =============================
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = createAccessToken({ userId: user._id, roles: user.roles });
    const refreshToken = await createRefreshToken(user._id);

    res.json({
      user: { id: user._id, name: user.name, email: user.email, roles: user.roles },
      accessToken,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

// =============================
// LOGOUT
// =============================
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
};

// =============================
// REFRESH TOKEN
// =============================
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "Refresh token required" });

    const doc = await findRefreshToken(refreshToken);
    if (!doc) return res.status(401).json({ message: "Invalid refresh token" });
    if (doc.expiresAt < new Date()) {
      await revokeRefreshToken(refreshToken);
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const user = await User.findById(doc.user);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newRefresh = await rotateRefreshToken(refreshToken, user._id);
    const accessToken = createAccessToken({ userId: user._id, roles: user.roles });

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
};

// =============================
// ME (PROTECTED)
// =============================
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// =============================
// HELPER: build redirect URL
// =============================
const buildRedirectUrl = (accessToken, refreshToken) => {
  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
  const params = `access=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`;
  return `${FRONTEND.replace(/\/$/, "")}/oauth-success?${params}`;
};

// =============================
// GOOGLE OAUTH REDIRECT
// (called by passport on successful oauth)
// =============================
const googleOAuthRedirect = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(400).json({ message: "OAuth user missing" });

    const accessToken = createAccessToken({ userId: user._id, roles: user.roles });
    const refreshToken = await createRefreshToken(user._id);

    const redirectUrl = buildRedirectUrl(accessToken, refreshToken);
    return res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
};

// =============================
// GITHUB OAUTH REDIRECT
// =============================
const githubOAuthRedirect = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(400).json({ message: "OAuth user missing" });

    const accessToken = createAccessToken({ userId: user._id, roles: user.roles });
    const refreshToken = await createRefreshToken(user._id);

    const redirectUrl = buildRedirectUrl(accessToken, refreshToken);
    return res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
};

export {
  register,
  login,
  logout,
  refresh,
  me,
  googleOAuthRedirect,
  githubOAuthRedirect
};
