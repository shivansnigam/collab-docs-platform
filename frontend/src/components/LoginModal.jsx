import React, { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { setTokens } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

export default function LoginModal({ show, onClose }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const modalRef = useRef();

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";

    if (show) {
      setTimeout(() => {
        modalRef.current?.querySelector("input[name='email']")?.focus();
      }, 100);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (show) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  const submit = async (e) => {
    e && e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await api.post("/auth/login", form);
      const { accessToken, refreshToken, user } = resp.data;
      setTokens(accessToken, refreshToken, user);
      setLoading(false);
      onClose?.();
      nav("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
      setLoading(false);
    }
  };

  const onChange = (e) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const openOAuth = (provider) => {
    const url = `${import.meta.env.VITE_API_URL}/auth/${provider}`;
    window.location.href = url;
  };

  if (!show) return null;

  return (
    <>
      {/* Inline component-scoped styles — paste this whole file, no external CSS needed */}
      <style>{`
        /* Modal root + backdrop */
        .cm-modal-root { position: fixed; inset: 0; z-index: 2000; display: block; }
        .cm-backdrop {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, rgba(2,6,23,0.72), rgba(2,6,23,0.84));
          backdrop-filter: blur(6px) saturate(120%);
          -webkit-backdrop-filter: blur(6px) saturate(120%);
          transition: opacity 260ms ease;
        }

        /* Modal container */
        .cm-modal {
          position: absolute;
          left: 50%;
          top: 50%;
          transform-style: preserve-3d;
          transform: translate(-50%, -50%) rotateX(6deg) scale(0.98);
          width: 92%;
          max-width: 980px;
          display: flex;
          border-radius: 14px;
          overflow: hidden;
          z-index: 2010;
          will-change: transform, opacity;
          animation: cm-popup 420ms cubic-bezier(.2,.9,.2,1) both;
          box-shadow: 0 30px 80px rgba(2,6,23,0.8), 0 6px 20px rgba(13,110,253,0.06);
        }

        @keyframes cm-popup {
          0% { transform: translate(-50%, -48%) rotateX(8deg) scale(0.96); opacity: 0; }
          60% { transform: translate(-50%, -50%) rotateX(-1deg) scale(1.02); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotateX(0deg) scale(1); opacity: 1; }
        }

        /* Left & right panes */
        .cm-left {
          flex: 1.2;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          padding: 26px;
          color: #eaf4ff;
        }
        .cm-right {
          width: 340px;
          background: linear-gradient(180deg, rgba(10,14,22,0.92), rgba(7,10,18,0.95));
          border-left: 1px solid rgba(255,255,255,0.03);
          padding: 28px;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        /* Brand row */
        .cm-brand { display:flex; gap:14px; align-items:center; margin-bottom:6px; }
        .cm-logo {
          width:62px; height:62px; border-radius:12px;
          display:inline-flex; align-items:center; justify-content:center;
          background: linear-gradient(135deg,#7c3aed,#0ea5e9);
          box-shadow: 0 10px 36px rgba(46,120,255,0.12);
          font-weight:800; font-size:20px; color:#fff;
        }
        .cm-title { font-size:20px; font-weight:700; margin:0; color:#f3faff; }

        .cm-sub { color: rgba(226,237,255,0.7); font-size:13px; margin-top:4px; }

        /* Inputs - bigger, clearer */
        .cm-form .form-label { color: rgba(225,235,255,0.8); font-weight:600; font-size:14px; }
        .cm-input {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.04);
          color: #eaf4ff;
          padding: 12px 14px;
          border-radius: 10px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
          font-size: 15px;
        }
        .cm-input::placeholder { color: rgba(230,240,255,0.35); }

        /* Primary button */
        .cm-primary {
          width:100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: none;
          font-weight:700;
          background: linear-gradient(90deg,#4b84ff,#63b8ff);
          color: #02102a;
          box-shadow: 0 10px 30px rgba(75,132,255,0.12);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .cm-primary:active { transform: translateY(1px); }
        .cm-primary[disabled] { opacity:0.7; cursor:not-allowed; }

        /* OAuth buttons */
        .cm-oauth { width:100%; padding: 10px 12px; border-radius: 10px; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:600; }
        .cm-google { border: 1px solid rgba(255,255,255,0.04); background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); color: #fff; }
        .cm-github { border: 1px solid rgba(255,255,255,0.04); background: transparent; color: #fff; }

        /* small text, muted */
        .cm-muted { color: rgba(230,240,255,0.55); font-size:13px; }

        /* right inner */
        .cm-right-inner { width:100%; max-width:240px; text-align:center; }

        /* close button */
        .cm-close {
          position:absolute; right:12px; top:12px; z-index: 2020;
          background: rgba(255,255,255,0.03); border:none; color:#eaf4ff; font-size:18px; padding:8px 10px; border-radius:10px;
          transition: background 120ms ease;
        }
        .cm-close:hover { background: rgba(255,255,255,0.06); cursor:pointer; }

        /* alert */
        .cm-alert { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,60,60,0.12); color: #ffdfe0; padding:.55rem .8rem; border-radius:8px; }

        /* responsive */
        @media (max-width: 780px) {
          .cm-modal { width: 96%; max-width: 420px; transform: translate(-50%,-50%) scale(.995); }
          .cm-modal { flex-direction: column; border-radius: 12px; }
          .cm-right { width:100%; border-left: none; border-top:1px solid rgba(255,255,255,0.03); padding:18px; }
          .cm-left { padding:18px; }
          .cm-logo { width:48px; height:48px; font-size:18px; }
        }
      `}</style>

      <div className="cm-modal-root" aria-hidden={!show}>
        <div
          className="cm-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        />

        <div
          className="cm-modal"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="login dialog"
        >
          {/* LEFT: form */}
          <div className="cm-left">
            <div className="cm-brand">
              <div className="cm-logo">A</div>
              <div>
                <h3 className="cm-title">Welcome back</h3>
                <div className="cm-sub">
                  Sign in to continue — secure access
                </div>
              </div>
            </div>

            <form className="cm-form mt-3" onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  name="email"
                  type="email"
                  className="form-control cm-input"
                  value={form.email}
                  onChange={onChange}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label d-flex justify-content-between">
                  <span>Password</span>
                  <a className="cm-muted" href="/forgot">
                    Forgot?
                  </a>
                </label>
                <input
                  name="password"
                  type="password"
                  className="form-control cm-input"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && <div className="cm-alert mb-3">{error}</div>}

              <button className="cm-primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="text-center mt-3">
              <p className="mb-0">
                New here?{" "}
                <a
                  href="/signup"
                  className="btn btn-sm btn-outline-info ms-2 px-3 py-1"
                  role="button"
                >
                  Create an account
                </a>
              </p>
            </div>
          </div>

          {/* RIGHT: oauth + info */}
          <div className="cm-right">
            <div className="cm-right-inner">
              <p className="cm-muted mb-3">Quick sign-in</p>

              <button
                className="cm-oauth cm-google mb-2"
                onClick={() => openOAuth("google")}
                aria-label="Continue with Google"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="me-2"
                  viewBox="0 0 16 16"
                  aria-hidden
                >
                  <path d="M8.159 7.37v1.02H12.4c-.2 1.08-1.06 2.85-4.24 2.85-2.56 0-4.64-2.11-4.64-4.72 0-2.61 2.08-4.72 4.64-4.72 1.45 0 2.42.62 2.98 1.15l.7-.7C11.01 1.78 9.66 1.2 8.15 1.2 4.55 1.2 1.84 3.98 1.84 7.44c0 3.46 2.71 6.24 6.31 6.24 3.64 0 6.02-2.56 6.02-6.16 0-.41-.04-.72-.1-1.08H8.159z" />
                </svg>
                Continue with Google
              </button>

              <button
                className="cm-oauth cm-github"
                onClick={() => openOAuth("github")}
                aria-label="Continue with GitHub"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="me-2"
                  viewBox="0 0 16 16"
                  aria-hidden
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.2 1.87.86 2.33.66.07-.52.28-.86.51-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.63 7.63 0 018 4.7c.68.003 1.36.092 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Continue with GitHub
              </button>
            </div>
          </div>

          <button className="cm-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
