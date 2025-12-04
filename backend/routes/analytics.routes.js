// routes/analytics.routes.js
import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { getWorkspaceAnalyticsHandler } from '../controllers/analytics.controller.js';

const router = express.Router();

router.use(authMiddleware);

 
router.get('/workspace/:id', getWorkspaceAnalyticsHandler);

export default router;
