// ai/ai.routes.js
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { documentAIHandler,workspaceAIHandler } from "./ai.controller.js";

const router = express.Router();

router.post("/document", authMiddleware, documentAIHandler);
router.post("/workspace", authMiddleware, workspaceAIHandler);
export default router;
