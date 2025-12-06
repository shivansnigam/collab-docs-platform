// src/pages/DocumentEditor.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as PlaceholderModule from "@tiptap/extension-placeholder";
import * as LinkModule from "@tiptap/extension-link";
import * as TaskListModule from "@tiptap/extension-task-list";
import * as TaskItemModule from "@tiptap/extension-task-item";
import ImageExtension from "@tiptap/extension-image";
import { marked } from "marked";
import TurndownService from "turndown";
import debounce from "lodash.debounce";
import { connectSocket, getSocket } from "../services/realtime.service";
import PresenceBar from "../components/PresenceBar";
import useUpload from "../hooks/useUpload";
// import { getSignedUrl as apiGetSignedUrl } from "../services/upload.service";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const Placeholder =
  PlaceholderModule.default ||
  PlaceholderModule.Placeholder ||
  PlaceholderModule;
const LinkExtension = LinkModule.default || LinkModule.Link || LinkModule;
const TaskList =
  TaskListModule.default || TaskListModule.TaskList || TaskListModule;
const TaskItem =
  TaskItemModule.default || TaskItemModule.TaskItem || TaskItemModule;

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const buildFileUrl = (fileId) => {
  if (!fileId) return "";

  return `${API_BASE}/uploads/file/${fileId}`;
};

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

function sanitizeHtml(html) {
  if (!html) return "";
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

const getLocalUser = () => {
  try {
    return JSON.parse(localStorage.getItem("app_user") || "null");
  } catch {
    return null;
  }
};

const turndownService = new TurndownService();
try {
  turndownService.keep(["div"]);
} catch (e) {}

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
      return `<img src="${src}" alt="${alt}"${classAttr}${titleAttr}${dataAttr} />`;
    },
  });
} catch (e) {}

