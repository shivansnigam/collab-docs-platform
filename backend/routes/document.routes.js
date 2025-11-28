// routes/document.routes.js
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireWorkspaceMember from "../middlewares/membership.middleware.js";
import {
  createDocument,
  getDocument,
  updateDocument,
  listVersions,
  restoreVersion,
  deleteDocument,
  listDocumentsByWorkspace
} from "../controllers/document.controller.js";

const router = express.Router();

// NEW: list documents by workspace via query ?workspaceId=<id>
router.get("/", authMiddleware, listDocumentsByWorkspace);

// create document under a workspace
router.post("/workspace/:workspaceId", authMiddleware, requireWorkspaceMember, createDocument);

// document CRUD
router.get("/:id", authMiddleware, getDocument);
router.put("/:id", authMiddleware, updateDocument);
router.delete("/:id", authMiddleware, deleteDocument);

// versions
router.get("/:id/versions", authMiddleware, listVersions);
router.post("/:id/versions/:versionId/restore", authMiddleware, restoreVersion);

export default router;
