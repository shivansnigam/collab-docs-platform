// controllers/document.controller.js

import mongoose from "mongoose";
import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import Workspace from "../models/Workspace.js";
import * as analytics from "../services/analytics.service.js";

const createDocument = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { title, content = "", parent = null, tags = [] } = req.body;
    if (!title) return res.status(400).json({ message: "Title required" });

    const ws = await Workspace.findById(workspaceId);
    if (!ws) return res.status(404).json({ message: "Workspace not found" });

    const doc = await Document.create({
      workspace: workspaceId,
      title: title.trim(),
      content,
      author: req.user.userId,
      parent,
      tags
    });

    const version = await DocumentVersion.create({
      document: doc._id,
      title: doc.title,
      content: doc.content,
      author: req.user.userId
    });

    doc.latestVersion = version._id;
    await doc.save();

    // analytics: record create + first edit
    try {
      await analytics.pushActivity({
        workspaceId: workspaceId,
        docId: doc._id,
        userId: req.user.userId,
        action: "create_document",
        meta: { title: doc.title }
      });
      await analytics.incEdits(workspaceId, req.user.userId, doc._id, 1);
    } catch (e) {
      console.error("analytics.createDocument error", e);
    }

    return res.status(201).json({ document: doc, version });
  } catch (err) {
    next(err);
  }
};

const getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id)
      .populate("author", "name email")
      .populate("latestVersion");
    if (!doc) return res.status(404).json({ message: "Document not found" });
    return res.json({ document: doc });
  } catch (err) {
    next(err);
  }
};

const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (title !== undefined) doc.title = title.trim();
    if (content !== undefined) doc.content = content;
    if (tags !== undefined) doc.tags = tags;

    const version = await DocumentVersion.create({
      document: doc._id,
      title: doc.title,
      content: doc.content,
      author: req.user.userId
    });

    doc.latestVersion = version._id;
    await doc.save();

    // analytics: record update edit
    try {
      await analytics.pushActivity({
        workspaceId: doc.workspace,
        docId: doc._id,
        userId: req.user.userId,
        action: "update_document",
        meta: { title: doc.title }
      });
      await analytics.incEdits(doc.workspace, req.user.userId, doc._id, 1);
    } catch (e) {
      console.error("analytics.updateDocument error", e);
    }

    return res.json({ document: doc, version });
  } catch (err) {
    next(err);
  }
};

const listVersions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const versions = await DocumentVersion.find({ document: id }).sort({
      createdAt: -1
    });
    return res.json({ versions });
  } catch (err) {
    next(err);
  }
};

const restoreVersion = async (req, res, next) => {
  try {
    const { id, versionId } = req.params;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const version = await DocumentVersion.findById(versionId);
    if (!version) return res.status(404).json({ message: "Version not found" });

    doc.title = version.title;
    doc.content = version.content;

    const newVersion = await DocumentVersion.create({
      document: doc._id,
      title: doc.title,
      content: doc.content,
      author: req.user.userId
    });

    doc.latestVersion = newVersion._id;
    await doc.save();

    try {
      await analytics.pushActivity({
        workspaceId: doc.workspace,
        docId: doc._id,
        userId: req.user.userId,
        action: "restore_version",
        meta: { restoredVersion: versionId }
      });
      await analytics.incEdits(doc.workspace, req.user.userId, doc._id, 1);
    } catch (e) {
      console.error("analytics.restoreVersion error", e);
    }

    return res.json({ document: doc, newVersion });
  } catch (err) {
    next(err);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    try {
      await analytics.pushActivity({
        workspaceId: doc.workspace,
        docId: doc._id,
        userId: req.user.userId,
        action: "delete_document",
        meta: { title: doc.title }
      });
    } catch (e) {
      console.error("analytics.deleteDocument error", e);
    }

    await DocumentVersion.deleteMany({ document: id });
    await doc.deleteOne();

    return res.json({ message: "Document deleted" });
  } catch (err) {
    next(err);
  }
};

// -------------- list documents by workspace (existing) --------------
const listDocumentsByWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId)
      return res
        .status(400)
        .json({ message: "workspaceId query param required" });

    const docs = await Document.find({ workspace: workspaceId }).sort({
      updatedAt: -1
    });
    return res.json({ documents: docs });
  } catch (err) {
    next(err);
  }
};

// -------------- NEW: full text search using MongoDB Atlas Search --------------
const searchDocuments = async (req, res, next) => {
  try {
    const { workspaceId, q } = req.query;
    let { page = 1, limit = 10 } = req.query;

    if (!workspaceId) {
      return res
        .status(400)
        .json({ message: "workspaceId query param required" });
    }

    if (!q || !q.trim()) {
      return res.status(400).json({ message: "q (query) param required" });
    }

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 50) limit = 50; // hard cap

    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    const skip = (page - 1) * limit;

    const searchStage = {
  $search: {
    index: "documents_search",
    compound: {
      must: [
        {
          text: {
            query: q,
            path: ["title", "content", "tags"],
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2
            }
          }
        }
      ],
      filter: [
        {
          equals: {
            path: "workspace",
            value: workspaceObjectId
          }
        }
      ]
    },
    highlight: {
      path: ["title", "content"]
    }
  }
};


    const pipeline = [
      searchStage,
      {
        $facet: {
          results: [
            {
              $project: {
                title: 1,
                workspace: 1,
                parent: 1,
                author: 1,
                updatedAt: 1,
                createdAt: 1,
                tags: 1,
                score: { $meta: "searchScore" },
                highlights: { $meta: "searchHighlights" },
                snippet: {
                  $substrCP: ["$content", 0, 200]
                }
              }
            },
            { $sort: { score: -1, updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            {
              $count: "count"
            }
          ]
        }
      }
    ];

    const aggResult = await Document.aggregate(pipeline);
    const facet = aggResult[0] || {};
    const results = facet.results || [];
    const totalCountDoc = (facet.totalCount || [])[0];
    const total = totalCountDoc ? totalCountDoc.count : 0;

    return res.json({
      query: q,
      workspaceId,
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      documents: results
    });
  } catch (err) {
    console.error("searchDocuments error", err);
    next(err);
  }
};

export {
  createDocument,
  getDocument,
  updateDocument,
  listVersions,
  restoreVersion,
  deleteDocument,
  listDocumentsByWorkspace,
  searchDocuments
};
