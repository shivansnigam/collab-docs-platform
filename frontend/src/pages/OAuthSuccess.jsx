import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setTokens } from "../services/auth.service";
import api from "../services/api";

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();

  useEffect(() => {
    const handleOAuth = async () => {
      const access = searchParams.get("access");
      const refresh = searchParams.get("refresh");

      if (!access || !refresh) {
        nav("/", { replace: true });
        return;
      }

      try {
        // Step 1: store tokens temporarily
        setTokens(access, refresh, null);

        // Step 2: fetch user profile
        const resp = await api.get("/protected/profile");
        const user = resp.data.user;

        // Step 3: save tokens + user in storage correctly
        setTokens(access, refresh, user);

        // Step 4: navbar ko update karne ke liye event
        window.dispatchEvent(new Event("authChanged"));

        // Step 5: dashboard redirect
        nav("/dashboard", { replace: true });

      } catch (err) {
        console.error("OAuth profile fetch failed:", err);
        nav("/", { replace: true });
      }
    };

    handleOAuth();
  }, []);

  return (
    <div className="text-center mt-5">
      <div className="spinner-border" role="status" />
      <p className="mt-3">Signing you in...</p>
    </div>
  );
}
