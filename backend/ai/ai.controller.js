import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import { runDocumentAI, runWorkspaceAI } from "./ai.service.js";
import { getWorkspaceAnalytics } from "../services/analytics.service.js";

export const documentAIHandler = async (req, res, next) => {
  try {
    const { documentId, mode } = req.body;

    if (!documentId) {
      return res.status(400).json({ message: "documentId required" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    let content = "";

    if (doc.latestVersion) {
      const version = await DocumentVersion.findById(doc.latestVersion);
      content = version?.content || "";
    } else {
      content = doc.content || "";
    }

    const result = await runDocumentAI({ content, mode });

    return res.json({ documentId, mode, result });
  } catch (err) {
    next(err);
  }
};

export const workspaceAIHandler = async (req, res, next) => {
  try {
    const { workspaceId, question } = req.body;

    if (!workspaceId || !question) {
      return res.status(400).json({ message: "workspaceId and question required" });
    }

    const documents = await Document.find({ workspace: workspaceId })
      .select("title content updatedAt")
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const { analytics, activities } = await getWorkspaceAnalytics(workspaceId, {
      activitiesLimit: 15
    });

    let context = "DOCUMENTS:\n";
    documents.forEach((d, i) => {
      context += `${i + 1}. ${d.title}\n${d.content}\n\n`;
    });

    context += "\nANALYTICS:\n";
    if (analytics) {
      context += `Active Users: ${analytics.activeUsersCount}\n`;
      context += `Total Edits: ${analytics.editsCount}\n`;
      context += `Uploads: ${analytics.uploadsCount}\n`;
      context += `Comments: ${analytics.commentsCount}\n`;
    }

    context += "\nRECENT ACTIVITIES:\n";
    activities.forEach((a) => {
      context += `- ${a.action} by ${a.user?.name || "Unknown"} on ${
        a.document?.title || "N/A"
      }\n`;
    });

    const result = await runWorkspaceAI({ context, question });

    return res.json({ workspaceId, question, result });
  } catch (err) {
    next(err);
  }
};
