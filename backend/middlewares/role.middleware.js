// middlewares/role.middleware.js
const requireRole = (...allowed) => (req, res, next) => {
  const roles = req.user?.roles || [];
  const ok = roles.some(r => allowed.includes(r));
  if (!ok) return res.status(403).json({ message: "Forbidden: insufficient permissions" });
  next();
};

export default requireRole;
