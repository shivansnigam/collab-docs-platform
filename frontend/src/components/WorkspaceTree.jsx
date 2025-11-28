// src/components/WorkspaceTree.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";

/**
 * convert flat documents -> nested tree by parent
 * (keeps your original logic but fixes small typo and adds sorting)
 */
function buildTree(items = []) {
  const map = {};
  items.forEach(i => (map[i._id] = { ...i, children: [] }));
  const roots = [];
  items.forEach(i => {
    if (i.parent) {
      if (map[i.parent]) map[i.parent].children.push(map[i._id]);
      else roots.push(map[i._id]); // fallback if parent missing
    } else {
      // fixed typo here (was map[i._1d])
      roots.push(map[i._id]);
    }
  });
  // sort helper (optional, stable alphabetical)
  const sortFn = (a, b) => (a.title || "").localeCompare(b.title || "");
  const sortTree = (nodes) => {
    nodes.sort(sortFn);
    nodes.forEach(n => n.children && sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

const TreeNode = ({ node, level = 0, onOpen, selectedId }) => {
  const [open, setOpen] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node._id;

  // simple inline styles so you don't need extra css file
  const nodeStyle = {
    paddingLeft: 6 + level * 12,
    marginBottom: 6,
    borderRadius: 6,
    background: isSelected ? "rgba(13,110,253,0.08)" : "transparent",
    borderLeft: isSelected ? "3px solid rgba(13,110,253,0.9)" : "3px solid transparent"
  };

  return (
    <div style={nodeStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hasChildren ? (
          <button
            onClick={() => setOpen(v => !v)}
            style={{ width: 22, background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}
            aria-label="toggle"
            type="button"
            title={open ? "Collapse" : "Expand"}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span style={{ display: "inline-block", width: 22 }} />
        )}

        <button
          onClick={() => onOpen(node)}
          style={{
            background: "transparent",
            border: 0,
            color: "inherit",
            textAlign: "left",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%"
          }}
          title={node.title || "Untitled"}
          type="button"
        >
          <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", fontWeight: isSelected ? 600 : 500 }}>
            {node.title || "Untitled"}
          </span>
          <small style={{ color: "#8fa3bf", marginLeft: 8 }}>{node.tags?.length ? `• ${node.tags.join(", ")}` : ""}</small>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9aaac3" }}>
            {node.updatedAt || node.createdAt ? new Date(node.updatedAt || node.createdAt).toLocaleDateString() : ""}
          </div>
        </button>
      </div>

      {open && hasChildren && (
        <div style={{ marginTop: 6 }}>
          {node.children.map(ch => (
            <TreeNode key={ch._id} node={ch} level={level + 1} onOpen={onOpen} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function WorkspaceTree({ workspaceId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const location = useLocation();

  // derive selected id from URL /documents/:id (keeps in sync with router)
  const selectedId = useMemo(() => {
    const m = location.pathname.match(/\/documents\/([^/]+)/);
    return m ? m[1] : null;
  }, [location.pathname]);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    api.get("/documents", { params: { workspaceId } })
      .then(res => setDocs(res.data.documents || res.data || []))
      .catch(err => {
        console.error("WorkspaceTree load error:", err);
        setDocs([]);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const tree = useMemo(() => buildTree(docs || []), [docs]);

  const handleOpen = (node) => {
    // navigate to document route (same as your app uses)
    nav(`/documents/${node._id}`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Pages</strong>
        <button className="btn btn-sm btn-outline-primary" onClick={() => nav(`/workspaces/${workspaceId}/newpage`)}>+ New</button>
      </div>

      {loading ? (
        <div style={{ color: "#9aaac3" }}>Loading...</div>
      ) : tree.length === 0 ? (
        <div style={{ color: "#9aaac3" }}>No pages yet.</div>
      ) : (
        <div>{tree.map(n => <TreeNode key={n._id} node={n} onOpen={handleOpen} selectedId={selectedId} />)}</div>
      )}
    </div>
  );
}
