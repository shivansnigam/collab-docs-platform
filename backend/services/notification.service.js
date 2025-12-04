// services/notification.service.js
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getIo } from '../socket/io.js';
import { sendEmail } from '../lib/email.js';

export const createNotification = async ({
  workspaceId,
  documentId,
  actorId,
  recipientId,
  type,
  title,
  body,
  meta = {}
}) => {
  const notif = await Notification.create({
    workspace: workspaceId || null,
    document: documentId || null,
    actor: actorId || null,
    recipient: recipientId,
    type,
    title,
    body,
    meta
  });

  // Try deliver via socket if recipient connected
  const io = getIo();
  let delivered = false;
  try {
    if (io) {
      const room = `user:${recipientId.toString()}`;
      const clients = io.sockets.adapter.rooms.get(room) || new Set();
      if (clients.size > 0) {
        io.to(room).emit('notification', { notification: notif });
        delivered = true;
        await Notification.findByIdAndUpdate(notif._id, { deliveredToClient: true });
      }
    }
  } catch (e) {
    console.error('notification.service: socket deliver failed', e);
  }

  // Email fallback if not delivered
  try {
    const recipient = await User.findById(recipientId).select('email name');
    if (recipient && recipient.email && !delivered) {
      const subject = title || `New notification: ${type}`;
      const text = body || '';
      const html = `<p>${body || ''}</p><p><small>If you don't want emails, update preferences.</small></p>`;
      await sendEmail({ to: recipient.email, subject, text, html });
      await Notification.findByIdAndUpdate(notif._id, { emailed: true });
    }
  } catch (e) {
    console.error('notification.service: email send failed', e);
  }

  return notif;
};

export const listNotificationsForUser = async (userId, { limit = 50 } = {}) => {
  return Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const markAsRead = async (notifId, userId) => {
  const n = await Notification.findOneAndUpdate(
    { _id: notifId, recipient: userId },
    { read: true },
    { new: true }
  );
  return n;
};
