import { useState } from "react";
import { runDocumentAI } from "../services/document.service";

const MODES = [
  { key: "summary", label: "Summary" },
  { key: "grammar", label: "Fix Grammar" },
  { key: "improve", label: "Improve Writing" },
  { key: "actions", label: "Action Points" },
];

export default function DocumentAI({ documentId }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const runAI = async () => {
    if (!documentId) return;
    setLoading(true);
    setResult("");

    try {
      const res = await runDocumentAI({ documentId, mode });
      setResult(res?.data?.result || "No response from AI");
    } catch {
      setResult("AI failed to respond");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toolbar button (UPDATED STYLE ONLY) */}
      <button
        className="btn btn-sm btn-primary ms-2"
        onClick={() => setOpen(true)}
      >
        Ask AI
      </button>

      {/* Modal */}
      {open && (
        <div className="wp-sx-modal-backdrop">
          <div className="wp-sx-modal-wrap">
            <div className="wp-sx-modal-card">
              {/* close */}
              <button
                className="wp-sx-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>

              {/* header */}
              <div className="wp-sx-header">
                <h3 className="wp-sx-title">AI Assistant</h3>
              </div>

              {/* form */}
              <div className="wp-sx-form">
                <div className="wp-sx-field">
                  <select
                    className="wp-sx-input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {MODES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="wp-sx-btn wp-sx-primary"
                  onClick={runAI}
                  disabled={loading}
                >
                  {loading ? "Running AI..." : "Run AI"}
                </button>

                {result && (
                  <div
                    className="card"
                    style={{
                      maxHeight: 260,
                      overflow: "auto",
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {result}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
