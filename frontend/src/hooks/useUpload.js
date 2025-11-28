// src/hooks/useUpload.js
import { useState } from "react";
import { signUpload, proxyUpload, getSignedUrl } from "../services/upload.service";

/**
 * useUpload hook
 * - call uploadFile(file, { workspaceId, documentId })
 * - returns { uploading, progress, error, uploadFile }
 */
export default function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadFile = async (file, { workspaceId = null, documentId = null } = {}) => {
    setError(null);
    setProgress(0);
    setUploading(true);

    try {
      // 1) ask backend for presigned PUT url
      const signResp = await signUpload({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        workspaceId,
        documentId
      });

      const fileId = signResp.file?.id;
      const uploadUrl = signResp.uploadUrl;

      if (!uploadUrl) {
        // fallback to proxy if sign didn't return url
        throw new Error("No presigned URL, falling back to proxy");
      }

      // 2) PUT to S3 (use fetch so we can set Content-Type exactly)
      // Note: we cannot reliably get progress with fetch; for big files you may use XHR.
      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });

      if (!putResp.ok) {
        // if S3 PUT failed, fallback to proxy
        throw new Error(`S3 upload failed: ${putResp.status}`);
      }

      setProgress(90);

      // 3) ask backend for a fresh GET signed URL to display the uploaded object
      if (!fileId) {
        // defensive: if backend didn't create DB record, fallback to proxy
        throw new Error("Missing file id from sign response");
      }

      const getResp = await getSignedUrl(fileId);
      setProgress(100);
      setUploading(false);
      return { file: signResp.file, url: getResp.url };
    } catch (err) {
      console.warn("Presign+PUT failed, trying proxy fallback:", err?.message || err);
      // fallback: server-proxy upload via FormData (multer -> S3)
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (workspaceId) fd.append("workspaceId", workspaceId);
        if (documentId) fd.append("documentId", documentId);

        const proxyResp = await proxyUpload(fd);
        setProgress(100);
        setUploading(false);
        return { file: proxyResp.file, url: proxyResp.url };
      } catch (proxyErr) {
        setUploading(false);
        setError(proxyErr?.message || "Upload failed");
        throw proxyErr;
      }
    }
  };

  return { uploading, progress, error, uploadFile };
}
