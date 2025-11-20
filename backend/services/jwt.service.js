// services/jwt.service.js
import jwt from "jsonwebtoken";
import RefreshToken from "../models/RefreshToken.js";
import { v4 as uuidv4 } from "uuid";

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m"
  });
};

const msFromStr = (str) => {
  const num = parseInt(str);
  if (str.endsWith("d")) return num * 24 * 60 * 60 * 1000;
  if (str.endsWith("h")) return num * 60 * 60 * 1000;
  if (str.endsWith("m")) return num * 60 * 1000;
  return num;
};

const createRefreshToken = async (userId) => {
  const token = uuidv4();
  const expires = process.env.REFRESH_TOKEN_EXPIRES || "7d";
  const expiresAt = new Date(Date.now() + msFromStr(expires));
  await RefreshToken.create({ token, user: userId, expiresAt });
  return token;
};

const findRefreshToken = async (token) => {
  return await RefreshToken.findOne({ token });
};

const revokeRefreshToken = async (token) => {
  await RefreshToken.deleteOne({ token });
};

const rotateRefreshToken = async (oldToken, userId) => {
  if (oldToken) await revokeRefreshToken(oldToken);
  return await createRefreshToken(userId);
};

export {
  createAccessToken,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken
};
