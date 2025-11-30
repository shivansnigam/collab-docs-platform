// src/pages/LandingPage.jsx
import React, { useEffect, useRef } from "react";

export default function LandingPage({ onAutoShow }) {
  const timerRef = useRef();

  useEffect(() => {
    // 60 seconds ke baad login modal auto open karna
    timerRef.current = setTimeout(() => onAutoShow?.(), 60000);
    return () => clearTimeout(timerRef.current);
  }, [onAutoShow]);

  return (
    <>
      <style>{`
        :root{
          --bg:#071027;
          --card: rgba(255,255,255,0.03);
          --muted: rgba(215,230,255,0.65);
          --accent-1: #4b84ff;
          --accent-2: #63b8ff;
          --glass: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        }

        .lp-root{
          min-height: 80vh;
          padding: 56px 20px;
          background: radial-gradient(1200px 600px at 10% 10%, rgba(30,60,120,0.14), transparent),
                      radial-gradient(900px 450px at 95% 90%, rgba(80,40,120,0.06), transparent),
                      var(--bg);
          color: #eaf4ff;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .lp-grid{
          width: 100%;
          max-width: 1200px;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 32px;
          align-items: center;
        }

        /* HERO */
        .hero-title{
          font-size: clamp(28px, 4.2vw, 44px);
          line-height: 1.02;
          margin:0 0 14px 0;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #f7fbff;
        }
        .hero-sub{
          color: var(--muted);
          font-size: clamp(14px, 1.4vw, 17px);
          margin-bottom: 20px;
          max-width: 68ch;
        }

        .lp-badges{
          display:flex;
          gap:10px;
          margin-top:18px;
          flex-wrap:wrap;
        }
        .badge{
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.03);
          padding:8px 12px;
          border-radius: 999px;
          font-weight:600;
          font-size:13px;
          color:#dff0ff;
        }

        .cta-row{ display:flex; gap:12px; margin-top:22px; flex-wrap:wrap; }
        .btn-primary{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:12px 18px;
          border-radius:12px;
          background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
          color:#02102a;
          font-weight:800;
          border:none;
          cursor:pointer;
          text-decoration:none;
          box-shadow: 0 12px 40px rgba(75,132,255,0.12);
          transform: translateZ(0);
        }
        .btn-outline{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:12px 18px;
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.06);
          color: var(--muted);
          background: transparent;
          text-decoration:none;
        }

        /* PREVIEW CARD */
        .card{
          background: var(--glass);
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.03);
          padding: 20px;
          box-shadow: 0 12px 36px rgba(2,6,23,0.6);
        }
        .card h3{ margin:0 0 8px 0; font-size:18px; color:#f3faff }
        .muted{ color: var(--muted); font-size:13px; }

        .doc-row{
          display:flex;
          gap:10px;
          margin-top:12px;
        }
        .doc-item{
          flex:1;
          background: rgba(255,255,255,0.02);
          padding:12px;
          border-radius:8px;
          font-size:14px;
        }

        /* ILLUSTRATION SIMULATED */
        .mock-hero{
          margin-top:18px;
          width:100%;
          height:220px;
          border-radius:10px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          display:flex;
          gap:12px;
          padding:12px;
          align-items:flex-start;
        }
        .mock-column{
          flex:1;
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .mock-line{
          height:12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border-radius:6px;
        }
        .mock-line.short{ width:45%; }
        .mock-line.mid{ width:70%; }
        .mock-line.long{ width:95%; height:18px; }

        /* RESPONSIVE */
        @media (max-width: 980px){
          .lp-grid{ grid-template-columns: 1fr; padding: 0 8px; }
          .card{ order: -1; margin-bottom: 8px; }
        }

        /* subtle entrance */
        .fade-up{ animation: fadeUp 640ms cubic-bezier(.2,.9,.2,1) both; }
        .stagger-1{ animation-delay: 80ms; }
        .stagger-2{ animation-delay: 160ms; }
        @keyframes fadeUp{
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        /* focus styles */
        .btn-primary:focus, .btn-outline:focus { outline: 3px solid rgba(99,184,255,0.18); outline-offset: 4px; }
      `}</style>

      <div className="lp-root">
        <div className="lp-grid">
          {/* LEFT: HERO */}
          <div>
            <div className="fade-up stagger-1">
              <h1 className="hero-title">Realtime collaborative documents for teams</h1>
              <p className="hero-sub">
                Rapidly create workspaces, edit together live, share files and track versions. Built secure, designed for productivity.
              </p>

              <div className="lp-badges">
                <div className="badge">Live edits & presence</div>
                <div className="badge">Role based access</div>
                <div className="badge">Version history</div>
                <div className="badge">File uploads</div>
              </div>

              <div className="cta-row" style={{ marginTop: 20 }}>
                <button className="btn-primary" onClick={() => onAutoShow?.()}>
                  Sign in · Try demo
                </button>

                <a className="btn-outline" href="/signup">Create account</a>
              </div>

              <p style={{ marginTop: 16, color: "rgba(220,230,255,0.6)" }}>
                Tip: Login modal will open automatically after 60 seconds on this page.
              </p>
            </div>

            {/* FEATURES quick */}
            <div style={{ display:"grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 22 }} className="fade-up stagger-2">
              <div style={{ background: "transparent", padding: 12 }}>
                <strong>Realtime edits</strong><div className="muted">Low latency syncing with CRDT/OT support</div>
              </div>
              <div style={{ background: "transparent", padding: 12 }}>
                <strong>Permissions</strong><div className="muted">Admin, Editor, Viewer roles</div>
              </div>
              <div style={{ background: "transparent", padding: 12 }}>
                <strong>File uploads</strong><div className="muted">Images, PDFs via signed URLs</div>
              </div>
              <div style={{ background: "transparent", padding: 12 }}>
                <strong>Analytics</strong><div className="muted">Active users, edits, uploads</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview card */}
          <div className="card fade-up">
            <h3>Live demo preview</h3>
            <div className="muted">Open a workspace, create a page and see realtime updates.</div>

            <div className="doc-row" style={{ marginTop: 14 }}>
              <div className="doc-item">
                <strong>Workspace</strong><br />
                <small className="muted">Team Alpha</small>
              </div>
              <div className="doc-item">
                <strong>Document</strong><br />
                <small className="muted">Project plan</small>
              </div>
            </div>

            <div className="mock-hero" aria-hidden style={{ marginTop: 16 }}>
              <div className="mock-column">
                <div className="mock-line long" />
                <div className="mock-line mid" />
                <div className="mock-line short" />
                <div style={{ flex:1 }} />
                <div className="mock-line mid" />
              </div>

              <div className="mock-column" style={{ maxWidth: 160 }}>
                <div className="mock-line short" />
                <div className="mock-line mid" />
                <div className="mock-line short" />
                <div style={{ height: 10 }} />
                <div className="mock-line mid" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onAutoShow?.()} className="btn-primary" style={{ flex:1 }}>
                Open login
              </button>
              <a className="btn-outline" href="/workspaces" style={{ alignSelf:"center", padding:"10px 12px" }}>
                Explore
              </a>
            </div>

            <div style={{ marginTop: 12, color: "rgba(170,190,220,0.7)", fontSize: 12 }}>
              <small>Secure by default • GDPR friendly • Production ready</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}