"use client";

import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import {
  ResolveKitRuntime,
  createBrowserToolsPack,
  createClientTokenAuthProvider,
  type ResolveKitConfiguration,
  type ResolveKitFunctionDefinition,
} from "@resolvekit/nextjs/client";
import { ResolveKitDevtools, ResolveKitProvider, ResolveKitWidget } from "@resolvekit/nextjs/react";

import { api } from "../api/client";
import { listDashboardRoutes, resolveDashboardRoute } from "../lib/resolvekit/dashboardCapabilities";

type OnboardingState = {
  target_app_id: string | null;
  target_app_name?: string | null;
  is_complete: boolean;
  required_steps?: Array<{ id: string }>;
};

type AppWorkspaceSummary = {
  id: string;
  name: string;
};

const RESOLVEKIT_ENABLED = process.env.NEXT_PUBLIC_RESOLVEKIT_ENABLED === "true";
const RESOLVEKIT_AGENT_BASE_URL = process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL ?? "http://localhost:8000";
const AUTO_OPEN_KEY = "resolvekit_copilot_auto_open_dismissed";
const SDK_VERSION = "1.0.0";

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

function buildFunctions(
  runtimeRef: RefObject<ResolveKitRuntime | null>,
  pathnameRef: RefObject<string>,
  boundAppIdRef: RefObject<string | null>,
  onboardingStateRef: RefObject<OnboardingState | null>,
): ResolveKitFunctionDefinition[] {
  return [
    {
      name: "create_app_workspace",
      description: "Create a new app workspace in the dashboard.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "App display name" },
          bundleId: { type: "string", description: "Optional bundle identifier" },
        },
        required: ["name"],
      },
      requiresApproval: true,
      async invoke(argumentsPayload) {
        const name = typeof argumentsPayload.name === "string" ? argumentsPayload.name : "";
        const bundleId =
          typeof argumentsPayload.bundleId === "string" ? argumentsPayload.bundleId : undefined;
        return api("/v1/apps", {
          method: "POST",
          body: JSON.stringify({ name, bundle_id: bundleId ?? null }),
        });
      },
    },
    {
      name: "set_widget_appearance",
      description: "Set copilot widget appearance mode to light, dark, or system.",
      parametersSchema: {
        type: "object",
        properties: {
          mode: { type: "string", description: "Appearance mode: light | dark | system" },
        },
        required: ["mode"],
      },
      requiresApproval: true,
      async invoke(argumentsPayload) {
        const mode = typeof argumentsPayload.mode === "string" ? argumentsPayload.mode : "system";
        runtimeRef.current?.setAppearance(mode as "light" | "dark" | "system");
        return { mode };
      },
    },
    {
      name: "list_app_workspaces",
      description: "List app workspaces in the dashboard so a user-requested app can be matched by name.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
      async invoke() {
        const payload = await api<unknown>("/v1/apps");
        const apps = Array.isArray(payload)
          ? payload
              .map((value) => {
                if (!value || typeof value !== "object") return null;
                const row = value as Partial<AppWorkspaceSummary>;
                if (typeof row.id !== "string" || typeof row.name !== "string") return null;
                return { id: row.id, name: row.name };
              })
              .filter((app): app is AppWorkspaceSummary => Boolean(app))
          : [];
        return { apps };
      },
    },
    {
      name: "delete_app_workspace",
      description: "Delete an app workspace after explicit approval using the app ID returned by list_app_workspaces.",
      parametersSchema: {
        type: "object",
        properties: {
          appId: { type: "string", description: "App workspace ID to delete" },
        },
        required: ["appId"],
      },
      requiresApproval: true,
      async invoke(argumentsPayload) {
        const appId = typeof argumentsPayload.appId === "string" ? argumentsPayload.appId.trim() : "";
        if (!appId) {
          return { deleted: false, appId: null, error: "Missing appId" };
        }
        await api(`/v1/apps/${appId}`, { method: "DELETE" });
        return { deleted: true, appId, error: null };
      },
    },
    {
      name: "list_dashboard_routes",
      description: "List dashboard routes, including onboarding and current-app destinations.",
      parametersSchema: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            description: "Route scope filter: all | onboarding | current-app",
          },
        },
      },
      async invoke(argumentsPayload) {
        const requestedScope = typeof argumentsPayload.scope === "string" ? argumentsPayload.scope : "all";
        const appId = boundAppIdRef.current ?? onboardingStateRef.current?.target_app_id ?? null;
        return {
          routes: listDashboardRoutes({
            scope:
              requestedScope === "onboarding" || requestedScope === "current-app" ? requestedScope : "all",
            appId,
          }).map((route) => ({
            id: route.id,
            label: route.label,
            pathTemplate: route.pathTemplate,
            path: route.path,
            requiresApp: route.requiresApp,
            onboardingTags: [...route.onboardingTags],
            actionIds: [...route.actionIds],
          })),
        };
      },
    },
    {
      name: "get_dashboard_context",
      description: "Describe the current dashboard route, active app binding, and relevant action ids.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
      async invoke() {
        const pathname = pathnameRef.current;
        const route = resolveDashboardRoute(pathname);
        return {
          path: pathname,
          routeId: route?.id ?? null,
          routeLabel: route?.label ?? null,
          appId: boundAppIdRef.current ?? null,
          onboardingTargetAppId: boundAppIdRef.current ?? onboardingStateRef.current?.target_app_id ?? null,
          currentActionIds: route?.actionIds ?? [],
        };
      },
    },
    {
      name: "get_onboarding_status",
      description: "Return the current organization onboarding state used by the dashboard guide rail.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
      async invoke() {
        return onboardingStateRef.current ?? { is_complete: false, target_app_id: null, required_steps: [] };
      },
    },
  ];
}

