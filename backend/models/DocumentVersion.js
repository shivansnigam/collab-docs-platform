// models/DocumentVersion.js
import mongoose from "mongoose";

const documentVersionSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
  title: { type: String, required: true },
  content: { type: String, default: "" },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});

const DocumentVersion = mongoose.model("DocumentVersion", documentVersionSchema);
export default DocumentVersion;
