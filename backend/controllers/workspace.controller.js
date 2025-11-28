// controllers/workspace.controller.js
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";

const createWorkspace = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const ownerId = req.user.userId;
    const ws = await Workspace.create({
      name: name.trim(),
      description: description || "",
      owner: ownerId,
      members: [{ user: ownerId, role: "Admin" }]
    });

    return res.status(201).json({ workspace: ws });
  } catch (err) { next(err); }
};

const getMyWorkspaces = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // owner or member
    const workspaces = await Workspace.find({
      $or: [
        { owner: userId },
        { "members.user": userId }
      ]
    }).sort({ updatedAt: -1 });

    return res.json({ workspaces });
  } catch (err) { next(err); }
};

const getWorkspaceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id)
      .populate("owner", "name email roles")
      .populate("members.user", "name email roles");
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    return res.json({ workspace });
  } catch (err) { next(err); }
};

// invite/add member by email (simpler: adds existing user)
const addMember = async (req, res, next) => {
  try {
    const { id } = req.params; // workspace id
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // only owner or admin can add
    const requester = req.user.userId;
    const isOwner = String(workspace.owner) === String(requester);
    const reqMember = workspace.members.find(m => String(m.user) === String(requester));
    const isAdmin = reqMember && reqMember.role === "Admin";

    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User with email not found" });

    const exists = workspace.members.some(m => String(m.user) === String(user._id));
    if (exists) return res.status(409).json({ message: "User already member" });

    workspace.members.push({ user: user._id, role: role || "Viewer" });
    await workspace.save();

    return res.json({ workspace });
  } catch (err) { next(err); }
};

export { createWorkspace, getMyWorkspaces, getWorkspaceById, addMember };
