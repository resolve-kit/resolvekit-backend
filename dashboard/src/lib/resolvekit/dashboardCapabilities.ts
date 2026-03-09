export type DashboardRouteId =
  | "apps"
  | "knowledge-bases"
  | "organization"
  | "app-llm"
  | "app-agent"
  | "app-limits"
  | "app-functions"
  | "app-playbooks"
  | "app-knowledge-bases"
  | "app-api-keys"
  | "app-chat-theme"
  | "app-languages"
  | "app-sessions"
  | "app-audit";

export type DashboardRouteScope = "all" | "onboarding" | "current-app";

export interface DashboardRouteDefinition {
  id: DashboardRouteId;
  label: string;
  pathTemplate: string;
  requiresApp: boolean;
  onboardingTags: string[];
  actionIds: string[];
}

export const DASHBOARD_ROUTE_DEFINITIONS: DashboardRouteDefinition[] = [
  {
    id: "apps",
    label: "Apps",
    pathTemplate: "/apps",
    requiresApp: false,
    onboardingTags: ["create_app"],
    actionIds: [
      "create-app-btn",
      "create-app-submit",
      "edit-app-<appId>",
      "delete-app-<appId>",
      "delete-app-confirm-btn",
    ],
  },
  {
    id: "knowledge-bases",
    label: "Knowledge Bases",
    pathTemplate: "/knowledge-bases",
    requiresApp: false,
    onboardingTags: ["knowledge_bases_tip"],
    actionIds: ["add-knowledge-base-btn"],
  },
  {
    id: "organization",
    label: "Organization",
    pathTemplate: "/organization",
    requiresApp: false,
    onboardingTags: ["org_llm_provider"],
    actionIds: ["org-view-llm-setup", "create-org-llm-profile-btn", "invite-member-btn"],
  },
  {
    id: "app-llm",
    label: "Model",
    pathTemplate: "/apps/:appId/llm",
    requiresApp: true,
    onboardingTags: ["select_model"],
    actionIds: ["llm-config-form", "save-llm-config-btn", "manage-org-profiles-btn"],
  },
  {
    id: "app-agent",
    label: "System Prompt",
    pathTemplate: "/apps/:appId/agent",
    requiresApp: true,
    onboardingTags: ["agent_prompt_tip"],
    actionIds: ["save-agent-prompt-btn"],
  },
  {
    id: "app-limits",
    label: "Limits",
    pathTemplate: "/apps/:appId/limits",
    requiresApp: true,
    onboardingTags: [],
    actionIds: [],
  },
  {
    id: "app-functions",
    label: "Functions",
    pathTemplate: "/apps/:appId/functions",
    requiresApp: true,
    onboardingTags: ["integrate_sdk_register_functions"],
    actionIds: [
      "functions-list",
      "toggle-function-<functionId>",
      "edit-function-override-<functionId>",
      "save-function-override-<functionId>",
      "clear-function-override-<functionId>",
      "toggle-function-schema-<functionId>",
      "open-ios-sdk-repo-btn",
    ],
  },
  {
    id: "app-playbooks",
    label: "Playbooks",
    pathTemplate: "/apps/:appId/playbooks",
    requiresApp: true,
    onboardingTags: ["playbooks_tip"],
    actionIds: ["new-playbook-btn"],
  },
  {
    id: "app-knowledge-bases",
    label: "Knowledge Bases",
    pathTemplate: "/apps/:appId/knowledge-bases",
    requiresApp: true,
    onboardingTags: ["knowledge_bases_tip"],
    actionIds: [],
  },
  {
    id: "app-api-keys",
    label: "API Keys",
    pathTemplate: "/apps/:appId/api-keys",
    requiresApp: true,
    onboardingTags: ["generate_app_api_key"],
    actionIds: ["generate-api-key-btn", "copy-api-key-btn", "dismiss-api-key-btn"],
  },
  {
    id: "app-chat-theme",
    label: "Chat Theme",
    pathTemplate: "/apps/:appId/chat-theme",
    requiresApp: true,
    onboardingTags: [],
    actionIds: [],
  },
  {
    id: "app-languages",
    label: "Localization",
    pathTemplate: "/apps/:appId/languages",
    requiresApp: true,
    onboardingTags: [],
    actionIds: [],
  },
  {
    id: "app-sessions",
    label: "Sessions",
    pathTemplate: "/apps/:appId/sessions",
    requiresApp: true,
    onboardingTags: [],
    actionIds: [],
  },
  {
    id: "app-audit",
    label: "Audit Log",
    pathTemplate: "/apps/:appId/audit",
    requiresApp: true,
    onboardingTags: [],
    actionIds: [],
  },
];

function buildRouteRegex(pathTemplate: string): RegExp {
  return new RegExp(`^${pathTemplate.replace(":appId", "[^/]+")}$`);
}

export function resolveDashboardRoute(pathname: string): DashboardRouteDefinition | null {
  return DASHBOARD_ROUTE_DEFINITIONS.find((route) => buildRouteRegex(route.pathTemplate).test(pathname)) ?? null;
}

export function materializeDashboardPath(pathTemplate: string, appId: string | null): string {
  if (!pathTemplate.includes(":appId")) return pathTemplate;
  return appId ? pathTemplate.replace(":appId", appId) : pathTemplate;
}

export function listDashboardRoutes(params?: {
  scope?: DashboardRouteScope;
  appId?: string | null;
}): Array<DashboardRouteDefinition & { path: string }> {
  const scope = params?.scope ?? "all";
  const appId = params?.appId ?? null;

  return DASHBOARD_ROUTE_DEFINITIONS
    .filter((route) => {
      if (scope === "onboarding") return route.onboardingTags.length > 0;
      if (scope === "current-app") return route.requiresApp;
      return true;
    })
    .filter((route) => !route.requiresApp || scope === "all" || Boolean(appId))
    .map((route) => ({
      ...route,
      path: materializeDashboardPath(route.pathTemplate, appId),
    }));
}
