import api from "./api";

/**
 * GET workspace analytics and recent activities
 * Response:
 * { analytics: { ... }, activities: [...] }
 */
export const getWorkspaceAnalytics = (workspaceId, opts = {}) =>
  api
    .get(`/analytics/workspace/${workspaceId}`, {
      params: { activitiesLimit: opts.activitiesLimit || 20 },
    })
    .then((r) => r.data);

/**
 * PHASE 2 – Workspace AI
 * POST /api/v1/ai/workspace
 * body: { workspaceId, question }
 */
export const runWorkspaceAI = ({ workspaceId, question }) =>
  api
    .post("/ai/workspace", {
      workspaceId,
      question,
    })
    .then((r) => r.data);
