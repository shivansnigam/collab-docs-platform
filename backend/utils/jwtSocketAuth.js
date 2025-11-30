// utils/jwtSocketAuth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function getUserFromToken(token) {
  try {
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.userId || payload.sub);
    return user;
  } catch (err) {
    console.error('JWT socket auth failed', err?.message || err);
    return null;
  }
}

