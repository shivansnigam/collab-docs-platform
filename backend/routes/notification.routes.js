// routes/notification.routes.js
import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { createNotificationHandler, listMyNotifications, markNotificationRead } from '../controllers/notification.controller.js';

const router = express.Router();
router.use(authMiddleware);

// Create (internal/test) - authenticated (actor must be logged)
router.post('/', createNotificationHandler);

// List my notifications
router.get('/', listMyNotifications);

// Mark read
router.post('/:id/read', markNotificationRead);

export default router;
