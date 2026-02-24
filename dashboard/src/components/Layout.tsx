import { useEffect } from "react";
import { Link, Outlet, useMatch, useNavigate } from "react-router-dom";

import { clearToken } from "../api/client";
import { DirtyStateProvider } from "../context/DirtyStateContext";
import AppSidebar from "./AppSidebar";

function decodeEmail(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || payload.email || "";
  } catch {
    return "";
  }
}

export default function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isAppRoute = useMatch("/apps/:appId/*");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    function handleAuthExpired() {
      clearToken();
      navigate("/login");
    }
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, [navigate]);

  if (!token) return null;

  const email = decodeEmail(token);

  return (
    <DirtyStateProvider>
      <div className="min-h-screen bg-canvas">
        <nav
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-md border-b border-border"
          style={{ height: "var(--nav-height)" }}
        >
          <Link to="/apps" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-xs leading-none">
                IA
              </span>
            </div>
            <span className="font-display font-semibold text-strong text-sm tracking-tight">
              Playbook
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {email && (
              <span className="text-xs text-subtle hidden sm:block font-mono">
                {email}
              </span>
            )}
            <button
              onClick={() => {
                clearToken();
                navigate("/login");
              }}
              className="text-xs text-subtle hover:text-body transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-border-2"
            >
              Sign out
            </button>
          </div>
        </nav>

        <div
          className="max-w-5xl mx-auto px-4 md:px-6 flex gap-8"
          style={{
            paddingTop: "calc(var(--nav-height) + 2rem)",
            paddingBottom: "2rem",
          }}
        >
          {isAppRoute && <AppSidebar />}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </DirtyStateProvider>
  );
}
