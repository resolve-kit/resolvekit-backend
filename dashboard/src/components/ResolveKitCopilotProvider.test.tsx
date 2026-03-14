// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/apps/app-123/llm";
let matchedAppId: string | undefined = "app-123";
const navigate = vi.fn();
const api = vi.fn();

const createClientTokenAuthProvider = vi.fn((options?: { endpoint?: string }) => ({
  kind: "auth-provider",
  endpoint: options?.endpoint,
}));
const createBrowserToolsPack = vi.fn((options?: unknown) => ({
  kind: "browser-tools-pack",
  options,
  functions: [
    { name: "discover_page_actions" },
    { name: "navigate_route" },
    { name: "click_element" },
  ],
}));

const runtimeInstances: MockRuntime[] = [];
const storage = (() => {
  let values = new Map<string, string>();
  return {
    clear() {
      values = new Map<string, string>();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    get length() {
      return values.size;
    },
  };
})();

class MockRuntime {
  public readonly config: Record<string, unknown>;
  public readonly refreshSessionContext = vi.fn(async () => undefined);
  public readonly setAppearance = vi.fn();

  constructor(config: Record<string, unknown>) {
    this.config = config;
    runtimeInstances.push(this);
  }
}

const resolveKitProvider = vi.fn(
  ({ children }: { children: React.ReactNode }) => <div data-testid="resolvekit-provider">{children}</div>,
);
const resolveKitWidget = vi.fn(
  ({ defaultOpen, position }: { defaultOpen?: boolean; position?: string }) => (
    <div data-testid="resolvekit-widget" data-default-open={String(defaultOpen)} data-position={position} />
  ),
);
const resolveKitDevtools = vi.fn(
  ({ position }: { position?: string }) => <div data-testid="resolvekit-devtools" data-position={position} />,
);

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname }),
  useMatch: () => (matchedAppId ? { params: { appId: matchedAppId } } : null),
  useNavigate: () => navigate,
}));

vi.mock("../api/client", () => ({
  api,
}));

vi.mock("@resolvekit/nextjs/client", () => ({
  ResolveKitRuntime: MockRuntime,
  createBrowserToolsPack,
  createClientTokenAuthProvider,
}));

vi.mock("@resolvekit/nextjs/react", () => ({
  ResolveKitProvider: resolveKitProvider,
  ResolveKitWidget: resolveKitWidget,
  ResolveKitDevtools: resolveKitDevtools,
}));

