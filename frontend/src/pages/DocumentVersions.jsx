// src/pages/DocumentVersions.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { marked } from "marked";

/* ===== helpers ===== */
const removeHtmlHeaderMarker = (s = "") => s.replace(/^\s*html\s*=+\s*/i, "").trim();
const escapeHtml = (str = "") =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const stripTags = (html = "") => html.replace(/<\/?[^>]+(>|$)/g, "");
const sanitizeHtmlFragment = (html = "") =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
const getSnippetText = (raw = "", max = 300) => {
  const cleaned = removeHtmlHeaderMarker(raw || "");
  if (/<[a-z][\s\S]*>/i.test(cleaned)) return stripTags(cleaned).slice(0, max);
  try {
    const html = marked.parse(cleaned || "");
    return stripTags(html).slice(0, max);
  } catch {
    return cleaned.slice(0, max);
  }
};

/* ===== component ===== */
export default function DocumentVersions() {
  const { id } = useParams();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await api.get(`/documents/${id}/versions`);
      setVersions(resp.data.versions || resp.data || []);
    } catch (err) {
      console.error("Could not load versions", err);
      alert(err?.response?.data?.message || "Could not load versions");
    } finally {
      setLoading(false);
    }
  };

  const preview = (v) => {
    const raw = v.content || "";
    const cleaned = removeHtmlHeaderMarker(raw);

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      alert("Could not open preview window. Check popup blocker.");
      return;
    }

    const css = `
      :root{--bg:#f5f7fa;--card:#ffffff;--muted:#6b7280;--text:#0f172a}
      html,body{height:100%}
      body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial;background:var(--bg);-webkit-font-smoothing:antialiased;}
      .controls{position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:9999}
      .controls button{background:var(--card);border:1px solid #e6e9ef;padding:8px 10px;border-radius:8px;cursor:pointer}
      .container{max-width:780px;margin:40px auto;background:var(--card);border-radius:10px;padding:36px;box-shadow:0 10px 30px rgba(2,6,23,0.08);line-height:1.6;color:var(--text)}
      .title{font-weight:700;margin-bottom:8px;font-size:20px;word-break:break-word}
      .meta{color:var(--muted);font-size:13px;margin-bottom:18px}
      .content p{margin:0 0 12px 0;font-size:16px}
      pre{background:#0b1220;color:#e6eef8;padding:12px;border-radius:6px;overflow:auto}
      img{max-width:100%;height:auto;display:block;margin:12px 0}
      a{color:#0f62fe}
    `;

    let finalHtml = "";
    if (/<[a-z][\s\S]*>/i.test(cleaned)) {
      finalHtml = sanitizeHtmlFragment(cleaned);
    } else {
      try {
        finalHtml = marked.parse(cleaned || "");
      } catch {
        finalHtml = `<pre>${escapeHtml(cleaned)}</pre>`;
      }
    }

    win.document.open();
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(v.title || "Preview")}</title><style>${css}</style></head><body>
        <div class="controls" role="toolbar" aria-label="preview controls">
          <button id="openNew">Open in new window</button>
          <button id="printBtn">Print</button>
        </div>
        <main class="container" role="main" aria-labelledby="doc-title">
          <h1 id="doc-title" class="title">${escapeHtml(v.title || "")}</h1>
          <div class="meta">${new Date(v.createdAt).toLocaleString()}</div>
          <article class="content">${finalHtml}</article>
        </main>
        <script>
          (function(){
            const p = document.getElementById('printBtn');
            const o = document.getElementById('openNew');
            p && p.addEventListener('click', ()=>{ window.print(); });
            o && o.addEventListener('click', ()=>{ window.open(location.href, '_blank'); });
            try { document.querySelectorAll('[onerror],[onclick],[onload]').forEach(el=>{ ['onerror','onclick','onload'].forEach(a=>el.removeAttribute(a)); }); } catch(e){}
          })();
        </script>
      </body></html>`
    );
    win.document.close();
  };

  const restore = async (versionId) => {
    if (!confirm("Restore this version? This will create a new version with restored content.")) return;
    try {
      await api.post(`/documents/${id}/versions/${versionId}/restore`);
      alert("Restored. Re-opening document.");
      nav(`/documents/${id}`);
    } catch (err) {
      console.error("Restore failed", err);
      alert(err?.response?.data?.message || "Could not restore version");
    }
  };

  return (
    <div className="container mt-4">
      <h4>Versions</h4>

      {loading ? (
        <div className="spinner-border" />
      ) : (
        <div className="list-group">
          {versions.length === 0 && <div className="alert alert-secondary">No versions found.</div>}

          {versions.map((v) => (
            <div
              key={v._id}
              className="list-group-item d-flex align-items-start"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 8,
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              {/* left: text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <strong style={{ wordBreak: "break-word" }}>{v.title}</strong>
                </div>
                <div className="text-muted small" style={{ marginTop: 4 }}>{new Date(v.createdAt).toLocaleString()}</div>

                <div style={{ marginTop: 10 }}>
                  <small
                    className="text-muted"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {getSnippetText(v.content || "", 320)}
                    {(v.content || "").length > 320 ? "…" : ""}
                  </small>
                </div>
              </div>

              {/* right: actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 12 }}>
                <button className="btn btn-sm btn-outline-primary" style={{ minWidth: 92 }} onClick={() => preview(v)}>Preview</button>
                <button className="btn btn-sm btn-danger" style={{ minWidth: 92 }} onClick={() => restore(v._id)}>Restore</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}