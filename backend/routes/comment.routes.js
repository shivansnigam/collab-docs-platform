import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import requireWorkspaceMember from "../middlewares/membership.middleware.js";
import { createComment, getComments } from "../controllers/comment.controller.js";

const router = express.Router();

router.use(authMiddleware);

// get all comments of document
router.get("/:documentId", requireWorkspaceMember, getComments);

// create comment
router.post("/:documentId", requireWorkspaceMember, createComment);

export default router;
