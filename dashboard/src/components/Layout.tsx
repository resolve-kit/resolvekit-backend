import { useEffect } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { clearToken } from "../api/client";
import { DirtyStateProvider } from "../context/DirtyStateContext";
import { OnboardingProvider } from "../context/OnboardingContext";
import AppSidebar from "./AppSidebar";
import OnboardingGuideRail from "./OnboardingGuideRail";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <DirtyStateProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-canvas">
          <nav
            className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-md border-b border-border"
            style={{ height: "var(--nav-height)" }}
          >
            <Link to="/apps" className="flex items-center gap-2.5">
              <span className="font-display font-semibold text-strong text-sm tracking-tight">
                Playbook
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              <Link
                to="/apps"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.startsWith("/apps")
                    ? "bg-accent-subtle text-accent border border-accent-dim"
                    : "text-subtle hover:text-body border border-transparent hover:border-border"
                }`}
              >
                Apps
              </Link>
              <Link
                to="/knowledge-bases"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.startsWith("/knowledge-bases")
                    ? "bg-accent-subtle text-accent border border-accent-dim"
                    : "text-subtle hover:text-body border border-transparent hover:border-border"
                }`}
              >
                Knowledge Bases
              </Link>
              <Link
                to="/organization"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.startsWith("/organization")
                    ? "bg-accent-subtle text-accent border border-accent-dim"
                    : "text-subtle hover:text-body border border-transparent hover:border-border"
                }`}
              >
                Organization
              </Link>
            </div>
            <div className="flex items-center gap-4">
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
            className="max-w-6xl mx-auto px-4 md:px-6 flex gap-8"
            style={{
              paddingTop: "calc(var(--nav-height) + 2rem)",
              paddingBottom: "2rem",
            }}
          >
            {isAppRoute && <AppSidebar />}
            <main className="flex-1 min-w-0">
              <OnboardingGuideRail variant="mobile" />
              <Outlet />
            </main>
            <OnboardingGuideRail variant="desktop" />
          </div>
        </div>
      </OnboardingProvider>
    </DirtyStateProvider>
  );
}
