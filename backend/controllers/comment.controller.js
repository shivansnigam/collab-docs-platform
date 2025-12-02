import Comment from "../models/Comment.js";
import Document from "../models/Document.js";
import Workspace from "../models/Workspace.js";
import { createNotification } from "../services/notification.service.js";

export const createComment = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ message: "Comment text required" });

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const workspace = await Workspace.findById(doc.workspace);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // create comment
    const comment = await Comment.create({
      workspace: workspace._id,
      document: doc._id,
      user: req.user.userId,
      text
    });

    // notify document author (if not same person)
    if (String(doc.author) !== String(req.user.userId)) {
      await createNotification({
        workspaceId: workspace._id,
        documentId: doc._id,
        actorId: req.user.userId,
        recipientId: doc.author,
        type: "comment",
        title: "New comment on your document",
        body: text,
        meta: { commentId: comment._id }
      });
    }

    return res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
};

export const getComments = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const list = await Comment.find({ document: documentId })
      .populate("user", "name email")
      .sort({ createdAt: 1 });

    return res.json({ comments: list });
  } catch (err) {
    next(err);
  }
};
