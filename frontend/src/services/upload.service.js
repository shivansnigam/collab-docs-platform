import api from "./api";

/**
 * Request presigned PUT URL from backend
 * body: { filename, contentType, size, workspaceId?, documentId? }
 * returns { file: { id, storageKey }, uploadUrl, expiresIn }
 */
export const signUpload = (payload) => api.post("/uploads/sign", payload).then(r => r.data);

/**
 * Server-proxy upload (FormData) fallback
 * formData should contain file (key: file) and optional workspaceId/documentId
 * returns { file, url }
 */
export const proxyUpload = (formData) => api.post("/uploads", formData, {
  headers: { "Content-Type": "multipart/form-data" }
}).then(r => r.data);

/**
 * Get fresh presigned GET url for an existing file id
 * returns { url, expiresIn }
 */
export const getSignedUrl = (fileId) => api.get(`/uploads/${fileId}/signed-url`).then(r => r.data);

/**
 * Confirm upload with backend after successful client -> S3 PUT
 * body: { fileId?, storageKey?, workspaceId?, documentId?, size? }
 * returns { file, url }
 */
export const confirmUpload = (payload) => api.post("/uploads/confirm", payload).then(r => r.data);
