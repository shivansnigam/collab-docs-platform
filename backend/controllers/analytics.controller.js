// controllers/analytics.controller.js
import { getWorkspaceAnalytics } from '../services/analytics.service.js';
import Workspace from '../models/Workspace.js';
import Document from '../models/Document.js';
import Comment from '../models/Comment.js';

export const getWorkspaceAnalyticsHandler = async (req, res, next) => {
  try {
    const { id } = req.params; // workspace id
    if (!id) return res.status(400).json({ message: 'workspace id required' });

    // membership check (basic): user must be owner or member
    const ws = await Workspace.findById(id);
    if (!ws) return res.status(404).json({ message: 'Workspace not found' });

    const userId = req.user?.userId;
    const isOwner = String(ws.owner) === String(userId);
    const isMember = ws.members.some(m => String(m.user) === String(userId));
    if (!isOwner && !isMember) return res.status(403).json({ message: 'Forbidden' });

  
    const data = await getWorkspaceAnalytics(id, { activitiesLimit: 20 });

   
    const docs = await Document.find({ workspace: id }).select('_id').lean();
    const docIds = docs.map(d => d._id);

    let commentsCount = 0;
    if (docIds.length > 0) {
      commentsCount = await Comment.countDocuments({
        document: { $in: docIds }
      });
    }

    
    return res.json({
      ...data,
      commentsCount
    });
  } catch (err) {
    next(err);
  }
};