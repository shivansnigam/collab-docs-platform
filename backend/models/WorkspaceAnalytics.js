// models/WorkspaceAnalytics.js
import mongoose from 'mongoose';

const workspaceAnalyticsSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true },

  // aggregate counters
  activeUsersCount: { type: Number, default: 0 },
  editsCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  uploadsCount: { type: Number, default: 0 },

  // time-series optional (store daily buckets)
  dailyEdits: [{
    date: { type: String }, // YYYY-MM-DD
    count: { type: Number, default: 0 }
  }],
  dailyUploads: [{
    date: { type: String },
    count: { type: Number, default: 0 }
  }]
}, { timestamps: true });

const WorkspaceAnalytics = mongoose.model('WorkspaceAnalytics', workspaceAnalyticsSchema);
export default WorkspaceAnalytics;
