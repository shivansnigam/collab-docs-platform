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

    // ---------- FRONTEND VALIDATION ----------
    const trimmedName = (form.name || "").trim();
    const trimmedEmail = (form.email || "").trim();
    const password = form.password || "";

    // 1) Name: required + only letters/spaces (no numbers)
    if (!trimmedName) {
      setError("Name is required and cannot be empty.");
      return;
    }
    const nameRegex = /^[A-Za-z][A-Za-z\s]{1,48}$/;
    if (!nameRegex.test(trimmedName)) {
      setError("Please enter a valid full name (letters and spaces only).");
      return;
    }

    // 2) Email: proper regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    // 3) Password: not only spaces, at least 8 chars, at least 1 letter + 1 digit
    if (!password || password.trim().length < 8) {
      setError("Password must be at least 8 characters (not spaces only).");
      return;
    }
    const strongPass = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!strongPass.test(password)) {
      setError("Password must have at least one letter and one number.");
      return;
    }
    // ----------------------------------------

    setLoading(true);
    try {
      const payload = {
        ...form,
        name: trimmedName,
        email: trimmedEmail,
        password,
      };

      const resp = await api.post("/auth/register", payload);
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

            <form onSubmit={submit} className="mt-3" noValidate>
              <label className="form-label sg-muted">Full name</label>
              <input
                className="form-control sg-input mb-3"
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Your full name"
                required
                pattern="^[A-Za-z][A-Za-z\\s]{1,48}$"
                title="Name should contain only letters and spaces"
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
                minLength={8}
                pattern="^(?=.*[A-Za-z])(?=.*\\d).{8,}$"
                title="At least 8 characters with letters and numbers"
              />

              {error && (
                <div className="alert alert-danger py-2 mt-2">{error}</div>
              )}

              <button className="sg-btn mt-2" disabled={loading}>
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

              <div className="d-grid gap-2">
                {/* Google button */}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    aria-hidden
                    focusable="false"
                  >
                    <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.351 2.082l-2.284 2.19C10.206 3.62 9.189 3.22 8 3.22c-2.178 0-3.98 1.84-3.98 4.08 0 2.24 1.802 4.08 3.98 4.08 1.773 0 3.097-.993 3.306-2.39H8v-3.43h7.545z" />
                  </svg>
                  <span className="fw-semibold">Continue with Google</span>
                </a>

                {/* GitHub button */}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    aria-hidden
                    focusable="false"
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.39 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.9-3.64-3.98 0-.88.31-1.6.82-2.17-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82A7.56 7.56 0 0 1 8 3.47c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.57.82 1.29.82 2.17 0 3.09-1.87 3.78-3.65 3.98.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.39A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
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