export default function ResolveKitCopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appRoute = useMatch("/apps/:appId/*");
  const [boundAppId, setBoundAppId] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const navigateRef = useRef(navigate);
  const boundAppIdRef = useRef(boundAppId);
  const pathnameRef = useRef(location.pathname);
  const onboardingStateRef = useRef(onboardingState);
  const runtimeRef = useRef<ResolveKitRuntime | null>(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    boundAppIdRef.current = boundAppId;
  }, [boundAppId]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    onboardingStateRef.current = onboardingState;
  }, [onboardingState]);

  useEffect(() => {
    if (!RESOLVEKIT_ENABLED || isAuthRoute(location.pathname)) {
      setBoundAppId(null);
      setOnboardingState(null);
      return;
    }

    const routeAppId = appRoute?.params.appId ?? null;
    if (routeAppId) {
      setBoundAppId(routeAppId);
    }

    if (appRoute?.params.appId) {
      setBoundAppId(appRoute.params.appId);
    }

    let cancelled = false;
    api<OnboardingState>("/v1/organizations/onboarding")
      .then((state) => {
        if (!cancelled) {
          onboardingStateRef.current = state;
          setOnboardingState(state);
          if (!routeAppId) {
            setBoundAppId(state.target_app_id ?? null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          onboardingStateRef.current = null;
          setOnboardingState(null);
          if (!routeAppId) setBoundAppId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appRoute?.params.appId, location.pathname]);

  const runtime = useMemo(() => {
    const nextRuntime = new ResolveKitRuntime({
      baseUrl: RESOLVEKIT_AGENT_BASE_URL,
      authProvider: createClientTokenAuthProvider({ endpoint: "/api/resolvekit/token" }),
      deviceIdPersistence: "localStorage",
      sdkVersion: SDK_VERSION,
      llmContextProvider: () => {
        const currentPath = pathnameRef.current;
        const currentRoute = resolveDashboardRoute(currentPath);
        return {
          dashboard_app_id: boundAppIdRef.current ?? null,
          current_path: currentPath,
          current_route_id: currentRoute?.id ?? null,
          current_route_label: currentRoute?.label ?? null,
          onboarding_target_app_id: boundAppIdRef.current ?? onboardingStateRef.current?.target_app_id ?? null,
          required_onboarding_step_ids: onboardingStateRef.current?.required_steps?.map((step) => step.id) ?? [],
        };
      },
      functions: buildFunctions(runtimeRef, pathnameRef, boundAppIdRef, onboardingStateRef),
      functionPacks: [
        createBrowserToolsPack({
          discoveryMode: "open",
          navigationAdapter: {
            push: (href) => navigateRef.current(href),
            replace: (href) => navigateRef.current(href, { replace: true }),
          },
        }),
      ],
    } satisfies ResolveKitConfiguration);
    runtimeRef.current = nextRuntime;
    return nextRuntime;
  }, []);

  useEffect(() => {
    void runtime.refreshSessionContext();
  }, [boundAppId, location.pathname, onboardingState, runtime]);

  const shouldDefaultOpen = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (localStorage.getItem(AUTO_OPEN_KEY) === "1") return false;
    localStorage.setItem(AUTO_OPEN_KEY, "1");
    return true;
  }, []);

  if (!RESOLVEKIT_ENABLED || isAuthRoute(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <ResolveKitProvider runtime={runtime} autoStart>
      {children}
      <ResolveKitWidget position="bottom-right" defaultOpen={shouldDefaultOpen} />
      {process.env.NODE_ENV === "development" && <ResolveKitDevtools position="bottom-left" />}
    </ResolveKitProvider>
  );
}
