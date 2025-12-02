// controllers/notification.controller.js
import * as notificationService from '../services/notification.service.js';
import User from '../models/User.js';

// endpoint for creating a notification (used by server internals or admin/testing)
export const createNotificationHandler = async (req, res, next) => {
  try {
    const { workspaceId, documentId, actorId, recipientId, type, title, body, meta } = req.body;
    if (!recipientId || !type) return res.status(400).json({ message: 'recipientId and type required' });

    const notif = await notificationService.createNotification({
      workspaceId, documentId, actorId: actorId || req.user?.userId, recipientId, type, title, body, meta
    });

    return res.status(201).json({ notification: notif });
  } catch (err) { next(err); }
};

export const listMyNotifications = async (req, res, next) => {
  try {
    const list = await notificationService.listNotificationsForUser(req.user.userId, { limit: 50 });
    return res.json({ notifications: list });
  } catch (err) { next(err); }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await notificationService.markAsRead(id, req.user.userId);
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    return res.json({ notification: updated });
  } catch (err) { next(err); }
};
