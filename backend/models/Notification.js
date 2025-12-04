// models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: false },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: false },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who triggered
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  
  type: { type: String, enum: ['mention','comment','share','custom'], required: true },
  title: { type: String },
  body: { type: String }, // short text
  meta: { type: mongoose.Schema.Types.Mixed },  
  read: { type: Boolean, default: false },
  deliveredToClient: { type: Boolean, default: false },  
  emailed: { type: Boolean, default: false }  
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
