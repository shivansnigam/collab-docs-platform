// models/Workspace.js
import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["Admin","Editor","Viewer"], default: "Viewer" }
    }
  ],
  description: { type: String, trim: true },
}, { timestamps: true });

const Workspace = mongoose.model("Workspace", workspaceSchema);
export default Workspace;
