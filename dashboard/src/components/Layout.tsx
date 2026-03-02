import { useEffect } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { clearToken } from "../api/client";
import { DirtyStateProvider } from "../context/DirtyStateContext";
import { OnboardingProvider } from "../context/OnboardingContext";
import AppSidebar from "./AppSidebar";
import OnboardingGuideRail from "./OnboardingGuideRail";
import ResolveKitWordmark from "./ResolveKitWordmark";

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
          <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
            <div className="mx-auto flex h-[var(--nav-height)] max-w-[1400px] items-center justify-between px-4 md:px-6">
              <Link to="/apps" className="inline-flex items-end gap-2">
                <ResolveKitWordmark />
                <span className="pb-[1px] text-[12px] md:text-[13px] font-semibold tracking-[0.16em] text-subtle">
                  | console
                </span>
              </Link>

              <div className="hidden items-center gap-1 md:flex">
                {["/apps", "/knowledge-bases", "/organization"].map((path) => {
                  const label =
                    path === "/apps" ? "Apps" : path === "/knowledge-bases" ? "Knowledge Bases" : "Organization";
                  const active = location.pathname.startsWith(path);
                  const resolveKitId =
                    path === "/apps" ? "nav-apps" : path === "/knowledge-bases" ? "nav-knowledge-bases" : "nav-organization";
                  return (
                    <Link
                      key={path}
                      to={path}
                      data-resolvekit-id={resolveKitId}
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

              <button
                onClick={() => {
                  clearToken();
                  navigate("/login");
                }}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-subtle transition-colors hover:border-border-2 hover:text-body md:px-3"
              >
                Sign out
              </button>
            </div>

            <div className="border-t border-border/70 px-4 py-2 md:hidden">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {[
                  ["/apps", "Apps"],
                  ["/knowledge-bases", "Knowledge Bases"],
                  ["/organization", "Organization"],
                ].map(([path, label]) => {
                  const active = location.pathname.startsWith(path);
                  const resolveKitId =
                    path === "/apps" ? "nav-apps" : path === "/knowledge-bases" ? "nav-knowledge-bases" : "nav-organization";
                  return (
                    <Link
                      key={path}
                      to={path}
                      data-resolvekit-id={resolveKitId}
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
