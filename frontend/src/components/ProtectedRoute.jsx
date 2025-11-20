import React from "react";
import { Navigate } from "react-router-dom";
import { getAccessToken } from "../services/auth.service";

export default function ProtectedRoute({ children }) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}