describe("ResolveKitCopilotProvider", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.resetModules();
    runtimeInstances.length = 0;
    pathname = "/apps/app-123/llm";
    matchedAppId = "app-123";
    process.env.NEXT_PUBLIC_RESOLVEKIT_ENABLED = "true";
    process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL = "http://agent.example";
    vi.stubEnv("NODE_ENV", "development");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    localStorage.clear();
    api.mockResolvedValue({
      target_app_id: "onboarding-app",
      target_app_name: "Onboarding App",
      is_complete: false,
      required_steps: [{ id: "org_llm_provider" }, { id: "create_app" }],
    });
  });

  afterEach(() => {
    cleanup();
    if (originalNodeEnv === undefined) {
      vi.unstubAllEnvs();
      return;
    }
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  });

  it("renders children only when ResolveKit is disabled", async () => {
    process.env.NEXT_PUBLIC_RESOLVEKIT_ENABLED = "false";

    const { default: ResolveKitCopilotProvider } = await import("./ResolveKitCopilotProvider");

    render(
      <ResolveKitCopilotProvider>
        <span>child</span>
      </ResolveKitCopilotProvider>,
    );

    expect(screen.getByText("child")).toBeTruthy();
    expect(resolveKitProvider).not.toHaveBeenCalled();
    expect(resolveKitWidget).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("builds the runtime around the token endpoint and refreshes session context", async () => {
    const { default: ResolveKitCopilotProvider } = await import("./ResolveKitCopilotProvider");

    render(
      <ResolveKitCopilotProvider>
        <span>child</span>
      </ResolveKitCopilotProvider>,
    );

    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.getByTestId("resolvekit-provider")).toBeTruthy();
    expect(screen.getByTestId("resolvekit-widget")).toBeTruthy();
    expect(screen.getByTestId("resolvekit-devtools")).toBeTruthy();

    expect(createClientTokenAuthProvider).toHaveBeenCalledWith({ endpoint: "/api/resolvekit/token" });
    expect(createBrowserToolsPack).toHaveBeenCalledTimes(1);
    expect(createBrowserToolsPack.mock.calls[0]?.[0]).toMatchObject({
      discoveryMode: "annotatedOnly",
      navigationAdapter: {
        push: expect.any(Function),
        replace: expect.any(Function),
      },
    });

    const runtime = runtimeInstances[0];
    expect(runtime).toBeTruthy();
    expect(runtime.config.baseUrl).toBe("http://agent.example");
    expect(runtime.config.sdkVersion).toBe("1.0.0");
    expect(runtime.config.authProvider).toEqual({
      kind: "auth-provider",
      endpoint: "/api/resolvekit/token",
    });

    await waitFor(() => {
      expect(runtime.refreshSessionContext).toHaveBeenCalled();
    });

    const llmContextProvider = runtime.config.llmContextProvider as () => Record<string, unknown>;
    expect(llmContextProvider()).toMatchObject({
      dashboard_app_id: "app-123",
      current_path: "/apps/app-123/llm",
      current_route_id: "app-llm",
      current_route_label: "Model",
      onboarding_target_app_id: "app-123",
      required_onboarding_step_ids: ["org_llm_provider", "create_app"],
    });
    expect(llmContextProvider().current_page_action_ids).toEqual(
      expect.arrayContaining([
        "llm-config-form",
        "save-llm-config-btn",
        "manage-org-profiles-btn",
      ]),
    );

    expect(runtime.config.functionPacks).toEqual([
      expect.objectContaining({
        kind: "browser-tools-pack",
        functions: [
          { name: "discover_page_actions" },
          { name: "navigate_route" },
        ],
      }),
    ]);

    const functions = runtime.config.functions as Array<{
      name: string;
      invoke: (input: Record<string, unknown>) => Promise<unknown>;
    }>;
    expect(functions.map((fn) => fn.name)).toEqual(
      expect.arrayContaining([
        "create_app_workspace",
        "list_app_workspaces",
        "delete_app_workspace",
        "set_widget_appearance",
        "list_dashboard_routes",
        "get_dashboard_context",
        "get_onboarding_status",
      ]),
    );

    await functions.find((fn) => fn.name === "set_widget_appearance")?.invoke({ mode: "dark" });
    expect(runtime.setAppearance).toHaveBeenCalledWith("dark");

    api.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/v1/apps" && !options?.method) {
        return [
          { id: "app-123", name: "asdfasg" },
          { id: "app-456", name: "Scout4me test" },
        ];
      }
      if (path === "/v1/apps/app-123" && options?.method === "DELETE") {
        return { ok: true };
      }
      return { target_app_id: "onboarding-app", is_complete: false, required_steps: [] };
    });

    const listedApps = await functions.find((fn) => fn.name === "list_app_workspaces")?.invoke({});
    expect(listedApps).toEqual({
      apps: [
        { id: "app-123", name: "asdfasg" },
        { id: "app-456", name: "Scout4me test" },
      ],
    });

    const deleted = await functions.find((fn) => fn.name === "delete_app_workspace")?.invoke({ appId: "app-123" });
    expect(deleted).toEqual({ deleted: true, appId: "app-123", error: null });
    expect(api).toHaveBeenCalledWith("/v1/apps/app-123", { method: "DELETE" });
  });

  it("skips the widget on the login route", async () => {
    pathname = "/login";
    matchedAppId = undefined;

    const { default: ResolveKitCopilotProvider } = await import("./ResolveKitCopilotProvider");

    render(
      <ResolveKitCopilotProvider>
        <span>child</span>
      </ResolveKitCopilotProvider>,
    );

    expect(screen.getByText("child")).toBeTruthy();
    expect(resolveKitProvider).not.toHaveBeenCalled();
    expect(resolveKitWidget).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });
});
