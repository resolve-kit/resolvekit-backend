import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useDirtyState } from "../context/DirtyStateContext";

interface NavItem {
  label: string;
  slug: string;
}

const AGENT_PARENT_ITEM: NavItem = { label: "Agent", slug: "llm" };
const AGENT_CHILD_ITEMS: NavItem[] = [
  { label: "Model", slug: "llm" },
  { label: "System Prompt", slug: "agent" },
  { label: "Limits", slug: "limits" },
  { label: "Playbooks", slug: "playbooks" },
  { label: "Knowledge Bases", slug: "knowledge-bases" },
];
const API_KEYS_ITEM: NavItem = { label: "API Keys", slug: "api-keys" };
const CUSTOMIZATION_ITEMS: NavItem[] = [
  { label: "Chat Theme", slug: "chat-theme" },
  { label: "Localization", slug: "languages" },
];
const CUSTOMIZATION_PARENT_ITEM: NavItem = { label: "Customization", slug: "chat-theme" };
const SESSIONS_ITEM: NavItem = { label: "Sessions", slug: "sessions" };
const AUDIT_ITEM: NavItem = { label: "Audit Log", slug: "audit" };
const ROUTE_LABEL_ITEMS: NavItem[] = [
  ...AGENT_CHILD_ITEMS,
  API_KEYS_ITEM,
  ...CUSTOMIZATION_ITEMS,
  SESSIONS_ITEM,
  AUDIT_ITEM,
];
const AGENT_SECTION_SLUGS = AGENT_CHILD_ITEMS.map((item) => item.slug);
const CUSTOMIZATION_SECTION_SLUGS = CUSTOMIZATION_ITEMS.map((item) => item.slug);

interface AppSummary {
  id: string;
  name: string;
}

interface ConfigSummary {
  system_prompt: string;
  llm_profile_id: string | null;
  llm_model: string;
}

interface ApiKeySummary {
  id: string;
  is_active: boolean;
}

interface AppSidebarProps {
  variant?: "desktop" | "mobile";
}

