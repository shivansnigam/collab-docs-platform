import React from "react";
import { Link } from "react-router-dom";
import { getUser, clearTokens } from "../services/auth.service";

export default function NavBar({ onLoginClick }) {
  const user = getUser();

  const logout = () => {
    clearTokens();
    window.location.href = "/"; 
  };

  return (
    <>
      <style>{`
        .nb-root {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          padding: 14px 0;
          position: sticky;
          top: 0;
          z-index: 3000;
          animation: nb-fade 0.35s ease forwards;
        }

        @keyframes nb-fade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0px); }
        }

        .nb-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 92%;
          max-width: 1180px;
          margin: auto;
        }

        .nb-brand {
          font-size: 24px;
          font-weight: 800;
          text-decoration: none;
          background: linear-gradient(90deg,#60a5fa,#38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nb-user {
          color: #e2e8f0;
          font-size: 15px;
          margin-right: 16px;
        }

        .nb-btn {
          padding: 6px 16px;
          font-size: 14px;
          border-radius: 10px;
          border: 1px solid #ef4444;
          color: #ffb4b4;
          background: transparent;
          transition: all .2s ease;
          font-weight: 600;
        }

        .nb-btn:hover {
          background: rgba(255,76,76,0.14);
          color: #fff;
        }

      `}</style>

      <div className="nb-root">
        <div className="nb-container">

          

          {/* Right section */}
          <div className="d-flex align-items-center">
            {user ? (
              <>
                <span className="nb-user">Hi, {user.name || user.email}</span>
                
              </>
            ) : (
              <>
                {/* No buttons here because login modal opens automatically */}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
