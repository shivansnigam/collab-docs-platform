// src/pages/DocumentEditor.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
// safe imports for tiptap extensions
import * as PlaceholderModule from "@tiptap/extension-placeholder";
import * as LinkModule from "@tiptap/extension-link";
import * as TaskListModule from "@tiptap/extension-task-list";
import * as TaskItemModule from "@tiptap/extension-task-item";
// image extension (default import recommended)
import ImageExtension from "@tiptap/extension-image";

import { marked } from "marked";
import TurndownService from "turndown";
import debounce from "lodash.debounce";

import { connectSocket, getSocket } from "../services/realtime.service";
import PresenceBar from "../components/PresenceBar";

import useUpload from "../hooks/useUpload";
import { getSignedUrl as apiGetSignedUrl } from "../services/upload.service"; // ensure this exists

/* set marked options (keeps image HTML consistent) */
marked.setOptions({
  gfm: true,
  breaks: true,
});

/* resolve exports safely */
const Placeholder = PlaceholderModule.default || PlaceholderModule.Placeholder || PlaceholderModule;
const LinkExtension = LinkModule.default || LinkModule.Link || LinkModule;
const TaskList = TaskListModule.default || TaskListModule.TaskList || TaskListModule;
const TaskItem = TaskItemModule.default || TaskItemModule.TaskItem || TaskItemModule;

/* small UI helper */
function ToolbarButton({ title, onClick, active, children }) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-secondary" : "btn-light"} me-1`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ padding: "6px 8px", minWidth: 36 }}
    >
      {children}
    </button>
  );
}