export default function AppSidebar({ variant = "desktop" }: AppSidebarProps) {
  const { appId } = useParams<{ appId: string }>();
  const { dirtyPages } = useDirtyState();
  const location = useLocation();
  const navigate = useNavigate();
  const [appName, setAppName] = useState("");
  const [missingConfig, setMissingConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!appId) return;
    let isCancelled = false;

    Promise.all([
      api<AppSummary>(`/v1/apps/${appId}`).catch(() => null),
      api<ConfigSummary>(`/v1/apps/${appId}/config`).catch(() => null),
      api<ApiKeySummary[]>(`/v1/apps/${appId}/api-keys`).catch(() => null),
    ]).then(([app, config, apiKeys]) => {
      if (isCancelled) return;

      if (app?.name) {
        setAppName(app.name);
      } else {
        setAppName(appId.slice(0, 8));
      }

      const activeApiKeys = (apiKeys ?? []).filter((key) => key.is_active).length;
      setMissingConfig({
        llm: !config || !config.llm_profile_id || !config.llm_model,
        "api-keys": activeApiKeys === 0,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [appId, location.pathname]);

  if (!appId) return null;

  const pathFor = (slug: string) => `/apps/${appId}/${slug}`;
  const isRouteActive = (slug: string) => location.pathname === pathFor(slug);
  const isRouteDirty = (slug: string) => dirtyPages.has(slug);
  const isRouteMissing = (slug: string) => missingConfig[slug] === true;

  const isAgentSectionActive = AGENT_SECTION_SLUGS.some((slug) => isRouteActive(slug));
  const isAgentSectionDirty = AGENT_SECTION_SLUGS.some((slug) => isRouteDirty(slug));
  const isAgentSectionMissing = missingConfig.llm === true;
  const isCustomizationSectionActive = CUSTOMIZATION_SECTION_SLUGS.some((slug) => isRouteActive(slug));
  const isCustomizationSectionDirty = CUSTOMIZATION_SECTION_SLUGS.some((slug) => isRouteDirty(slug));

  const activeItem = ROUTE_LABEL_ITEMS.find((item) => isRouteActive(item.slug));
  const requiredMissing = ([
    ["llm", "Model"],
    ["api-keys", "API Keys"],
  ] as const)
    .filter(([slug]) => missingConfig[slug] === true)
    .map(([, label]) => label);

  function renderStatusDot(status: "missing" | "dirty" | null) {
    if (!status) return null;
    return (
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status === "missing" ? "bg-danger" : "bg-warning"}`}
      />
    );
  }

  function navButtonClass(active: boolean, depth: 0 | 1) {
    return `flex w-full items-center justify-between rounded-lg border py-2 text-xs font-semibold transition-colors ${
      depth === 0 ? "px-2.5" : "pl-4 pr-2.5"
    } ${
      active
        ? "border-accent-dim bg-accent-subtle text-accent"
        : "border-transparent text-subtle hover:border-border hover:bg-surface-2 hover:text-body"
    }`;
  }

  function renderNavButton(
    item: NavItem,
    options?: {
      depth?: 0 | 1;
      activeOverride?: boolean;
      dirtyOverride?: boolean;
      missingOverride?: boolean;
      onClickOverride?: () => void;
      playbookId?: string;
    },
  ) {
    const depth = options?.depth ?? 0;
    const active = options?.activeOverride ?? isRouteActive(item.slug);
    const missing = options?.missingOverride ?? isRouteMissing(item.slug);
    const dirty = options?.dirtyOverride ?? isRouteDirty(item.slug);
    const status: "missing" | "dirty" | null = missing ? "missing" : dirty ? "dirty" : null;
    const playbookId = options?.playbookId ?? `sidebar-${item.slug}`;

    return (
      <button
        key={`${item.slug}-${depth}-${item.label}`}
        type="button"
        data-playbook-id={playbookId}
        onClick={options?.onClickOverride ?? (() => navigate(pathFor(item.slug)))}
        className={navButtonClass(active, depth)}
      >
        <span>{item.label}</span>
        {renderStatusDot(status)}
      </button>
    );
  }

  if (variant === "mobile") {
    return (
      <nav className="mb-4 xl:hidden">
        <div className="glass-panel rounded-2xl border border-border/70 p-2.5 shadow-card">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">{appName || appId.slice(0, 8)}</p>
            <Link to="/apps" className="text-[11px] text-subtle hover:text-body">
              All apps
            </Link>
          </div>

          {requiredMissing.length > 0 && (
            <div className="mx-1 mb-3 rounded-lg border border-danger-dim bg-danger-subtle px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-danger">Config incomplete</p>
              <p className="mt-1 text-xs text-subtle">Missing: {requiredMissing.join(", ")}</p>
            </div>
          )}

          <div className="space-y-1 px-1 pb-1">
            {renderNavButton(AGENT_PARENT_ITEM, {
              activeOverride: isAgentSectionActive,
              dirtyOverride: isAgentSectionDirty,
              missingOverride: isAgentSectionMissing,
            })}

            {isAgentSectionActive && (
              <div className="ml-2 space-y-1 border-l border-border/70 pl-2">
                {AGENT_CHILD_ITEMS.map((item) => renderNavButton(item, { depth: 1 }))}
              </div>
            )}

            {renderNavButton(API_KEYS_ITEM)}

            {renderNavButton(CUSTOMIZATION_PARENT_ITEM, {
              activeOverride: isCustomizationSectionActive,
              dirtyOverride: isCustomizationSectionDirty,
            })}

            {isCustomizationSectionActive && (
              <div className="ml-2 space-y-1 border-l border-border/70 pl-2">
                {CUSTOMIZATION_ITEMS.map((item) => renderNavButton(item, { depth: 1 }))}
              </div>
            )}

            {renderNavButton(SESSIONS_ITEM)}
            {renderNavButton(AUDIT_ITEM)}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-[calc(var(--nav-height)+1.5rem)] hidden w-56 flex-shrink-0 self-start xl:block">
      <div className="glass-panel rounded-2xl border border-border/70 p-3 shadow-card">
        <Link to="/apps" className="mb-3 flex items-center gap-1.5 px-2 text-xs text-subtle transition-colors hover:text-body">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Apps
        </Link>

        <div className="mb-3 rounded-xl border border-border bg-surface-2 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Current app</p>
          <p className="truncate text-sm font-semibold text-strong">{appName || appId.slice(0, 8)}</p>
          <p className="truncate text-xs text-subtle">{activeItem ? `${activeItem.label} configuration` : "Configuration"}</p>
        </div>

        {requiredMissing.length > 0 && (
          <div className="mx-1 mb-3 rounded-lg border border-danger-dim bg-danger-subtle px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-danger">Config incomplete</p>
            <p className="mt-1 text-xs text-subtle">Missing: {requiredMissing.join(", ")}</p>
          </div>
        )}

        <div className="space-y-1.5">
          {renderNavButton(AGENT_PARENT_ITEM, {
            activeOverride: isAgentSectionActive,
            dirtyOverride: isAgentSectionDirty,
            missingOverride: isAgentSectionMissing,
          })}

          {isAgentSectionActive && (
            <div className="ml-2 space-y-1 border-l border-border/70 pl-2">
              {AGENT_CHILD_ITEMS.map((item) => renderNavButton(item, { depth: 1 }))}
            </div>
          )}

          {renderNavButton(API_KEYS_ITEM)}

          {renderNavButton(CUSTOMIZATION_PARENT_ITEM, {
            activeOverride: isCustomizationSectionActive,
            dirtyOverride: isCustomizationSectionDirty,
          })}

          {isCustomizationSectionActive && (
            <div className="ml-2 space-y-1 border-l border-border/70 pl-2">
              {CUSTOMIZATION_ITEMS.map((item) => renderNavButton(item, { depth: 1 }))}
            </div>
          )}

          {renderNavButton(SESSIONS_ITEM)}
          {renderNavButton(AUDIT_ITEM)}
        </div>
      </div>
    </nav>
  );
}
