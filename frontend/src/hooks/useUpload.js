import { useState } from "react";
import {
  signUpload,
  proxyUpload,
  getSignedUrl,
  confirmUpload,
} from "../services/upload.service";

/**
 * useUpload hook
 * - call uploadFile(file, { workspaceId, documentId })
 * - returns { uploading, progress, error, uploadFile }
 */
export default function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadFile = async (
    file,
    { workspaceId = null, documentId = null } = {}
  ) => {
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
        documentId,
      });

      const fileId = signResp.file?.id;
      const storageKey = signResp.file?.storageKey;
      const uploadUrl = signResp.uploadUrl;

      if (!uploadUrl) {
        // fallback to proxy if sign didn't return url
        throw new Error("No presigned URL, falling back to proxy");
      }

      // 2) PUT to S3 (use fetch so we can set Content-Type exactly)
      // Note: fetch doesn't provide progress events; we update coarse progress
      setProgress(5);

      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!putResp.ok) {
        // if S3 PUT failed, fallback to proxy
        throw new Error(`S3 upload failed: ${putResp.status}`);
      }

      setProgress(70);

      // 3) Confirm upload with backend so server updates DB status and analytics
      try {
        // prefer fileId + storageKey; if fileId missing, still send storageKey
        const confirmPayload = {
          fileId: fileId || undefined,
          storageKey: storageKey || undefined,
          workspaceId: workspaceId || undefined,
          documentId: documentId || undefined,
          size: file.size || undefined,
        };
        const confirmResp = await confirmUpload(confirmPayload);

        // confirm endpoint returns { file, url } per server implementation
        if (confirmResp && confirmResp.url) {
          setProgress(100);
          setUploading(false);
          return {
            file: confirmResp.file || signResp.file,
            url: confirmResp.url,
          };
        }

        // defensive fallback: if confirm didn't return url, try getSignedUrl
        if (fileId) {
          const getResp = await getSignedUrl(fileId);
          setProgress(100);
          setUploading(false);
          return { file: signResp.file, url: getResp.url };
        }

        // last resort: return signResp without a usable url
        setProgress(100);
        setUploading(false);
        return { file: signResp.file, url: null };
      } catch (confirmErr) {
        // if confirm failed, try to still get signed GET url (best-effort)
        try {
          if (fileId) {
            const getResp = await getSignedUrl(fileId);
            setProgress(100);
            setUploading(false);
            return { file: signResp.file, url: getResp.url };
          }
        } catch (getErr) {
          // ignore and fallback to proxy below
        }
        throw confirmErr;
      }
    } catch (err) {
      console.warn(
        "Presign+PUT+confirm failed, trying proxy fallback:",
        err?.message || err
      );
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
