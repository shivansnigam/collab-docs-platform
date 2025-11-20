// models/RefreshToken.js
import mongoose from "mongoose";

const schema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

const RefreshToken = mongoose.model("RefreshToken", schema);
export default RefreshToken;
