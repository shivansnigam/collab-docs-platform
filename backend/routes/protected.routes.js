// routes/protected.routes.js (replace profile handler)
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireRole from "../middlewares/role.middleware.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user }); 
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/admin-only", authMiddleware, requireRole("Admin"), (req, res) => {
  res.json({ message: "Admin content" });
});

export default router;