/* sanit */
function sanitizeHtml(html) {
  if (!html) return "";
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

const getLocalUser = () => {
  try { return JSON.parse(localStorage.getItem("app_user") || "null"); } catch { return null; }
};

/* --- turndown setup --- */
const turndownService = new TurndownService();
/* keep div so wrapper cards are preserved as raw HTML */
try { turndownService.keep(['div']); } catch (e) { /* ignore */ }

/* replace img nodes with full HTML tag (preserve attributes incl data-file-id, class) */
try {
  turndownService.addRule("img", {
    filter: "img",
    replacement: function (content, node) {
      const src = node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "";
      const cls = node.getAttribute("class") || "";
      const title = node.getAttribute("title") || "";
      const dataFileId = node.getAttribute("data-file-id");
      const dataAttr = dataFileId ? ` data-file-id="${dataFileId}"` : "";
      const classAttr = cls ? ` class="${cls}"` : "";
      const titleAttr = title ? ` title="${title}"` : "";
      // store as raw HTML so attributes survive round-trip
      return `<img src="${src}" alt="${alt}"${classAttr}${titleAttr}${dataAttr} />`;
    }
  });
} catch (e) {
  // ignore if rule can't be added
}

export default function DocumentEditor() {
  const { id } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("split");

  const fileInputRef = useRef(null);
  const { uploading, progress, error: uploadError, uploadFile } = useUpload();

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [presence, setPresence] = useState([]);
  const remoteCursorsRef = useRef({});

  const socketRef = useRef(null);
  const lowLevelSocketRef = useRef(null);

  const autosaveTimer = useRef(null);
  const lastSavedMarkdown = useRef("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: true }),
      LinkExtension.configure ? LinkExtension.configure({ openOnClick: false }) : LinkExtension,
      Placeholder.configure ? Placeholder.configure({ placeholder: "Start typing..." }) : Placeholder,
      TaskList,
      TaskItem,
      ImageExtension,
    ].filter(Boolean),
    content: "<p></p>",
  });

  const editorHtmlToMarkdown = useCallback(() => {
    if (!editor) return "";
    const html = editor.getHTML();
    return turndownService.turndown(html);
  }, [editor]);

  const syncEditorToMarkdown = useCallback(() => {
    if (!editor) return "";
    const md = editorHtmlToMarkdown();
    setMarkdown(md);
    return md;
  }, [editorHtmlToMarkdown]);

  /* utility: replace <img data-file-id="..."> in given html with fresh presigned GET URLs */
  const resolveFileIdsInHtml = useCallback(async (html) => {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const docNode = parser.parseFromString(html, "text/html");
      const imgs = Array.from(docNode.querySelectorAll("img[data-file-id]"));
      if (!imgs.length) return html;

      await Promise.all(imgs.map(async (img) => {
        try {
          const fid = img.getAttribute("data-file-id");
          if (!fid) return;
          const resp = await apiGetSignedUrl(fid);
          if (resp && resp.url) {
            img.setAttribute("src", resp.url);
            // ensure responsive classes
            const cls = img.getAttribute("class") || "";
            const want = "card-img-top img-fluid rounded";
            if (!cls.includes("img-fluid")) img.setAttribute("class", `${cls} ${want}`.trim());
          }
        } catch (e) {
          // ignore per-image error
        }
      }));

      return docNode.body.innerHTML;
    } catch (e) {
      return html;
    }
  }, []);

  /* helper to ensure editor DOM images are wrapped in .card and have classes
     also optionally set data-file-id attribute on matched img elements */
  const styleInsertedImageInEditor = useCallback((url, fileId) => {
    try {
      const root = editor?.view?.dom;
      if (!root) return;
      const imgs = root.querySelectorAll(`img[src="${url}"]`);
      imgs.forEach((img) => {
        img.classList.add("img-fluid", "rounded", "card-img-top");
        if (fileId) img.setAttribute("data-file-id", fileId);
        img.style.display = "block";
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        // if image already inside a card, skip
        if (!img.closest(".card")) {
          const wrapper = document.createElement("div");
          wrapper.className = "card mb-3";
          const inner = document.createElement("div");
          inner.className = "card-body p-0";
          const parent = img.parentNode;
          parent.replaceChild(wrapper, img);
          inner.appendChild(img);
          wrapper.appendChild(inner);
        }
      });
    } catch (e) {
      // ignore
    }
  }, [editor]);

  /* collect images HTML from current editor DOM (used to preserve images when deleting all) */
  const collectEditorImagesHtml = useCallback(() => {
    try {
      const root = editor?.view?.dom;
      if (!root) return [];
      const imgs = Array.from(root.querySelectorAll("img"));
      return imgs.map(img => {
        const cls = img.getAttribute("class") || "";
        const want = "card-img-top img-fluid rounded";
        const clsFinal = cls.includes("img-fluid") ? cls : `${cls} ${want}`.trim();
        const src = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "";
        const title = img.getAttribute("title") || "";
        const dataFileId = img.getAttribute("data-file-id");
        const dataAttr = dataFileId ? ` data-file-id="${dataFileId}"` : "";
        return `<div class="card mb-3"><div class="card-body p-0"><img src="${src}" alt="${alt}" title="${title}" class="${clsFinal}"${dataAttr} style="display:block;max-width:100%;height:auto;" /></div></div>`;
      });
    } catch (e) {
      return [];
    }
  }, [editor]);

  /* ensure only one trailing empty paragraph exists after manipulations (DOM-level cleanup) */
  const normalizeTrailingParagraphsInEditor = useCallback(() => {
    try {
      const root = editor?.view?.dom;
      if (!root) return;
      // get direct child paragraphs (top-level editable blocks)
      const children = Array.from(root.children);
      const paragraphs = children.filter(ch => ch.tagName && ch.tagName.toLowerCase() === 'p');
      if (paragraphs.length <= 1) return;
      // keep only last empty paragraph; remove earlier empty ones
      for (let i = 0; i < paragraphs.length - 1; i++) {
        const p = paragraphs[i];
        // if paragraph is empty (only <br> or whitespace), remove it
        const text = p.innerText || "";
        const hasNodes = p.querySelectorAll('*').length > 0;
        if (text.trim() === "" && !hasNodes) {
          p.remove();
        }
      }
    } catch (e) {}
  }, [editor]);

  /* NEW: ensure caret/typing area is visible (prefer near top) when user types */
  const ensureCaretVisibleAtTop = useCallback(() => {
    try {
      if (!editor) return;
      const sel = editor.state.selection;
      const pos = sel && sel.from ? sel.from : null;
      if (pos === null) return;

      // domAtPos may return a text node; get element
      const at = editor.view.domAtPos(pos);
      let node = at && at.node ? at.node : null;
      if (!node) return;
      const el = node.nodeType === 3 ? node.parentElement : node;

      // find nearest scrollable ancestor (the editor container with overflow)
      let scrollParent = el;
      while (scrollParent && scrollParent !== document.body) {
        const style = window.getComputedStyle(scrollParent);
        const overflowY = style.overflowY;
        if (overflowY === "auto" || overflowY === "scroll") break;
        scrollParent = scrollParent.parentElement;
      }
      if (!scrollParent || scrollParent === document.body) {
        // fallback: use editor root container (EditorContent wrapper)
        scrollParent = editor.view.dom.parentElement || document.body;
      }

      // compute offset and scroll so that caret element is shown near top (12px padding)
      const elRect = el.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect ? scrollParent.getBoundingClientRect() : { top: 0 };
      const offsetTop = elRect.top - parentRect.top;
      // target: bring caret's element to be near top (12px)
      const desired = Math.max(0, scrollParent.scrollTop + offsetTop - 12);
      scrollParent.scrollTop = desired;
    } catch (e) {
      // fail silently
    }
  }, [editor]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const resp = await api.get(`/documents/${id}`);
        const document = resp.data.document || resp.data;
        if (!mounted) return;
        setDoc(document);
        setTitle(document.title || "");
        const md = document.content || "";
        setMarkdown(md);
        lastSavedMarkdown.current = md;
        // convert markdown -> html (marked), then replace any data-file-id imgs with fresh signed urls
        const html0 = marked(md || "");
        const resolved = await resolveFileIdsInHtml(html0);
        if (editor) editor.commands.setContent(resolved);
        else setTimeout(() => editor?.commands?.setContent(resolved), 50);
        // after setContent, ensure editor DOM has card wrappers and normalize paragraphs
        setTimeout(() => {
          try {
            const root = editor?.view?.dom;
            if (root) {
              const imgs = Array.from(root.querySelectorAll("img"));
              imgs.forEach(img => {
                const src = img.getAttribute("src") || "";
                styleInsertedImageInEditor(src);
              });
              normalizeTrailingParagraphsInEditor();
            }
          } catch (e) {}
        }, 150);
      } catch (err) {
        console.error("Could not load document", err);
        alert(err?.response?.data?.message || "Could not load document");
        nav(-1);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line
  }, [id, editor, resolveFileIdsInHtml, styleInsertedImageInEditor, normalizeTrailingParagraphsInEditor, nav]);

  const doSave = useCallback(
    async (showToast = true) => {
      if (!doc || !editor) return;
      const md = editorHtmlToMarkdown();
      if (md === lastSavedMarkdown.current && title === (doc.title || "")) return;
      setSaving(true);
      try {
        const resp = await api.put(`/documents/${id}`, { title, content: md });
        setDoc(resp.data.document || resp.data);
        lastSavedMarkdown.current = md;
        setMarkdown(md);
        if (showToast) console.info("Saved");
      } catch (err) {
        console.error("Save failed", err);
        alert(err?.response?.data?.message || "Could not save document");
      } finally {
        setSaving(false);
      }
    },
    [doc, editor, id, title, editorHtmlToMarkdown]
  );

  useEffect(() => {
    if (!doc || !editor) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(false), 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [editor, markdown, title, doSave, doc]);

  const getToken = () => localStorage.getItem("app_access_token");

  const emitDocUpdate = (md) => {
    const sock = socketRef.current;
    if (sock && typeof sock.sendDocUpdate === "function") {
      sock.sendDocUpdate({ docId: id, delta: { snapshot: md }, version: 1 });
      return;
    }
    const low = lowLevelSocketRef.current;
    if (low && low.connected) low.emit("doc:update", { docId: id, delta: { snapshot: md }, version: 1 });
  };
  const emitDocUpdateDebounced = useRef(debounce((md) => emitDocUpdate(md), 400)).current;

  const emitCursor = () => {
    try {
      const sel = editor.state.selection;
      const from = sel?.from ?? 0;
      const to = sel?.to ?? 0;
      const sock = socketRef.current;
      if (sock && typeof sock.sendCursorUpdate === "function") {
        sock.sendCursorUpdate({ docId: id, selection: { from, to } });
      } else {
        const low = lowLevelSocketRef.current;
        if (low && low.connected) low.emit("cursor:update", { docId: id, selection: { from, to } });
      }
    } catch (e) { }
  };

  const emitTyping = (isTyping) => {
    const user = getLocalUser();
    const sockWrapper = socketRef.current;
    const low = lowLevelSocketRef.current;
    const payload = {
      docId: id,
      isTyping: !!isTyping,
      userId: user?._id || user?.id || undefined,
      name: user?.name || user?.email || undefined,
      socketId: (low && low.id) || (sockWrapper && sockWrapper.id) || undefined,
    };

    if (sockWrapper && typeof sockWrapper.sendTyping === "function") {
      try { sockWrapper.sendTyping(payload); } catch (e) { }
      return;
    }
    if (low && low.connected) {
      try { low.emit("typing", payload); } catch (e) { }
    }
  };
  const typingStopDebouncedRef = useRef(debounce(() => emitTyping(false), 1200));

  const onDocUpdate = (payload) => {
    if (!payload) return;
    const { delta } = payload;
    if (!delta) return;
    if (delta.snapshot !== undefined) {
      const md = delta.snapshot;
      (async () => {
        const html0 = marked(md || "");
        // resolve any file ids to fresh signed urls before applying
        const resolved = await resolveFileIdsInHtml(html0);
        try {
          const currentHtml = editor.getHTML();
          if (currentHtml !== resolved) {
            editor.commands.setContent(resolved, false);
            setMarkdown(md);
            lastSavedMarkdown.current = md;
            // style editor images + normalize paragraphs
            setTimeout(() => {
              try {
                const root = editor?.view?.dom;
                if (root) {
                  const imgs = Array.from(root.querySelectorAll("img"));
                  imgs.forEach(img => {
                    const src = img.getAttribute("src") || "";
                    styleInsertedImageInEditor(src);
                  });
                  normalizeTrailingParagraphsInEditor();
                }
              } catch (e) {}
            }, 120);
          }
        } catch (e) {
          setMarkdown(md);
        }
      })();
    }
  };

  const onPresence = (p) => {
    const norm = Array.isArray(p) ? p.map(u => ({
      socketId: u.socketId,
      userId: u.userId,
      name: u.name || u.user?.name || u.userId,
      selection: u.selection || null,
      isTyping: !!u.isTyping,
    })) : [];
    setPresence(norm);
  };

  const onCursor = (payload) => {
    if (!payload) return;
    const { user, selection } = payload;
    if (user && (user.id || user.userId)) {
      const uid = user.id || user.userId;
      remoteCursorsRef.current[uid] = selection || null;
    }
    setPresence((prev) => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      const idx = copy.findIndex((x) => (x.userId || x.id) === (user.id || user.userId) || x.socketId === user.socketId);
      const entry = {
        socketId: user.socketId,
        userId: user.id || user.userId,
        name: user.name || (user.user && user.user.name) || undefined,
        selection,
        isTyping: copy[idx]?.isTyping || false
      };
      if (idx >= 0) copy[idx] = { ...copy[idx], ...entry };
      else copy.push(entry);
      return copy;
    });
  };

  const onPresenceTyping = (payload) => {
    try {
      let incomingUser = null;
      let isTyping = !!payload?.isTyping;

      if (payload?.user) {
        incomingUser = payload.user;
      } else if (payload?.userId || payload?.socketId || payload?.name) {
        incomingUser = {
          id: payload.userId || payload._id,
          userId: payload.userId || payload._id,
          socketId: payload.socketId,
          name: payload.name
        };
      } else return;

      const uid = incomingUser.id || incomingUser.userId || incomingUser._id || incomingUser.socketId;
      const name = incomingUser.name || (incomingUser.user && incomingUser.user.name) || String(uid || "User");

      setPresence(prev => {
        const copy = Array.isArray(prev) ? [...prev] : [];
        const idx = copy.findIndex(x => x.userId === uid || x.socketId === incomingUser.socketId || x.userId === incomingUser.userId);
        if (idx >= 0) {
          copy[idx] = {
            ...copy[idx],
            socketId: incomingUser.socketId || copy[idx].socketId,
            userId: uid || copy[idx].userId,
            name: name || copy[idx].name,
            isTyping: isTyping
          };
        } else {
          copy.push({
            socketId: incomingUser.socketId,
            userId: uid,
            name,
            selection: null,
            isTyping
          });
        }
        return copy;
      });
    } catch (e) {
      console.warn("onPresenceTyping error", e);
    }
  };

  useEffect(() => {
    if (!doc) return;
    const token = getToken();
    if (!token) return;

    try {
      const wrapper = connectSocket({
        token,
        onConnect: () => {},
        onInit: (data) => {
          if (data?.snapshot !== undefined) {
            const md = data.snapshot;
            (async () => {
              const html0 = marked(md || "");
              const resolved = await resolveFileIdsInHtml(html0);
              try { editor.commands.setContent(resolved, false); } catch (e) {}
              setMarkdown(md);
              lastSavedMarkdown.current = md;
            })();
          }
        },
        onDocUpdate: onDocUpdate,
        onPresence: onPresence,
        onCursor: onCursor,
        onTyping: onPresenceTyping
      });
      socketRef.current = wrapper;
    } catch (e) {
      socketRef.current = null;
    }

    try {
      const low = getSocket();
      lowLevelSocketRef.current = low;

      if (!low) {
        console.warn("low-level socket not available from getSocket()");
      } else {
        if (!low.connected) low.connect();

        // Debug: show exactly what we're sending
        console.log("JOIN-emit", {
          docId: id,
          workspaceId: doc?.workspace?._id || doc?.workspace
        });

        // send workspaceId as either doc.workspace._id (preferred) or doc.workspace (fallback)
        low.emit("join", { token, docId: id, workspaceId: doc?.workspace?._id || doc?.workspace });

        const onInitRaw = (data) => {
          if (data?.snapshot !== undefined) {
            const md = data.snapshot;
            (async () => {
              const html0 = marked(md || "");
              const resolved = await resolveFileIdsInHtml(html0);
              try { editor.commands.setContent(resolved, false); } catch (e) {}
              setMarkdown(md);
              lastSavedMarkdown.current = md;
            })();
          }
        };
        const onDocUpdateRaw = (payload) => onDocUpdate(payload);
        const onPresenceRaw = (p) => onPresence(p);
        const onCursorRaw = (c) => onCursor(c);
        const onTypingRaw = (t) => onPresenceTyping(t);

        low.on("init", onInitRaw);
        low.on("doc:update", onDocUpdateRaw);
        low.on("presence:update", onPresenceRaw);
        low.on("cursor:update", onCursorRaw);
        low.on("presence:typing", onTypingRaw);
        low.on("typing", onTypingRaw);

        if (socketRef.current && typeof socketRef.current.joinDoc === "function") {
          // wrapper helper — include workspaceId here too
          socketRef.current.joinDoc({ token, docId: id, workspaceId: doc?.workspace?._id || doc?.workspace });
        }

        // add beforeunload to try sending leave when tab/window closes
        const handleBeforeUnload = () => {
          try { low.emit("leave", { docId: id, workspaceId: doc?.workspace?._id || doc?.workspace }); } catch (e) {}
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        // CLEANUP: when component unmounts, explicitly tell server we leave with workspaceId
        return () => {
          try {
            if (socketRef.current && typeof socketRef.current.leaveDoc === "function") socketRef.current.leaveDoc(id);
          } catch (e) {}
          try {
            // include workspaceId so server can decrement activeUsersCount
            if (low && low.connected) low.emit("leave", { docId: id, workspaceId: doc?.workspace?._id || doc?.workspace });

            low.off("init", onInitRaw);
            low.off("doc:update", onDocUpdateRaw);
            low.off("presence:update", onPresenceRaw);
            low.off("cursor:update", onCursorRaw);
            low.off("presence:typing", onTypingRaw);
            low.off("typing", onTypingRaw);
          } catch (e) {}
          window.removeEventListener("beforeunload", handleBeforeUnload);
        };
      }
    } catch (e) {
      if (socketRef.current && typeof socketRef.current.joinDoc === "function") {
        // fallback include workspaceId as well
        socketRef.current.joinDoc({ token, docId: id, workspaceId: doc?.workspace?._id || doc?.workspace });
        return () => { try { socketRef.current.leaveDoc(id); } catch (e) {} };
      }
      return () => {};
    }
    // eslint-disable-next-line
  }, [doc, id, editor, resolveFileIdsInHtml]);

  const onClickUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const workspaceId = doc?.workspace?._id || doc?.workspace || null;

    const documentId = id || null;

    try {
      const { file: fileDoc, url } = await uploadFile(f, { workspaceId, documentId });

      const safeAlt = (fileDoc?.originalName || f.name || "image").replace(/"/g, "");
      const fileId = fileDoc?._id || fileDoc?.id || "";

      if (editor && editor.chain) {
        try {
          // setImage with data-file-id attribute so saved content references stable id (not expiring URL)
          // note: some tiptap image extensions ignore unknown attrs; we still set them manually below
          editor.chain().focus().setImage({
            src: url,
            alt: safeAlt,
            title: safeAlt,
            "data-file-id": fileId
          }).run();
        } catch (e) {
          // fallback: insert HTML with data-file-id attribute and bootstrap classes
          editor.chain().focus().insertContent(
            `<div class="card mb-3"><div class="card-body p-0"><img src="${url}" alt="${safeAlt}" data-file-id="${fileId}" class="card-img-top img-fluid rounded" style="display:block;width:100%;height:auto;" /></div></div>`
          ).run();
        }

        // ensure inserted img has attributes + wrapper and normalize paragraphs
        setTimeout(() => {
          styleInsertedImageInEditor(url, fileId);
          normalizeTrailingParagraphsInEditor();

          // set cursor after image (so typing position is after the image and editor stays visually where expected)
          try {
            // set cursor to end of document (safe fallback)
            const docSize = editor.state.doc.content.size;
            editor.chain().focus().setTextSelection(docSize).run();
          } catch (e) { /* ignore if API mismatch */ }
        }, 80);

        // sync to markdown shortly after insertion (use longer delay to allow DOM patch)
        setTimeout(async () => {
          const md = editorHtmlToMarkdown();
          setMarkdown(md);
          // persist so server keeps data-file-id in DB content (doSave will set lastSavedMarkdown on success)
          try {
            await doSave(true);
          } catch (e) {
            console.warn("Immediate save after image insert failed", e);
          }
        }, 260);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert(err?.response?.data?.message || err?.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* editor update handler with safeguards:
     - keep images if accidental select-all + delete attempted
     - normalize trailing paragraphs to avoid duplicate empty inputs
     - ensure caret visible at top when typing
  */
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const md = editorHtmlToMarkdown();

      // safeguard: if previously saved markdown had images but new md lost them (e.g. select-all delete),
      // restore previous content (so images don't vanish)
      const prevImgCount = (lastSavedMarkdown.current.match(/<img\b/gi) || []).length;
      const newImgCount = (md.match(/<img\b/gi) || []).length;
      if (prevImgCount > 0 && newImgCount < prevImgCount) {
        // restore previous saved content (so we don't accidentally remove images)
        try {
          const html = marked(lastSavedMarkdown.current || "");
          editor.commands.setContent(html, false);
          // re-style images & normalize paragraphs
          setTimeout(() => {
            try {
              const root = editor?.view?.dom;
              if (root) {
                const imgs = Array.from(root.querySelectorAll("img"));
                imgs.forEach(img => {
                  const src = img.getAttribute("src") || "";
                  styleInsertedImageInEditor(src);
                });
                normalizeTrailingParagraphsInEditor();
              }
            } catch (e) {}
          }, 120);
        } catch (e) {}
        return;
      }

      setMarkdown(md);
      // small DOM normalization so multiple empty paragraphs don't pile up
      normalizeTrailingParagraphsInEditor();

      emitDocUpdateDebounced(md);
      emitCursor();
      emitTyping(true);
      typingStopDebouncedRef.current();

      // --- NEW: ensure caret / typing area is visible towards top after update ---
      // call this after a tiny timeout so DOM updates are applied
      setTimeout(() => {
        ensureCaretVisibleAtTop();
      }, 8);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
    // eslint-disable-next-line
  }, [editor, editorHtmlToMarkdown, styleInsertedImageInEditor, normalizeTrailingParagraphsInEditor, ensureCaretVisibleAtTop]);

  const toggleBold = () => editor && editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor && editor.chain().focus().toggleItalic().run();
  const toggleCode = () => editor && editor.chain().focus().toggleCode().run();
  const setH1 = () => editor && editor.chain().focus().toggleHeading({ level: 1 }).run();
  const setH2 = () => editor && editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleQuote = () => editor && editor.chain().focus().toggleBlockquote().run();
  const toggleTask = () => editor && editor.chain().focus().toggleTaskList().run();

  const insertCodeBlock = () => editor && editor.chain().focus().toggleCodeBlock().run();
  const insertLink = () => {
    const url = window.prompt("Enter URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setTimeout(syncEditorToMarkdown, 0);
  };

  /* previewHtml: sanitized + transformed already (wrapping handled via ReactMarkdown component below) */
  const previewHtml = useMemo(() => {
    const raw = marked(markdown || "");
    // ensure any raw HTML is sanitized of scripts
    return sanitizeHtml(raw);
  }, [markdown]);

  const openPreviewInNewWindow = () => {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.title = title || "Preview";
    const css = `
      body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial;line-height:1.6;padding:32px;background:#f6f7f9;color:#0b1220;}
      .preview-card{max-width:780px;margin:24px auto;padding:28px;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(12,20,40,0.12);}
      img{max-width:100%;height:auto;display:block;}
      .card{border-radius:10px;overflow:hidden;}
      .card-body{padding:0;}
      @media (max-width: 768px) { .preview-card{padding:18px} }
    `;
    win.document.head.innerHTML = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"><style>${css}</style>`;
    (async () => {
      const resolved = await resolveFileIdsInHtml(previewHtml);
      win.document.body.innerHTML = `<div class="preview-card">${resolved}</div>`;
    })();
    const btn = win.document.createElement("button");
    btn.textContent = "Print";
    btn.style.position = "fixed";
    btn.style.top = "12px";
    btn.style.right = "12px";
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "6px";
    btn.onclick = () => win.print();
    win.document.body.appendChild(btn);
  };

  const openPreviewModal = () => setShowPreviewModal(true);

  if (loading) return (<div className="container mt-4 text-center"><div className="spinner-border" /></div>);

  return (
    <div className="container mt-4">
      {/* header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div style={{ flex: 1 }} className="me-3">
          <input className="form-control form-control-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" style={{ fontWeight: 700 }} />
          <div className="text-muted small mt-1">Workspace: {doc?.workspace?.name || ""}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <PresenceBar presence={presence} />
          <div className="d-flex align-items-center mt-2 mt-md-0">
            <div className="me-2">
              <div className="btn-group" role="group" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setMode(mode === "split" ? "editor" : "split")} type="button">
                  {mode === "split" ? "Split" : mode === "editor" ? "Editor" : "Preview"}
                </button>
                <button className={`btn btn-sm ${saving ? "btn-secondary" : "btn-primary"}`} onClick={() => doSave(true)} disabled={saving} type="button">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="btn btn-outline-primary btn-sm" onClick={() => nav(`/documents/${id}/versions`)}>Versions</button>
              </div>
            </div>
            <div className="ms-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={openPreviewModal} title="Open preview">Open preview</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
        <div className="d-flex flex-wrap">
          <ToolbarButton title="Bold (Ctrl/Cmd+B)" onClick={toggleBold} active={editor?.isActive("bold")}>
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton title="Italic (Ctrl/Cmd+I)" onClick={toggleItalic} active={editor?.isActive("italic")}>
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton title="Inline code" onClick={toggleCode}><code>{`</>`}</code></ToolbarButton>
          <ToolbarButton title="Heading 1" onClick={setH1} active={editor?.isActive("heading", { level: 1 })}>H1</ToolbarButton>
          <ToolbarButton title="Heading 2" onClick={setH2} active={editor?.isActive("heading", { level: 2 })}>H2</ToolbarButton>
          <ToolbarButton title="Quote" onClick={toggleQuote} active={editor?.isActive("blockquote")}>“</ToolbarButton>
          <ToolbarButton title="Task list" onClick={toggleTask}>☑</ToolbarButton>
          <ToolbarButton title="Code block" onClick={insertCodeBlock}>{'</>'}</ToolbarButton>
          <ToolbarButton title="Link" onClick={insertLink}>🔗</ToolbarButton>

          <ToolbarButton title="Upload image/file" onClick={onClickUpload}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </ToolbarButton>
        </div>

        <div className="ms-auto text-muted small">Autosave: 2s after changes</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={onFileChange}
      />

      {uploading && (
        <div className="mb-2">
          <div className="progress" style={{ height: 8 }}>
            <div className="progress-bar" role="progressbar" style={{ width: `${progress}%` }} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </div>
      )}

      {uploadError && <div className="alert alert-danger">Upload error: {uploadError}</div>}

      {mode === "split" ? (
        <div className="row gx-3">
          <div className="col-md-6 mb-3">
            <div className="card h-100">
              <div className="card-body d-flex flex-column p-2" style={{ minHeight: 420 }}>
                <small className="text-muted mb-2">Editor</small>
                <div className="flex-grow-1 overflow-auto" style={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 6 }}>
                  {editor ? <EditorContent editor={editor} /> : <div className="p-3">Loading editor...</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 mb-3">
            <div className="card h-100">
              <div className="card-body p-3" style={{ minHeight: 420, overflow: "auto" }}>
                <div className="d-flex justify-content-between mb-2">
                  <small className="text-muted">Preview</small>
                  <div>
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={openPreviewModal}>Open preview</button>
                  </div>
                </div>

                <div className="doc-preview-box" style={{ maxHeight: 520, overflow: "auto" }}>
                  {/* ReactMarkdown with raw HTML enabled so saved <img> HTML is parsed */}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
                    components={{
                      img: ({node, ...props}) => (
                        <div className="card mb-3">
                          <div className="card-body p-0">
                            <img className="card-img-top img-fluid rounded" {...props} alt={props.alt} />
                          </div>
                        </div>
                      )
                    }}
                  >
                    {markdown || "# Preview"}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : mode === "editor" ? (
        <div className="card mb-3"><div className="card-body">{editor ? <EditorContent editor={editor} /> : null}</div></div>
      ) : (
        <div className="card mb-3"><div className="card-body"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ img: ({node, ...props}) => (<div className="card mb-3"><div className="card-body p-0"><img className="card-img-top img-fluid rounded" {...props} alt={props.alt} /></div></div>) }}>{markdown || "# Preview"}</ReactMarkdown></div></div>
      )}

      {showPreviewModal && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(6,10,20,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onMouseDown={() => setShowPreviewModal(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, background: "#0f1724", borderRadius: 10, padding: 18, boxShadow: "0 20px 60px rgba(3,6,23,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: "#cbd5e1" }}>
                <strong style={{ fontSize: 16 }}>Preview</strong>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{title || "Untitled"}</div>
              </div>

              <div>
                <button className="btn btn-sm btn-outline-light me-2" onClick={() => window.print()}>Print</button>
                <button className="btn btn-sm btn-light" onClick={() => setShowPreviewModal(false)}>Close</button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 8, padding: 28, maxHeight: "70vh", overflow: "auto", marginBottom: 8 }}>
              {/* inject a tiny style so images inside modal are constrained and responsive */}
              <div style={{ maxWidth: 780, margin: "0 auto", fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,Arial", lineHeight: 1.6, color: "#0b1220" }}
                   dangerouslySetInnerHTML={{ __html: `<style>img{max-width:100%;height:auto;display:block}.card{border-radius:10px;overflow:hidden}.card-body{padding:0}</style>${previewHtml}` }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, color: "#9aaac3" }}>
              <small>Rendered HTML sanitized (script tags removed)</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
