// models/Document.js
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true, trim: true },
  content: { type: mongoose.Schema.Types.Mixed, default: '' }, // markdown or raw text
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },  
  tags: [{ type: String }],
  latestVersion: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentVersion" }
}, { timestamps: true });

const Document = mongoose.model("Document", documentSchema);
export default Document;