export default function DocumentEditor() {
  const { id } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("split");

  // comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);

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
      LinkExtension.configure
        ? LinkExtension.configure({ openOnClick: false })
        : LinkExtension,
      Placeholder.configure
        ? Placeholder.configure({ placeholder: "Start typing..." })
        : Placeholder,
      TaskList,
      TaskItem,
      ImageExtension,
    ].filter(Boolean),
    content: "<p></p>",
  });

  // helper: workspace id
  const getWorkspaceId = () => {
    return doc?.workspace?._id || doc?.workspace || null;
  };

  // comments list load
  const loadComments = async () => {
    try {
      const wsId = getWorkspaceId();
      if (!wsId || !id) return;

      setCommentsLoading(true);
      const res = await api.get(`/comments/${id}`, {
        params: { workspaceId: wsId },
      });
      setComments(res.data?.comments || []);
    } catch (e) {
      console.error("loadComments error", e?.response?.data || e.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  // add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const wsId = getWorkspaceId();
      if (!wsId || !id) {
        alert("Workspace ya document id missing");
        return;
      }

      setCommentPosting(true);
      const res = await api.post(`/comments/${id}?workspaceId=${wsId}`, {
        text: newComment.trim(),
      });

      setComments((prev) => [...prev, res.data.comment]);
      setNewComment("");
    } catch (e) {
      console.error("addComment error", e?.response?.data || e.message);
      alert(e?.response?.data?.message || "Comment add nahi ho paya");
    } finally {
      setCommentPosting(false);
    }
  };

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

  const resolveFileIdsInHtml = useCallback(async (html) => {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const docNode = parser.parseFromString(html, "text/html");
      const imgs = Array.from(docNode.querySelectorAll("img"));
      if (!imgs.length) return html;

      imgs.forEach((img) => {
        try {
          let fid = img.getAttribute("data-file-id");
          const src = img.getAttribute("src") || "";

          if (!fid && src.startsWith("FILEID://")) {
            fid = src.substring("FILEID://".length);
            img.setAttribute("data-file-id", fid);
          }

          if (!fid) return;

          const fileUrl = buildFileUrl(fid);
          img.setAttribute("src", fileUrl);

          const cls = img.getAttribute("class") || "";
          const want = "card-img-top img-fluid rounded";
          if (!cls.includes("img-fluid"))
            img.setAttribute("class", `${cls} ${want}`.trim());
        } catch (e) {}
      });

      return docNode.body.innerHTML;
    } catch (e) {
      return html;
    }
  }, []);

  const styleInsertedImageInEditor = useCallback(
    (url, fileId) => {
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
      } catch (e) {}
    },
    [editor]
  );

  const collectEditorImagesHtml = useCallback(() => {
    try {
      const root = editor?.view?.dom;
      if (!root) return [];
      const imgs = Array.from(root.querySelectorAll("img"));
      return imgs.map((img) => {
        const cls = img.getAttribute("class") || "";
        const want = "card-img-top img-fluid rounded";
        const clsFinal = cls.includes("img-fluid")
          ? cls
          : `${cls} ${want}`.trim();
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

  const normalizeTrailingParagraphsInEditor = useCallback(() => {
    try {
      const root = editor?.view?.dom;
      if (!root) return;
      const children = Array.from(root.children);
      const paragraphs = children.filter(
        (ch) => ch.tagName && ch.tagName.toLowerCase() === "p"
      );
      if (paragraphs.length <= 1) return;
      for (let i = 0; i < paragraphs.length - 1; i++) {
        const p = paragraphs[i];
        const text = p.innerText || "";
        const hasNodes = p.querySelectorAll("*").length > 0;
        if (text.trim() === "" && !hasNodes) {
          p.remove();
        }
      }
    } catch (e) {}
  }, [editor]);

  const ensureCaretVisibleAtTop = useCallback(() => {
    try {
      if (!editor) return;
      const sel = editor.state.selection;
      const pos = sel && sel.from ? sel.from : null;
      if (pos === null) return;

      const at = editor.view.domAtPos(pos);
      let node = at && at.node ? at.node : null;
      if (!node) return;
      const el = node.nodeType === 3 ? node.parentElement : node;

      let scrollParent = el;
      while (scrollParent && scrollParent !== document.body) {
        const style = window.getComputedStyle(scrollParent);
        const overflowY = style.overflowY;
        if (overflowY === "auto" || overflowY === "scroll") break;
        scrollParent = scrollParent.parentElement;
      }
      if (!scrollParent || scrollParent === document.body) {
        scrollParent = editor.view.dom.parentElement || document.body;
      }

      const elRect = el.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect
        ? scrollParent.getBoundingClientRect()
        : { top: 0 };
      const offsetTop = elRect.top - parentRect.top;
      const desired = Math.max(0, scrollParent.scrollTop + offsetTop - 12);
      scrollParent.scrollTop = desired;
    } catch (e) {}
  }, [editor]);

  // doc load
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
        const html0 = marked(md || "");
        const resolved = await resolveFileIdsInHtml(html0);
        if (editor) editor.commands.setContent(resolved);
        else setTimeout(() => editor?.commands?.setContent(resolved), 50);
        setTimeout(() => {
          try {
            const root = editor?.view?.dom;
            if (root) {
              const imgs = Array.from(root.querySelectorAll("img"));
              imgs.forEach((img) => {
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
    return () => {
      mounted = false;
    };
  }, [
    id,
    editor,
    resolveFileIdsInHtml,
    styleInsertedImageInEditor,
    normalizeTrailingParagraphsInEditor,
    nav,
  ]);

  useEffect(() => {
    if (doc && doc._id) {
      loadComments();
    }
  }, [doc]);

  // auto refresh comments
  // useEffect(() => {
  //   if (!doc || !doc._id || !id) return;

  //   const interval = setInterval(() => {
  //     loadComments();
  //   }, 3000);

  //   return () => clearInterval(interval);
  // }, [doc, id]);

  const doSave = useCallback(
    async (showToast = true) => {
      if (!doc || !editor) return;

      const md = editorHtmlToMarkdown();

      if (md === lastSavedMarkdown.current && title === (doc.title || ""))
        return;

      setSaving(true);
      try {
        const resp = await api.put(`/documents/${id}`, {
          title,
          content: md,
        });

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

  // autosave
  useEffect(() => {
    if (!doc || !editor) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(false), 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [editor, markdown, title, doSave, doc]);

  const getToken = () => localStorage.getItem("app_access_token");

  const emitDocUpdate = (md) => {
    const sock = socketRef.current;
    if (sock && typeof sock.sendDocUpdate === "function") {
      sock.sendDocUpdate({
        docId: id,
        delta: { snapshot: md },
        version: 1,
      });
      return;
    }
    const low = lowLevelSocketRef.current;
    if (low && low.connected)
      low.emit("doc:update", {
        docId: id,
        delta: { snapshot: md },
        version: 1,
      });
  };
  const emitDocUpdateDebounced = useRef(
    debounce((md) => emitDocUpdate(md), 400)
  ).current;

  const emitCursor = () => {
    try {
      const sel = editor.state.selection;
      const from = sel?.from ?? 0;
      const to = sel?.to ?? 0;
      const sock = socketRef.current;
      if (sock && typeof sock.sendCursorUpdate === "function") {
        sock.sendCursorUpdate({
          docId: id,
          selection: { from, to },
        });
      } else {
        const low = lowLevelSocketRef.current;
        if (low && low.connected)
          low.emit("cursor:update", {
            docId: id,
            selection: { from, to },
          });
      }
    } catch (e) {}
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
      try {
        sockWrapper.sendTyping(payload);
      } catch (e) {}
      return;
    }
    if (low && low.connected) {
      try {
        low.emit("typing", payload);
      } catch (e) {}
    }
  };
  const typingStopDebouncedRef = useRef(
    debounce(() => emitTyping(false), 1200)
  );

  const onDocUpdate = (payload) => {
    if (!payload) return;
    const { delta } = payload;
    if (!delta) return;
    if (delta.snapshot !== undefined) {
      const md = delta.snapshot;
      (async () => {
        const html0 = marked(md || "");
        const resolved = await resolveFileIdsInHtml(html0);
        try {
          const currentHtml = editor.getHTML();
          if (currentHtml !== resolved) {
            editor.commands.setContent(resolved, false);
            setMarkdown(md);
            lastSavedMarkdown.current = md;
            setTimeout(() => {
              try {
                const root = editor?.view?.dom;
                if (root) {
                  const imgs = Array.from(root.querySelectorAll("img"));
                  imgs.forEach((img) => {
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
    const norm = Array.isArray(p)
      ? p.map((u) => ({
          socketId: u.socketId,
          userId: u.userId,
          name: u.name || u.user?.name || u.userId,
          selection: u.selection || null,
          isTyping: !!u.isTyping,
        }))
      : [];
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
      const idx = copy.findIndex(
        (x) =>
          (x.userId || x.id) === (user.id || user.userId) ||
          x.socketId === user.socketId
      );
      const entry = {
        socketId: user.socketId,
        userId: user.id || user.userId,
        name: user.name || (user.user && user.user.name) || undefined,
        selection,
        isTyping: copy[idx]?.isTyping || false,
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
          name: payload.name,
        };
      } else return;

      const uid =
        incomingUser.id ||
        incomingUser.userId ||
        incomingUser._id ||
        incomingUser.socketId;
      const name =
        incomingUser.name ||
        (incomingUser.user && incomingUser.user.name) ||
        String(uid || "User");

      setPresence((prev) => {
        const copy = Array.isArray(prev) ? [...prev] : [];
        const idx = copy.findIndex(
          (x) =>
            x.userId === uid ||
            x.socketId === incomingUser.socketId ||
            x.userId === incomingUser.userId
        );
        if (idx >= 0) {
          copy[idx] = {
            ...copy[idx],
            socketId: incomingUser.socketId || copy[idx].socketId,
            userId: uid || copy[idx].userId,
            name: name || copy[idx].name,
            isTyping: isTyping,
          };
        } else {
          copy.push({
            socketId: incomingUser.socketId,
            userId: uid,
            name,
            selection: null,
            isTyping,
          });
        }
        return copy;
      });
    } catch (e) {
      console.warn("onPresenceTyping error", e);
    }
  };

  // socket connect + join
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
              try {
                editor.commands.setContent(resolved, false);
              } catch (e) {}
              setMarkdown(md);
              lastSavedMarkdown.current = md;
            })();
          }
        },
        onDocUpdate: onDocUpdate,
        onPresence: onPresence,
        onCursor: onCursor,
        onTyping: onPresenceTyping,
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

        console.log("JOIN-emit", {
          docId: id,
          workspaceId: doc?.workspace?._id || doc?.workspace,
        });

        low.emit("join", {
          token,
          docId: id,
          workspaceId: doc?.workspace?._id || doc?.workspace,
        });

        const onInitRaw = (data) => {
          if (data?.snapshot !== undefined) {
            const md = data.snapshot;
            (async () => {
              const html0 = marked(md || "");
              const resolved = await resolveFileIdsInHtml(html0);
              try {
                editor.commands.setContent(resolved, false);
              } catch (e) {}
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

        if (
          socketRef.current &&
          typeof socketRef.current.joinDoc === "function"
        ) {
          socketRef.current.joinDoc({
            token,
            docId: id,
            workspaceId: doc?.workspace?._id || doc?.workspace,
          });
        }

        const handleBeforeUnload = () => {
          try {
            low.emit("leave", {
              docId: id,
              workspaceId: doc?.workspace?._id || doc?.workspace,
            });
          } catch (e) {}
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
          try {
            if (
              socketRef.current &&
              typeof socketRef.current.leaveDoc === "function"
            )
              socketRef.current.leaveDoc(id);
          } catch (e) {}
          try {
            if (low && low.connected)
              low.emit("leave", {
                docId: id,
                workspaceId: doc?.workspace?._id || doc?.workspace,
              });

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
      if (
        socketRef.current &&
        typeof socketRef.current.joinDoc === "function"
      ) {
        socketRef.current.joinDoc({
          token,
          docId: id,
          workspaceId: doc?.workspace?._id || doc?.workspace,
        });
        return () => {
          try {
            socketRef.current.leaveDoc(id);
          } catch (e) {}
        };
      }
      return () => {};
    }
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
      const { file: fileDoc } = await uploadFile(f, {
        workspaceId,
        documentId,
      });

      const safeAlt = (fileDoc?.originalName || f.name || "image").replace(
        /"/g,
        ""
      );
      const fileId = fileDoc?._id || fileDoc?.id || "";

      const fileUrl = buildFileUrl(fileId);

      if (editor && editor.chain) {
        try {
          editor
            .chain()
            .focus()
            .setImage({
              src: fileUrl,
              alt: safeAlt,
              title: safeAlt,
              "data-file-id": fileId,
            })
            .run();
        } catch (e) {
          editor
            .chain()
            .focus()
            .insertContent(
              `<div class="card mb-3"><div class="card-body p-0"><img src="${fileUrl}" alt="${safeAlt}" data-file-id="${fileId}" class="card-img-top img-fluid rounded" style="display:block;width:100%;height:auto;" /></div></div>`
            )
            .run();
        }

        setTimeout(() => {
          styleInsertedImageInEditor(fileUrl, fileId);
          normalizeTrailingParagraphsInEditor();

          try {
            const docSize = editor.state.doc.content.size;
            editor.chain().focus().setTextSelection(docSize).run();
          } catch (e) {}
        }, 80);

        setTimeout(async () => {
          const md = editorHtmlToMarkdown();
          setMarkdown(md);
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

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const md = editorHtmlToMarkdown();

      const prevImgCount = (lastSavedMarkdown.current.match(/<img\b/gi) || [])
        .length;
      const newImgCount = (md.match(/<img\b/gi) || []).length;
      if (prevImgCount > 0 && newImgCount < prevImgCount) {
        try {
          const html = marked(lastSavedMarkdown.current || "");
          editor.commands.setContent(html, false);
          setTimeout(() => {
            try {
              const root = editor?.view?.dom;
              if (root) {
                const imgs = Array.from(root.querySelectorAll("img"));
                imgs.forEach((img) => {
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
      normalizeTrailingParagraphsInEditor();

      emitDocUpdateDebounced(md);
      emitCursor();
      emitTyping(true);
      typingStopDebouncedRef.current();

      setTimeout(() => {
        ensureCaretVisibleAtTop();
      }, 8);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [
    editor,
    editorHtmlToMarkdown,
    styleInsertedImageInEditor,
    normalizeTrailingParagraphsInEditor,
    ensureCaretVisibleAtTop,
  ]);

  const toggleBold = () => editor && editor.chain().focus().toggleBold().run();
  const toggleItalic = () =>
    editor && editor.chain().focus().toggleItalic().run();
  const toggleCode = () => editor && editor.chain().focus().toggleCode().run();
  const setH1 = () =>
    editor && editor.chain().focus().toggleHeading({ level: 1 }).run();
  const setH2 = () =>
    editor && editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleQuote = () =>
    editor && editor.chain().focus().toggleBlockquote().run();
  const toggleTask = () =>
    editor && editor.chain().focus().toggleTaskList().run();

  const insertCodeBlock = () =>
    editor && editor.chain().focus().toggleCodeBlock().run();
  const insertLink = () => {
    const url = window.prompt("Enter URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setTimeout(syncEditorToMarkdown, 0);
  };

  const previewHtml = useMemo(() => {
    const raw = marked(markdown || "");
    return sanitizeHtml(raw);
  }, [markdown]);

  const openPreviewInNewWindow = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const css = `
    /* ------------ PRINT FIX ------------- */
@media print {
  /* hide whole app chrome */
  header,
  nav,
  .btn,
  .editor-toolbar,
  .sidebar,
  .wp-sx-actions,
  .wp-sx-modal-backdrop,
  .wp-sx-modal-wrap,
  .wp-sx-modal-card,
  .wp-sx-close {
    display: none !important;
  }

  /* main editor body should fill full page */
  .tiptap,
  .editor-content,
  .markdown-preview,
  .split-view-left,
  .split-view-right {
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    display: block !important;
  }

  /* avoid page cutoff */
  img {
    max-width: 100% !important;
    page-break-inside: avoid;
  }
}
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial;line-height:1.6;padding:32px;background:#f6f7f9;color:#0b1220;}
  .preview-card{
    max-width:780px;
    margin:24px auto;
    padding:28px;
    background:#fff;
    border-radius:8px;
    box-shadow:0 8px 30px rgba(12,20,40,0.12);
    word-break:break-word;
    white-space:normal;
  }
  img{max-width:100%;height:auto;display:block;}
  .card{border-radius:10px;overflow:hidden;}
  .card-body{padding:0;}
  #printBtn{position:fixed;top:12px;right:12px;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;}
  @media (max-width: 768px) { .preview-card{padding:18px} }
  @media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
  }

  @media print {
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .doc-rendered-content, 
  .tiptap, 
  #root {
    transform: scale(0.75) !important;
    transform-origin: top left !important;
    width: 130% !important; /* scaling compensate */
  }
}
  @media print {
  img {
    max-width: 95% !important;
    height: auto !important;
  }
}
  * {
    page-break-before: avoid !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
  }

  img {
    max-width: 100% !important;
    height: auto !important;
  }
}
`;

    const safeTitle = title || "Preview";
    const fullHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
        <style>${css}</style>
      </head>
      <body>
        
        <div class="preview-card">
          ${previewHtml}
        </div>
      </body>
    </html>
  `;

    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
  };

  const openPreviewModal = () => setShowPreviewModal(true);

  // 🔹 markdown preview ke img ke liye bhi helper (agar kabhi FILEID:// aaye)
  const normalizeImgSrc = (src) => {
    if (!src) return src;
    if (src.startsWith("FILEID://")) {
      const fid = src.substring("FILEID://".length);
      return buildFileUrl(fid);
    }
    return src;
  };

  if (loading)
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border" />
      </div>
    );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div style={{ flex: 1 }} className="me-3">
          <input
            className="form-control form-control-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            style={{ fontWeight: 700 }}
          />
          <div className="text-muted small mt-1">
            Workspace: {doc?.workspace?.name || ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <PresenceBar presence={presence} />
          <div className="d-flex align-items-center mt-2 mt-md-0">
            <div className="me-2">
              <div
                className="btn-group"
                role="group"
                style={{ flexWrap: "wrap" }}
              >
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setMode(mode === "split" ? "editor" : "split")}
                  type="button"
                >
                  {mode === "split"
                    ? "Split"
                    : mode === "editor"
                    ? "Editor"
                    : "Preview"}
                </button>
                <button
                  className={`btn btn-sm ${
                    saving ? "btn-secondary" : "btn-primary"
                  }`}
                  onClick={() => doSave(true)}
                  disabled={saving}
                  type="button"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => nav(`/documents/${id}/versions`)}
                >
                  Versions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-2 d-flex flex-wrap align-items-center"
        style={{ gap: 8 }}
      >
        <div className="d-flex flex-wrap">
          <ToolbarButton
            title="Bold (Ctrl/Cmd+B)"
            onClick={toggleBold}
            active={editor?.isActive("bold")}
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl/Cmd+I)"
            onClick={toggleItalic}
            active={editor?.isActive("italic")}
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton title="Inline code" onClick={toggleCode}>
            <code>{`</>`}</code>
          </ToolbarButton>
          <ToolbarButton
            title="Heading 1"
            onClick={setH1}
            active={editor?.isActive("heading", {
              level: 1,
            })}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            onClick={setH2}
            active={editor?.isActive("heading", {
              level: 2,
            })}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            title="Quote"
            onClick={toggleQuote}
            active={editor?.isActive("blockquote")}
          >
            “
          </ToolbarButton>
          <ToolbarButton title="Task list" onClick={toggleTask}>
            ☑
          </ToolbarButton>
          <ToolbarButton title="Code block" onClick={insertCodeBlock}>
            {"</>"}
          </ToolbarButton>
          <ToolbarButton title="Link" onClick={insertLink}>
            🔗
          </ToolbarButton>

          <ToolbarButton title="Upload image/file" onClick={onClickUpload}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 7l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 21H3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ToolbarButton>
        </div>

        <div className="ms-auto text-muted small">
          Autosave: 2s after changes
        </div>
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
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="alert alert-danger">Upload error: {uploadError}</div>
      )}

      {mode === "split" ? (
        <div className="row gx-3">
          <div className="col-md-6 mb-3">
            <div className="card h-100">
              <div
                className="card-body d-flex flex-column p-2"
                style={{ minHeight: 420 }}
              >
                <small className="text-muted mb-2">Editor</small>
                <div
                  className="flex-grow-1 overflow-auto tiptap-editor-shell"
                  style={{
                    border: "1px solid rgba(0,0,0,0.04)",
                    borderRadius: 6,
                  }}
                >
                  {editor ? (
                    <EditorContent editor={editor} />
                  ) : (
                    <div className="p-3">Loading editor...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* right preview pane */}
          <div className="col-md-6 mb-3">
            <div className="card h-100">
              <div
                className="card-body p-3"
                style={{
                  minHeight: 420,
                  overflow: "auto",
                }}
              >
                <div className="d-flex justify-content-between mb-2">
                  <small className="text-muted">Preview</small>
                  <div>
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={openPreviewModal}
                    >
                      Open preview
                    </button>
                  </div>
                </div>

                <div
                  className="doc-preview-box"
                  style={{
                    maxHeight: 520,
                    overflow: "auto",
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      img: ({ node, ...props }) => (
                        <div className="card mb-3">
                          <div className="card-body p-0">
                            <img
                              className="card-img-top img-fluid rounded"
                              {...props}
                              src={normalizeImgSrc(props.src)}
                              alt={props.alt}
                            />
                          </div>
                        </div>
                      ),
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
        <div className="card mb-3">
          <div
            className="card-body d-flex flex-column p-2"
            style={{ minHeight: 420 }}
          >
            <small className="text-muted mb-2">Editor</small>
            <div
              className="flex-grow-1 overflow-auto tiptap-editor-shell"
              style={{
                border: "1px solid rgba(0,0,0,0.04)",
                borderRadius: 6,
              }}
            >
              {editor ? (
                <EditorContent editor={editor} />
              ) : (
                <div className="p-3">Loading editor...</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // PREVIEW ONLY MODE
        <div className="card mb-3">
          <div
            className="card-body p-3"
            style={{ minHeight: 420, overflow: "auto" }}
          >
            <div className="d-flex justify-content-between mb-2">
              <small className="text-muted">Preview</small>
              <div>
                <button
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={openPreviewModal}
                >
                  Open preview
                </button>
              </div>
            </div>
            <div
              className="doc-preview-box"
              style={{ maxHeight: 520, overflow: "auto" }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({ node, ...props }) => (
                    <div className="card mb-3">
                      <div className="card-body p-0">
                        <img
                          className="card-img-top img-fluid rounded"
                          {...props}
                          src={normalizeImgSrc(props.src)}
                          alt={props.alt}
                        />
                      </div>
                    </div>
                  ),
                }}
              >
                {markdown || "# Preview"}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Comments panel */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 10,
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h5 style={{ margin: 0, color: "#e5e7eb" }}>Comments</h5>
          {commentsLoading && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</span>
          )}
        </div>

        <form onSubmit={handleAddComment} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Write a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "rgba(15,23,42,0.9)",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              disabled={commentPosting || !newComment.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: commentPosting ? "#64748b" : "#3b82f6",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: commentPosting ? "default" : "pointer",
                opacity: commentPosting ? 0.7 : 1,
              }}
            >
              {commentPosting ? "Sending…" : "Send"}
            </button>
          </div>
        </form>

        {comments.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 0 }}>
            No comments yet. Be the first one
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.map((c) => (
              <div
                key={c._id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(15,23,42,1)",
                  border: "1px solid rgba(51,65,85,0.9)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#e5e7eb" }}>
                    {c.user?.name || c.user?.email || "Someone"}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#e2e8f0" }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPreviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,10,20,0.6)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onMouseDown={() => setShowPreviewModal(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 900,
              background: "#0f1724",
              borderRadius: 10,
              padding: 18,
              boxShadow: "0 20px 60px rgba(3,6,23,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ color: "#cbd5e1" }}>
                <strong style={{ fontSize: 16 }}>Preview</strong>
                <div
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                  }}
                >
                  {title || "Untitled"}
                </div>
              </div>

              <div>
                <button
                  className="btn btn-sm btn-outline-light me-2"
                  onClick={openPreviewInNewWindow}
                >
                  Print
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowPreviewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 28,
                maxHeight: "70vh",
                overflow: "auto",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: 780,
                  margin: "0 auto",
                  fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,Arial",
                  lineHeight: 1.6,
                  color: "#0b1220",
                  wordBreak: "break-word",
                  whiteSpace: "normal",
                }}
                dangerouslySetInnerHTML={{
                  __html: `<style>img{max-width:100%;height:auto;display:block}.card{border-radius:10px;overflow:hidden}.card-body{padding:0}</style>${previewHtml}`,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                color: "#9aaac3",
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
