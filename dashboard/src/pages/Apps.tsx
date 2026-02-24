import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  Button,
  Input,
  ConfirmDialog,
  useToast,
} from "../components/ui";

interface App {
  id: string;
  name: string;
  bundle_id: string | null;
  created_at: string;
}

interface ConfigSummary {
  llm_provider: string;
  llm_model: string;
  has_llm_api_key: boolean;
}

interface ApiKeySummary {
  id: string;
  is_active: boolean;
}

interface FunctionSummary {
  id: string;
  is_active: boolean;
}

function AppIcon({ name }: { name: string }) {
  const palettes = [
    "bg-accent-subtle text-accent border-accent-dim",
    "bg-success-subtle text-success border-success-dim",
    "bg-warning-subtle text-warning border-warning-dim",
    "bg-danger-subtle text-danger border-danger-dim",
  ];
  const idx = (name.charCodeAt(0) || 0) % palettes.length;
  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-semibold font-display border flex-shrink-0 ${palettes[idx]}`}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

const APP_NAV_ITEMS = [
  { label: "LLM", slug: "llm" },
  { label: "API Keys", slug: "api-keys" },
  { label: "Functions", slug: "functions" },
  { label: "Agent", slug: "agent" },
  { label: "Knowledge", slug: "knowledge-bases" },
  { label: "Limits", slug: "limits" },
  { label: "Sessions", slug: "sessions" },
  { label: "Playbooks", slug: "playbooks" },
  { label: "Audit", slug: "audit" },
];

export default function Apps() {
  const [apps, setApps] = useState<App[]>([]);
  const [appMissingConfig, setAppMissingConfig] = useState<Record<string, string[]>>({});
  const [newName, setNewName] = useState("");
  const [newBundleId, setNewBundleId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newAppChecklistId, setNewAppChecklistId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api<App[]>("/v1/apps").then((loadedApps) => {
      setApps(loadedApps);
      void loadAppConfigStatus(loadedApps);
    });
  }, []);

  async function loadAppConfigStatus(targetApps: App[]) {
    const entries = await Promise.all(
      targetApps.map(async (app) => {
        try {
          const [config, apiKeys, functions] = await Promise.all([
            api<ConfigSummary>(`/v1/apps/${app.id}/config`),
            api<ApiKeySummary[]>(`/v1/apps/${app.id}/api-keys`),
            api<FunctionSummary[]>(`/v1/apps/${app.id}/functions`),
          ]);

          const missing: string[] = [];
          if (
            !config.has_llm_api_key ||
            config.llm_provider.trim().length === 0 ||
            config.llm_model.trim().length === 0
          ) {
            missing.push("LLM");
          }
          if (!apiKeys.some((key) => key.is_active)) {
            missing.push("API Keys");
          }
          if (!functions.some((fn) => fn.is_active)) {
            missing.push("Functions");
          }

          return [app.id, missing] as const;
        } catch {
          return [app.id, ["LLM", "API Keys", "Functions"]] as const;
        }
      })
    );

    setAppMissingConfig(Object.fromEntries(entries));
  }

  async function createApp() {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const app = await api<App>("/v1/apps", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          bundle_id: newBundleId || null,
        }),
      });
      setApps([app, ...apps]);
      setAppMissingConfig((prev) => ({
        ...prev,
        [app.id]: ["LLM", "API Keys", "Functions"],
      }));
      setNewAppChecklistId(app.id);
      setNewName("");
      setNewBundleId("");
      setShowCreate(false);
      toast("App created successfully", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create app", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteApp(id: string) {
    await api(`/v1/apps/${id}`, { method: "DELETE" });
    setApps(apps.filter((a) => a.id !== id));
    setAppMissingConfig((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast("App deleted", "info");
  }

  const appToDelete = apps.find((a) => a.id === confirmDeleteId);
  const checklistApp = apps.find((a) => a.id === newAppChecklistId) ?? null;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">
            Your Apps
          </h1>
          <p className="text-sm text-subtle mt-1">
            Manage your iOS apps and their agent configurations
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(!showCreate)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New App
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-4">Create New App</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input
              label="App Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My iOS App"
            />
            <Input
              label="Bundle ID (optional)"
              value={newBundleId}
              onChange={(e) => setNewBundleId(e.target.value)}
              placeholder="com.example.app"
              mono
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={createApp}
              loading={isCreating}
            >
              Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {checklistApp && (
        <div className="bg-accent-subtle border border-accent-dim rounded-xl p-4 mb-6 animate-fade-in-up">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-strong mb-1">
                Setup needed for {checklistApp.name}
              </p>
              <p className="text-xs text-subtle mb-3">
                To make this app work end-to-end, configure these sections:
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/apps/${checklistApp.id}/llm`}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-subtle hover:text-body hover:border-border-2 transition-colors"
                >
                  1. LLM + API Key
                </Link>
                <Link
                  to={`/apps/${checklistApp.id}/api-keys`}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-subtle hover:text-body hover:border-border-2 transition-colors"
                >
                  2. Generate API Key
                </Link>
                <Link
                  to={`/apps/${checklistApp.id}/functions`}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-subtle hover:text-body hover:border-border-2 transition-colors"
                >
                  3. Register Functions (SDK)
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewAppChecklistId(null)}
              className="text-subtle hover:text-body transition-colors p-1"
              aria-label="Dismiss setup checklist"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* App grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app, i) => (
          <div
            key={app.id}
            className={`group relative bg-surface border border-border rounded-xl p-4 hover:border-border-2 transition-all animate-fade-in-up ${
              i === 0 ? "" : i === 1 ? "delay-50" : i === 2 ? "delay-100" : "delay-150"
            }`}
          >
            {/* Delete button — visible on hover */}
            <button
              onClick={() => setConfirmDeleteId(app.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-subtle hover:text-danger p-1 rounded"
              title="Delete app"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <div className="flex items-start gap-3 mb-4">
              <AppIcon name={app.name} />
              <div className="min-w-0">
                <h2 className="font-semibold text-strong text-sm truncate pr-6">
                  {app.name}
                </h2>
                {app.bundle_id && (
                  <p className="text-xs text-dim font-mono mt-0.5 truncate">
                    {app.bundle_id}
                  </p>
                )}
                {appMissingConfig[app.id] && appMissingConfig[app.id].length > 0 && (
                  <p className="text-[10px] text-danger mt-1">
                    Configuration Incomplete · Missing {appMissingConfig[app.id].join(", ")}
                  </p>
                )}
                {appMissingConfig[app.id] && appMissingConfig[app.id].length === 0 && (
                  <p className="text-[10px] text-success mt-1">Configuration Complete</p>
                )}
              </div>
            </div>

            {/* Nav chips */}
            <div className="flex gap-1.5 flex-wrap">
              {APP_NAV_ITEMS.map((item) => (
                <Link
                  key={item.slug}
                  to={`/apps/${app.id}/${item.slug}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-subtle hover:text-body hover:border-border-2 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {apps.length === 0 && !showCreate && (
        <div className="text-center py-16 text-subtle animate-fade-in-up">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-sm">No apps yet. Create your first app to get started.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete App"
        description={`Are you sure you want to delete "${appToDelete?.name}"? This will permanently remove all associated configuration, functions, sessions, and API keys.`}
        confirmLabel="Delete App"
        confirmVariant="danger"
        onConfirm={() => deleteApp(confirmDeleteId!)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
