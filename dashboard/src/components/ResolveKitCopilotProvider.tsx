"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { api } from "../api/client";

type SDKModule = typeof import("@resolvekit/sdk");
type SDKReactModule = typeof import("@resolvekit/sdk/react");
type SDKRouterModule = typeof import("@resolvekit/sdk/react-router");
type SDKStarterModule = typeof import("@resolvekit/sdk/starter");

type LoadedModules = {
  sdk: SDKModule;
  react: SDKReactModule;
  router: SDKRouterModule;
  starter: SDKStarterModule;
};

type AppSummary = {
  id: string;
  name: string;
};

type OnboardingState = {
  target_app_id: string | null;
  is_complete: boolean;
};

const RESOLVEKIT_ENABLED = process.env.NEXT_PUBLIC_RESOLVEKIT_ENABLED === "true";
const RESOLVEKIT_API_KEY = process.env.NEXT_PUBLIC_RESOLVEKIT_KEY ?? "";
const RESOLVEKIT_AGENT_BASE_URL = process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL ?? "http://localhost:8000";
const AUTO_OPEN_KEY = "resolvekit_copilot_auto_open_dismissed";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

export default function ResolveKitCopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appRoute = useMatch("/apps/:appId/*");
  const [boundAppId, setBoundAppId] = useState<string | null>(null);
  const [sdkModules, setSdkModules] = useState<LoadedModules | null>(null);

  useEffect(() => {
    if (!RESOLVEKIT_ENABLED || !RESOLVEKIT_API_KEY || isAuthRoute(location.pathname)) {
      setSdkModules(null);
      return;
    }

    let cancelled = false;
    Promise.all([
      import("@resolvekit/sdk"),
      import("@resolvekit/sdk/react"),
      import("@resolvekit/sdk/react-router"),
      import("@resolvekit/sdk/starter"),
    ])
      .then(([sdk, react, router, starter]) => {
        if (!cancelled) {
          setSdkModules({ sdk, react, router, starter });
        }
      })
      .catch(() => {
        if (!cancelled) setSdkModules(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!RESOLVEKIT_ENABLED || isAuthRoute(location.pathname)) {
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
    () => {
      if (!sdkModules) return [];
      const ResolveKitSDK = sdkModules.sdk.default;
      const fn = sdkModules.sdk.fn;
      const createRouterFunctions = sdkModules.router.createRouterFunctions;
      const createOnboardingFunctions = sdkModules.starter.createOnboardingFunctions;

      return [
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
            ResolveKitSDK.setAppearance(mode);
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
      ];
    },
    [boundAppId, location.pathname, navigate, sdkModules],
  );

  useEffect(() => {
    if (!sdkModules) return;
    const ResolveKitSDK = sdkModules.sdk.default;
    if (!RESOLVEKIT_ENABLED || !RESOLVEKIT_API_KEY || isAuthRoute(location.pathname)) return;
    if (localStorage.getItem(AUTO_OPEN_KEY) === "1") return;
    localStorage.setItem(AUTO_OPEN_KEY, "1");
    queueMicrotask(() => ResolveKitSDK.open());
  }, [location.pathname, sdkModules]);

  if (!RESOLVEKIT_ENABLED || !RESOLVEKIT_API_KEY || isAuthRoute(location.pathname)) {
    return <>{children}</>;
  }

  if (!sdkModules) {
    return <>{children}</>;
  }

  const ResolveKitProvider = sdkModules.react.ResolveKitProvider;
  return (
    <ResolveKitProvider
      apiKey={RESOLVEKIT_API_KEY}
      baseURL={RESOLVEKIT_AGENT_BASE_URL}
      functions={functions}
      position="bottom-right"
      appId={boundAppId ?? undefined}
      llmContext={boundAppId ? { dashboard_app_id: boundAppId } : undefined}
    >
      {children}
      <span data-resolvekit-id="copilot-widget-anchor" className="hidden" />
    </ResolveKitProvider>
  );
}
