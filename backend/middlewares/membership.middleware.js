// middlewares/membership.middleware.js
import Workspace from "../models/Workspace.js";

const requireWorkspaceMember = async (req, res, next) => {
  try {
    // safe access with optional chaining
    const workspaceId =
      req.params?.workspaceId || req.body?.workspaceId || req.params?.id;

    if (!workspaceId) return res.status(400).json({ message: "Workspace id missing" });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const isOwner = String(workspace.owner) === String(userId);
    const isMember = workspace.members.some(m => String(m.user) === String(userId));

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Forbidden: not a workspace member" });
    }

    // attach for controllers
    req.workspace = workspace;
    next();
  } catch (err) {
    next(err);
  }
};

export default requireWorkspaceMember;
