import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { api, logout } from "../api/client";
import { DirtyStateProvider } from "../context/DirtyStateContext";
import { OnboardingProvider } from "../context/OnboardingContext";
import { useKnowledgeBaseStatus } from "../hooks/useKnowledgeBaseStatus";
import AppSidebar from "./AppSidebar";
import OnboardingGuideRail from "./OnboardingGuideRail";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = useMatch("/apps/:appId/*");
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { status: kbStatus } = useKnowledgeBaseStatus();
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("rk-theme") === "console"
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "console");
      localStorage.setItem("rk-theme", "console");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("rk-theme");
    }
  }, [isDark]);

  const handleSignOut = useCallback(async () => {
    await logout();
    setIsAuthenticated(false);
    setAuthReady(true);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    api("/v1/auth/me")
      .then(() => {
        if (cancelled) return;
        setIsAuthenticated(true);
        setAuthReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        void handleSignOut();
      });

    return () => {
      cancelled = true;
    };
  }, [handleSignOut]);

  useEffect(() => {
    function handleAuthExpired() {
      void handleSignOut();
    }
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, [handleSignOut]);

  if (!authReady || !isAuthenticated) return null;

  return (
    <DirtyStateProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-canvas">
          <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
            <div className="mx-auto flex h-[var(--nav-height)] max-w-[1400px] items-center justify-between px-4 md:px-6">
              <Link to="/apps" className="inline-flex items-center gap-2.5">
                <img src={isDark ? "/brand/logo-horizontal-dark.svg" : "/brand/logo-horizontal.svg"} alt="RESOLVEkit" className="h-9 w-auto" />
                <span className="pb-[1px] text-[12px] md:text-[13px] font-semibold tracking-[0.16em] text-subtle">
                  | console
                </span>
              </Link>

              <div className="hidden items-center gap-1 md:flex">
                {["/apps", "/knowledge-bases", "/organization"].map((path) => {
                  const label =
                    path === "/apps" ? "Apps" : path === "/knowledge-bases" ? "Knowledge Bases" : "Organization";
                  const active = location.pathname.startsWith(path);
                  const kbDisabled = path === "/knowledge-bases" && !kbStatus.enabled;
                  if (kbDisabled) {
                    return (
                      <span
                        key={path}
                        title={kbStatus.detail}
                        className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-dim opacity-70"
                      >
                        {label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-accent-dim bg-accent-subtle text-accent"
                          : "border-transparent text-subtle hover:border-border hover:bg-surface-2 hover:text-body"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDark((d) => !d)}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-subtle transition-colors hover:border-border-2 hover:text-body"
                >
                  {isDark ? (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M8 12A4 4 0 1 0 8 4a4 4 0 0 0 0 8ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM8 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM0 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm13 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 13 8ZM2.697 2.697a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061L2.696 3.758a.75.75 0 0 1 0-1.061ZM11.182 11.182a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.061a.75.75 0 0 1 0-1.06ZM2.697 13.303a.75.75 0 0 1 0-1.06l1.06-1.061a.75.75 0 1 1 1.061 1.06l-1.06 1.061a.75.75 0 0 1-1.061 0ZM11.182 4.818a.75.75 0 0 1 0-1.06l1.06-1.061a.75.75 0 1 1 1.061 1.06L12.243 4.818a.75.75 0 0 1-1.06 0Z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    void handleSignOut();
                  }}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:border-border-2 hover:text-body md:px-3"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="border-t border-border/70 px-4 py-2 md:hidden">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {[
                  ["/apps", "Apps"],
                  ["/knowledge-bases", "Knowledge Bases"],
                  ["/organization", "Organization"],
                ].map(([path, label]) => {
                  const active = location.pathname.startsWith(path);
                  const kbDisabled = path === "/knowledge-bases" && !kbStatus.enabled;
                  if (kbDisabled) {
                    return (
                      <span
                        key={path}
                        title={kbStatus.detail}
                        className="whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-dim opacity-70"
                      >
                        {label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-accent-dim bg-accent-subtle text-accent"
                          : "border-border bg-surface text-subtle hover:border-border-2 hover:text-body"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div
            className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 pb-8 pt-[calc(var(--nav-height)+4.25rem)] md:gap-6 md:px-6 md:pt-[calc(var(--nav-height)+1.5rem)]"
          >
            {isAppRoute && <AppSidebar variant="desktop" />}
            <main className="min-w-0 flex-1">
              {isAppRoute && <AppSidebar variant="mobile" />}
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
