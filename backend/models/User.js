// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },  
  roles: { type: [String], default: ["Viewer"], enum: ["Admin","Editor","Viewer"] },
  provider: { type: String, default: "local" },  
  providerId: { type: String }
}, { timestamps: true });

userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  return await bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
