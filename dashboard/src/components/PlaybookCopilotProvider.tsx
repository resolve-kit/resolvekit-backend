"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import PlaybookSDK, { fn } from "@playbook/sdk";
import { createRouterFunctions } from "@playbook/sdk/react-router";
import { PlaybookApprovalWidget, PlaybookProvider } from "@playbook/sdk/react";
import { createOnboardingFunctions } from "@playbook/sdk/starter";

import { api } from "../api/client";

type AppSummary = {
  id: string;
  name: string;
};

type OnboardingState = {
  target_app_id: string | null;
  is_complete: boolean;
};

const PLAYBOOK_ENABLED = process.env.NEXT_PUBLIC_PLAYBOOK_ENABLED === "true";
const PLAYBOOK_API_KEY = process.env.NEXT_PUBLIC_PLAYBOOK_KEY ?? "";
const PLAYBOOK_AGENT_BASE_URL = process.env.NEXT_PUBLIC_PLAYBOOK_AGENT_BASE_URL ?? "http://localhost:8000";
const AUTO_OPEN_KEY = "playbook_copilot_auto_open_dismissed";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

export default function PlaybookCopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appRoute = useMatch("/apps/:appId/*");
  const [boundAppId, setBoundAppId] = useState<string | null>(null);

  useEffect(() => {
    if (!PLAYBOOK_ENABLED || isAuthRoute(location.pathname)) {
      setBoundAppId(null);
      return;
    }

    if (appRoute?.params.appId) {
      setBoundAppId(appRoute.params.appId);
      return;
    }

    let cancelled = false;
    api<OnboardingState>("/v1/organizations/onboarding")
      .then((state) => {
        if (!cancelled) {
          setBoundAppId(state.target_app_id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setBoundAppId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appRoute?.params.appId, location.pathname]);

  const functions = useMemo(
    () => [
      ...createRouterFunctions({
        navigate: (path) => navigate(path),
        getCurrentPath: () => location.pathname,
        getCurrentAppId: () => boundAppId,
      }),
      ...createOnboardingFunctions({
        getOnboardingStatus: () => api<OnboardingState>("/v1/organizations/onboarding"),
        listApps: async () => {
          const apps = await api<AppSummary[]>("/v1/apps");
          return apps.map((app) => ({ id: app.id, name: app.name }));
        },
      }),
      fn(
        async function createAppWorkspace({ name, bundleId }: { name: string; bundleId?: string }) {
          return api("/v1/apps", {
            method: "POST",
            body: JSON.stringify({
              name,
              bundle_id: bundleId ?? null,
            }),
          });
        },
        {
          name: "create_app_workspace",
          description: "Create a new app workspace in the dashboard.",
          parameters: {
            name: { type: "string", description: "App display name" },
            bundleId: { type: "string", description: "Optional bundle identifier", required: false },
          },
          requiresApproval: true,
        },
      ),
      fn(
        async function setWidgetAppearance({ mode }: { mode: "light" | "dark" | "system" }) {
          PlaybookSDK.setAppearance(mode);
          return { mode };
        },
        {
          name: "set_widget_appearance",
          description: "Set copilot widget appearance mode to light, dark, or system.",
          parameters: {
            mode: { type: "string", description: "Appearance mode: light, dark, or system." },
          },
          requiresApproval: true,
        },
      ),
    ],
    [boundAppId, location.pathname, navigate],
  );

  useEffect(() => {
    if (!PLAYBOOK_ENABLED || !PLAYBOOK_API_KEY || isAuthRoute(location.pathname)) return;
    if (localStorage.getItem(AUTO_OPEN_KEY) === "1") return;
    localStorage.setItem(AUTO_OPEN_KEY, "1");
    queueMicrotask(() => PlaybookSDK.open());
  }, [location.pathname]);

  if (!PLAYBOOK_ENABLED || !PLAYBOOK_API_KEY || isAuthRoute(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <PlaybookProvider
      apiKey={PLAYBOOK_API_KEY}
      baseURL={PLAYBOOK_AGENT_BASE_URL}
      functions={functions}
      position="bottom-right"
      appId={boundAppId ?? undefined}
      llmContext={boundAppId ? { dashboard_app_id: boundAppId } : undefined}
    >
      {children}
      <span data-playbook-id="copilot-widget-anchor" className="hidden" />
      <PlaybookApprovalWidget />
    </PlaybookProvider>
  );
}
