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

type OnboardingState = {
  target_app_id: string | null;
  is_complete: boolean;
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
  ];
}

export default function ResolveKitCopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appRoute = useMatch("/apps/:appId/*");
  const [boundAppId, setBoundAppId] = useState<string | null>(null);
  const navigateRef = useRef(navigate);
  const boundAppIdRef = useRef(boundAppId);
  const pathnameRef = useRef(location.pathname);
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

  const runtime = useMemo(() => {
    const nextRuntime = new ResolveKitRuntime({
      baseUrl: RESOLVEKIT_AGENT_BASE_URL,
      authProvider: createClientTokenAuthProvider({ endpoint: "/api/resolvekit/token" }),
      sdkVersion: SDK_VERSION,
      llmContextProvider: () => ({
        dashboard_app_id: boundAppIdRef.current ?? null,
        current_path: pathnameRef.current,
      }),
      functions: buildFunctions(runtimeRef),
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
  }, [boundAppId, location.pathname, runtime]);

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
