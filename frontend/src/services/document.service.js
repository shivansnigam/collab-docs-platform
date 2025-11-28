// src/services/document.service.js
import api from "./api";

export const getDocumentsForWorkspace = (workspaceId) =>
  api.get(`/documents?workspaceId=${workspaceId}`);

export const createDocument = (workspaceId, data) =>
  api.post(`/documents/workspace/${workspaceId}`, data);

export const getDocument = (id) => api.get(`/documents/${id}`);

export const updateDocument = (id, data) => api.put(`/documents/${id}`, data);

export const deleteDocument = (id) => api.delete(`/documents/${id}`);

export const listVersions = (id) => api.get(`/documents/${id}/versions`);

export const restoreVersion = (id, versionId) =>
  api.post(`/documents/${id}/versions/${versionId}/restore`);
