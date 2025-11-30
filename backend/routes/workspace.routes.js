// routes/workspace.routes.js
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireWorkspaceMember from "../middlewares/membership.middleware.js";
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspaceById,
  addMember
} from "../controllers/workspace.controller.js";

const router = express.Router();

router.use(authMiddleware);

// create + list
router.post("/", createWorkspace);
router.get("/", getMyWorkspaces);

// workspace detail + add member
router.get("/:id", requireWorkspaceMember, getWorkspaceById);
router.post("/:id/members", requireWorkspaceMember, addMember);

export default router;