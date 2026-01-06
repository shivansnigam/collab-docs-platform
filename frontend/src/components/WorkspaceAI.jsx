import { useState } from "react";
import { runWorkspaceAI } from "../services/analytics.service";

export default function WorkspaceAI({ workspaceId }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const askAI = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult("");

    try {
      const res = await runWorkspaceAI({
        workspaceId,
        question,
      });
      setResult(res.result);
    } catch {
      setResult("AI failed to respond");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-outline-primary"
        onClick={() => setOpen(true)}
      >
        Ask Workspace AI
      </button>

      {open && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center">
          <div className="bg-white p-3 rounded" style={{ width: 600 }}>
            <div className="d-flex justify-content-between mb-2">
              <strong>Workspace AI</strong>
              <button
                className="btn btn-sm btn-light"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <textarea
              className="form-control mb-2"
              rows={3}
              placeholder="Ask something about this workspace..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <button
              className="btn btn-primary w-100 mb-2"
              onClick={askAI}
              disabled={loading}
            >
              {loading ? "Thinking..." : "Ask AI"}
            </button>

            {result && (
              <pre
                className="border rounded p-2 small"
                style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}
              >
                {result}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
