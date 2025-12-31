// ai/ai.routes.js
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { documentAIHandler } from "./ai.controller.js";

const router = express.Router();

router.post("/document", authMiddleware, documentAIHandler);

export default router;
