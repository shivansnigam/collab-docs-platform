import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
}, { timestamps: true });

commentSchema.index({ document: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
