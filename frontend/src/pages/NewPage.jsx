// src/pages/NewPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function NewPage() {
  const { id: workspaceId } = useParams();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [parent, setParent] = useState("");
  const [tags, setTags] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // load existing docs for parent dropdown (optional)
    let mounted = true;
    api.get("/documents", { params: { workspaceId } })
      .then(res => {
        if (!mounted) return;
        setDocs(res.data.documents || res.data || []);
      })
      .catch(err => {
        console.error("NewPage: could not load docs for parent list", err);
        setDocs([]);
      });
    return () => (mounted = false);
  }, [workspaceId]);

  const flattenForSelect = (items) => {
    // convert flat -> tree then produce indented options (reuse simple map logic)
    const map = {};
    items.forEach(i => (map[i._id] = { ...i, children: [] }));
    const roots = [];
    items.forEach(i => {
      if (i.parent && map[i.parent]) map[i.parent].children.push(map[i._id]);
      else roots.push(map[i._id]);
    });

    const res = [];
    const walk = (nodes, level = 0) => {
      nodes.forEach(n => {
        res.push({ _id: n._id, title: n.title || "Untitled", level });
        if (n.children && n.children.length) walk(n.children, level + 1);
      });
    };
    walk(roots);
    return res;
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }
    setLoading(true);
    try {
      const tagsArr = (tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const resp = await api.post(`/documents/workspace/${workspaceId}`, {
        title: title.trim(),
        content: "# New Page",
        parent: parent || null,
        tags: tagsArr
      });
      const docId = resp.data.document?._id || resp.data._id || resp.data.document;
      if (!docId) {
        alert("Created but unexpected response. Check console.");
        console.log("create resp:", resp);
        setLoading(false);
        return;
      }
      // navigate to editor
      nav(`/documents/${docId}`);
    } catch (err) {
      console.error("NewPage create error:", err);
      alert(err?.response?.data?.message || "Could not create page");
    } finally {
      setLoading(false);
    }
  };

  const options = flattenForSelect(docs || []);

  return (
    <div className="container mt-4">
      <div className="card p-3">
        <h5>Create new page</h5>
        <form onSubmit={onCreate}>
          <div className="mb-2">
            <label className="form-label">Title</label>
            <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" required />
          </div>

          <div className="mb-2">
            <label className="form-label">Tags (comma separated)</label>
            <input className="form-control" value={tags} onChange={e => setTags(e.target.value)} placeholder="intro,getting-started" />
          </div>

          <div className="mb-2">
            <label className="form-label">Parent (optional)</label>
            <select className="form-select" value={parent} onChange={e => setParent(e.target.value)}>
              <option value="">— none —</option>
              {options.map(o => (
                <option key={o._id} value={o._id}>
                  {Array(o.level).fill("\u00A0\u00A0").join("")}{o.level ? "└ " : ""}{o.title}
                </option>
              ))}
            </select>
          </div>

          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-light me-2" onClick={() => nav(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
