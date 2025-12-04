// controllers/workspace.controller.js
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import mongoose from "mongoose";

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

    // FIX: make owner also admin in global user roles
    await User.findByIdAndUpdate(ownerId, {
      $addToSet: { roles: "Admin" }
    });

    const workspaceObj = ws.toObject();
    workspaceObj.members = workspaceObj.members.filter(
      (m) => String(m.user) !== String(workspaceObj.owner)
    );

    return res.status(201).json({ workspace: workspaceObj });
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
    }).sort({ updatedAt: -1 })
      .populate("owner", "name email roles")
      .populate("members.user", "name email roles");

    // filter out owner from members in each workspace to avoid duplicate display
    const cleaned = workspaces.map(ws => {
      const w = ws.toObject();
      w.members = (w.members || []).filter(m => String(m.user._id || m.user) !== String(w.owner._id || w.owner));
      return w;
    });

    return res.json({ workspaces: cleaned });
  } catch (err) { next(err); }
};

const getWorkspaceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid workspace id" });

    const workspace = await Workspace.findById(id)
      .populate("owner", "name email roles")
      .populate("members.user", "name email roles");
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    const wsObj = workspace.toObject();
     
    wsObj.members = (wsObj.members || []).filter(m => String(m.user._id || m.user) !== String(wsObj.owner._id || wsObj.owner));

    return res.json({ workspace: wsObj });
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

    // prevent adding the owner as a member (owner is already owner)
    if (String(user._id) === String(workspace.owner)) {
      return res.status(409).json({ message: "User is the owner" });
    }

    const exists = workspace.members.some(m => String(m.user) === String(user._id));
    if (exists) return res.status(409).json({ message: "User already member" });

    workspace.members.push({ user: user._id, role: role || "Viewer" });
    await workspace.save();

    // populate for response
    const updated = await Workspace.findById(id)
      .populate("owner", "name email roles")
      .populate("members.user", "name email roles");

    const wsObj = updated.toObject();
    wsObj.members = (wsObj.members || []).filter(m => String(m.user._id || m.user) !== String(wsObj.owner._id || wsObj.owner));

    return res.json({ workspace: wsObj });
  } catch (err) { next(err); }
};

export { createWorkspace, getMyWorkspaces, getWorkspaceById, addMember };