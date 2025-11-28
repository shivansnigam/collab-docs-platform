// models/Activity.js
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true }, // e.g. "edit", "create_document", "upload", "comment", "join", "leave"
  meta: { type: mongoose.Schema.Types.Mixed }, // extra info: title, snippet, fileId, etc.
  createdAt: { type: Date, default: Date.now }
});

// keep index for efficient recent queries
activitySchema.index({ workspace: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
