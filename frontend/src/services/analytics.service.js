// src/services/analytics.service.js
import api from "./api";

/**
 * GET workspace analytics and recent activities
 * Response shape expected from backend:
 * { analytics: { ... }, activities: [...] }
 */
export const getWorkspaceAnalytics = (workspaceId, opts = {}) =>
  api
    .get(`/analytics/workspace/${workspaceId}`, { params: { activitiesLimit: opts.activitiesLimit || 20 } })
    .then((r) => r.data);
