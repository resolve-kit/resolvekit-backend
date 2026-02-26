import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useDirtyState } from "../context/DirtyStateContext";

const NAV_ITEMS = [
  { label: "LLM", slug: "llm" },
  { label: "API Keys", slug: "api-keys" },
  { label: "Languages", slug: "languages" },
  { label: "Functions", slug: "functions" },
  { label: "Chat Theme", slug: "chat-theme" },
  { label: "Agent", slug: "agent" },
  { label: "Knowledge Bases", slug: "knowledge-bases" },
  { label: "Limits", slug: "limits" },
  { label: "Sessions", slug: "sessions" },
  { label: "Playbooks", slug: "playbooks" },
  { label: "Audit Log", slug: "audit" },
];

interface AppSummary {
  id: string;
  name: string;
}

interface ConfigSummary {
  system_prompt: string;
  llm_profile_id: string | null;
  llm_model: string;
}

interface FunctionSummary {
  id: string;
  is_active: boolean;
}

interface ApiKeySummary {
  id: string;
  is_active: boolean;
}

export default function AppSidebar() {
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
      api<FunctionSummary[]>(`/v1/apps/${appId}/functions`).catch(() => null),
      api<ApiKeySummary[]>(`/v1/apps/${appId}/api-keys`).catch(() => null),
    ]).then(([app, config, functions, apiKeys]) => {
      if (isCancelled) return;

      if (app?.name) {
        setAppName(app.name);
      } else {
        setAppName(appId.slice(0, 8));
      }

      const activeFunctions = (functions ?? []).filter((fn) => fn.is_active).length;
      const activeApiKeys = (apiKeys ?? []).filter((key) => key.is_active).length;
      setMissingConfig({
        llm:
          !config ||
          !config.llm_profile_id ||
          !config.llm_model,
        "api-keys": activeApiKeys === 0,
        functions: activeFunctions === 0,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [appId, location.pathname]);

  if (!appId) return null;

  const activeItem = NAV_ITEMS.find((item) => location.pathname === `/apps/${appId}/${item.slug}`);
  const requiredMissing = ([
    ["llm", "LLM"],
    ["api-keys", "API Keys"],
    ["functions", "Functions"],
  ] as const)
    .filter(([slug]) => missingConfig[slug] === true)
    .map(([, label]) => label);

  return (
    <nav className="w-48 flex-shrink-0 flex flex-col gap-1 pt-2 relative z-20 pointer-events-auto">
      <Link
        to="/apps"
        className="flex items-center gap-1.5 text-xs text-subtle hover:text-body transition-colors mb-3 px-2"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Apps
      </Link>

      <div className="px-2 mb-3">
        <p className="text-[10px] uppercase tracking-widest text-muted">App</p>
        <p className="text-sm font-semibold text-strong truncate">{appName || appId.slice(0, 8)}</p>
        <p className="text-xs text-subtle truncate">
          {activeItem ? `${activeItem.label} Configuration` : "Configuration"}
        </p>
      </div>

      {requiredMissing.length > 0 && (
        <div className="mx-2 mb-3 rounded-lg border border-danger-dim bg-danger-subtle px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-widest text-danger">Configuration Incomplete</p>
          <p className="text-xs text-subtle mt-1">
            Missing: {requiredMissing.join(", ")}
          </p>
        </div>
      )}

      {NAV_ITEMS.map((item) => {
        const isDirty = dirtyPages.has(item.slug);
        const isMissing = missingConfig[item.slug] === true;
        return (
          <button
            key={item.slug}
            type="button"
            onClick={() => navigate(`/apps/${appId}/${item.slug}`)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${
              location.pathname === `/apps/${appId}/${item.slug}`
                ? "bg-accent-subtle text-accent font-medium"
                : "text-subtle hover:text-body hover:bg-surface-2"
            }`}
          >
            {item.label}
            <span className="flex items-center gap-1.5">
              {isMissing && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0"
                  title="Not configured yet"
                />
              )}
              {!isMissing && isDirty && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0"
                  title="Unsaved changes"
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
