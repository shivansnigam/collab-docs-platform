// ai/ai.controller.js
import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import { runDocumentAI } from "./ai.service.js";

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

    const result = await runDocumentAI({
      content,
      mode,
    });

    return res.json({
      documentId,
      mode,
      result,
    });
  } catch (err) {
    next(err);
  }
};
