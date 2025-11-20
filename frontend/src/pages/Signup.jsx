import React, { useState } from "react";
import api from "../services/api";
import { setTokens } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roles: ["Viewer"],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await api.post("/auth/register", form);
      const { accessToken, refreshToken, user } = resp.data;
      setTokens(accessToken, refreshToken, user);
      nav("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  return (
    <>
      <style>{`
        .sg-page {
          min-height: 100vh;
          background: #020617;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #eaf4ff;
          font-family: Inter, sans-serif;
        }

        .sg-card {
          width: 100%;
          max-width: 960px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 14px;
          display: flex;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
          animation: pop 380ms ease;
        }

        @keyframes pop {
          from { transform: scale(.96) translateY(6px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }

        .sg-left { flex: 1.3; padding: 28px; }
        .sg-right {
          width: 330px;
          background: rgba(10,12,20,0.9);
          border-left: 1px solid rgba(255,255,255,0.04);
          padding: 26px;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .sg-logo {
          width: 58px; height: 58px; border-radius: 12px;
          background: linear-gradient(135deg,#6366f1,#0ea5e9);
          display:flex; align-items:center; justify-content:center;
          font-size:22px; font-weight:800; color:#fff;
          margin-bottom:12px;
        }

        .sg-title { font-size:22px; font-weight:700; }
        .sg-sub { color: rgba(220,230,255,0.65); font-size:13px; margin-top:4px; }

        .sg-input {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          color: #eaf4ff;
          border-radius: 10px;
          padding: 12px 14px;
        }
        .sg-input::placeholder { color: rgba(220,230,255,0.35); }

        .sg-btn {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          color: #021024;
          background: linear-gradient(90deg,#4b84ff,#63b8ff);
          box-shadow: 0 10px 30px rgba(75,132,255,0.12);
        }

        .sg-muted { color: rgba(225,235,255,0.65); }

        .oauth-btn {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          display:flex; align-items:center; justify-content:center;
          gap:10px; color:#fff; font-weight:600;
        }

        .feature-box {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          padding: 8px 10px;
          border-radius: 10px;
          margin-bottom: 8px;
          display:flex; align-items:center; gap:10px;
        }

        .dot { width:10px; height:10px; border-radius:50%; background:#4b84ff; }

        @media(max-width:780px) {
          .sg-card { flex-direction: column; max-width: 420px; }
          .sg-right { width:100%; border-left:none; border-top:1px solid rgba(255,255,255,0.05); }
        }
      `}</style>

      <div className="sg-page">
        <div className="sg-card">
          {/* LEFT FORM */}
          <div className="sg-left">
            <div className="sg-logo">A</div>
            <div className="sg-title">Create your account</div>
            <div className="sg-sub">Quick signup. Secure access</div>

            <form onSubmit={submit} className="mt-3">
              <label className="form-label sg-muted">Full name</label>
              <input
                className="form-control sg-input mb-3"
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Your full name"
              />

              <label className="form-label sg-muted">Email</label>
              <input
                className="form-control sg-input mb-3"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@company.com"
                required
              />

              <label className="form-label sg-muted">Password</label>
              <input
                className="form-control sg-input mb-3"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                placeholder="Create password"
                required
              />

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <button className="sg-btn" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </button>
            </form>

            <div className="text-center mt-3">
              <p className="sg-muted">
                Already have an account?{" "}
                <a href="/" className="text-info text-decoration-underline">
                  Sign in
                </a>
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="sg-right">
            <div style={{ width: "100%", maxWidth: "240px" }}>
              <p className="sg-muted text-center mb-3">Sign up with social</p>

              {/* Social buttons group (Bootstrap-only styling) */}
              <div className="d-grid gap-2">
                <a
                  href={`${import.meta.env.VITE_API_URL}/auth/google`}
                  className="btn btn-outline-light d-flex align-items-center justify-content-center gap-2 rounded-pill w-100 py-2"
                  role="button"
                  aria-label="Continue with Google"
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Google "G" — colored path for recognizability */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden
                    focusable="false"
                  >
                    <path
                      fill="#EA4335"
                      d="M12 11.5v2.8h4.6c-.2 1.2-1.6 3.6-4.6 3.6-2.8 0-5-2.4-5-5.3s2.2-5.3 5-5.3c1.6 0 2.6.7 3.2 1.3l1.8-1.8C16.5 5.3 14.5 4.4 12 4.4 7.8 4.4 4.5 7.9 4.5 12s3.3 7.6 7.5 7.6c4.3 0 7.1-3 7.1-7.2 0-.5 0-.8-.1-1.1H12z"
                    />
                  </svg>
                  <span className="fw-semibold">Continue with Google</span>
                </a>

                <a
                  href={`${import.meta.env.VITE_API_URL}/auth/github`}
                  className="btn btn-outline-light d-flex align-items-center justify-content-center gap-2 rounded-pill w-100 py-2"
                  role="button"
                  aria-label="Continue with GitHub"
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Github mark (white) */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden
                    focusable="false"
                  >
                    <path
                      fill="#ffffff"
                      d="M12 .5C5.7.5.9 5.3.9 11.6c0 4.7 3 8.7 7.2 10.1.5.1.7-.2.7-.5v-1.9c-2.9.6-3.5-1.1-3.5-1.1-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 1.9 0 2.2 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.9 0 3.2C8.5 21.7 6 20.1 6 17.2c0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.4 0 0 1-.3 3.3 1.2.9-.3 1.9-.5 2.9-.5 1 0 2 .2 2.9.5 2.3-1.6 3.3-1.2 3.3-1.2.6 1.8.2 3.1.1 3.4.8.8 1.2 1.9 1.2 3.2 0 2.9-2.5 4.5-7 5 0 0 .4.3.7 1.3v1.9c0 .3.2.6.7.5 4.2-1.4 7.2-5.4 7.2-10.1C23.1 5.3 18.3.5 12 .5z"
                    ></path>
                  </svg>
                  <span className="fw-semibold">Continue with GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
