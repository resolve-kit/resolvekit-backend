import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ResolveKitAction } from "@resolvekit/nextjs/react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  Button,
  EmptyState,
  Input,
  MetricTile,
  SectionCard,
  ConfirmDialog,
  useToast,
} from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";
import { PageHeader } from "../components/layout/PageHeader";

interface App {
  id: string;
  name: string;
  bundle_id: string | null;
  integration_enabled: boolean;
  created_at: string;
}

interface ConfigSummary {
  llm_profile_id: string | null;
  llm_model: string;
}

interface ApiKeySummary {
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
  const safeName = typeof name === "string" ? name : "";
  const firstChar = safeName.charAt(0);
  const idx = (firstChar ? firstChar.charCodeAt(0) : 0) % palettes.length;
  return (
    <div
      className={`h-10 w-10 flex-shrink-0 rounded-xl border text-base font-semibold font-display flex items-center justify-center shadow-card ${palettes[idx]}`}
    >
      {firstChar.toUpperCase() || "?"}
    </div>
  );
}

function sanitizeApps(payload: unknown): App[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((value) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Partial<App>;
      if (typeof row.id !== "string" || !row.id.trim()) return null;
      return {
        id: row.id,
        name: typeof row.name === "string" && row.name.trim() ? row.name : "Untitled App",
        bundle_id: typeof row.bundle_id === "string" ? row.bundle_id : null,
        integration_enabled: Boolean(row.integration_enabled),
        created_at: typeof row.created_at === "string" ? row.created_at : "",
      } satisfies App;
    })
    .filter((app): app is App => Boolean(app));
}

const APP_NAV_ITEMS = [
  { label: "Model", slug: "llm" },
  { label: "System Prompt", slug: "agent" },
  { label: "Limits", slug: "limits" },
  { label: "Playbooks", slug: "playbooks" },
  { label: "Knowledge Bases", slug: "knowledge-bases" },
  { label: "API Keys", slug: "api-keys" },
  { label: "Chat Theme", slug: "chat-theme" },
  { label: "Localization", slug: "languages" },
  { label: "Sessions", slug: "sessions" },
  { label: "Audit Log", slug: "audit" },
];
const APP_DEFAULT_SLUG = APP_NAV_ITEMS[0]?.slug ?? "llm";

export default function Apps() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appMissingConfig, setAppMissingConfig] = useState<Record<string, string[]>>({});
  const [newName, setNewName] = useState("");
  const [newBundleId, setNewBundleId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBundleId, setEditBundleId] = useState("");
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmToggleAppId, setConfirmToggleAppId] = useState<string | null>(null);
  const { toast } = useToast();
  const { refresh } = useOnboarding();

  useEffect(() => {
    let cancelled = false;

    api<unknown>("/v1/apps")
      .then((payload) => {
        if (cancelled) return;
        const loadedApps = sanitizeApps(payload);
        setApps(loadedApps);
        setLoadError(null);
        void loadAppConfigStatus(loadedApps);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setApps([]);
        const detail = err instanceof ApiError ? err.detail : "Failed to load apps";
        setLoadError(detail);
        toast(detail, "error");
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function loadAppConfigStatus(targetApps: App[]) {
    const entries = await Promise.all(
      targetApps.map(async (app) => {
        try {
          const [config, apiKeys] = await Promise.all([
            api<ConfigSummary>(`/v1/apps/${app.id}/config`),
            api<ApiKeySummary[]>(`/v1/apps/${app.id}/api-keys`),
          ]);

          const missing: string[] = [];
          if (!config.llm_profile_id || !config.llm_model) {
            missing.push("Model");
          }
          if (!apiKeys.some((key) => key.is_active)) {
            missing.push("API Keys");
          }

          return [app.id, missing] as const;
        } catch {
          return [app.id, ["Model", "API Keys"]] as const;
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
        [app.id]: ["Model", "API Keys"],
      }));
      setNewName("");
      setNewBundleId("");
      setShowCreate(false);
      toast("App created successfully", "success");
      void refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create app", "error");
    } finally {
      setIsCreating(false);
    }
  }

  function beginEdit(app: App) {
    setEditingAppId(app.id);
    setEditName(app.name);
    setEditBundleId(app.bundle_id ?? "");
  }

  function cancelEdit() {
    setEditingAppId(null);
    setEditName("");
    setEditBundleId("");
    setIsUpdatingApp(false);
  }

  async function updateAppDetails(id: string) {
    if (!editName.trim()) {
      toast("App name is required", "error");
      return;
    }

    setIsUpdatingApp(true);
    try {
      const updated = await api<App>(`/v1/apps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          bundle_id: editBundleId.trim() || null,
        }),
      });
      setApps((prev) => prev.map((app) => (app.id === id ? updated : app)));
      cancelEdit();
      toast("App details updated", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update app", "error");
      setIsUpdatingApp(false);
    }
  }

  async function deleteApp(id: string) {
    try {
      await api(`/v1/apps/${id}`, { method: "DELETE" });
      setApps((prev) => prev.filter((a) => a.id !== id));
      setAppMissingConfig((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast("App deleted", "info");
      void refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to delete app", "error");
    } finally {
      // Always close the modal so stale ids cannot leave the dialog stuck open.
      setConfirmDeleteId(null);
    }
  }

  async function toggleIntegration(id: string, enable: boolean) {
    try {
      const updated = await api<App>(`/v1/apps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ integration_enabled: enable }),
      });
      setApps((prev) => prev.map((app) => (app.id === id ? updated : app)));
      toast(enable ? "App integration enabled" : "App integration disabled", "info");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update integration", "error");
    }
  }

  function openDefaultAppPage(appId: string) {
    navigate(`/apps/${appId}/${APP_DEFAULT_SLUG}`);
  }

  function handleAppCardClick(event: MouseEvent<HTMLElement>, appId: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, label")) return;
    openDefaultAppPage(appId);
  }

  function handleAppCardKeyDown(event: KeyboardEvent<HTMLElement>, appId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, label")) return;
    event.preventDefault();
    openDefaultAppPage(appId);
  }

  const appToDelete = apps.find((a) => a.id === confirmDeleteId) ?? null;
  const appToToggle = apps.find((a) => a.id === confirmToggleAppId) ?? null;
  const configuredApps = Object.values(appMissingConfig).filter((missing) => missing.length === 0).length;
  const enabledApps = apps.filter((app) => app.integration_enabled).length;

  useEffect(() => {
    if (confirmDeleteId && !appToDelete) {
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, appToDelete]);

  return (
    <div>
      <PageHeader
        eyebrow="Applications"
        title="Your Apps"
        subtitle="Manage embedded chat deployments and operator configuration readiness across your app portfolio."
        rightSlot={
          <ResolveKitAction
            as={Button}
            actionId="create-app-btn"
            actionRole="action"
            description="Open form to create a new app workspace"
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => setShowCreate(!showCreate)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New App
          </ResolveKitAction>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 animate-fade-in-up">
        <MetricTile label="Total apps" value={apps.length} />
        <MetricTile label="Integration enabled" value={enabledApps} />
        <MetricTile label="Config complete" value={configuredApps} />
      </div>

      {/* Create form */}
      {showCreate && (
        <SectionCard title="Create New App" className="mb-6 animate-fade-in-up">
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
            <ResolveKitAction
              as={Button}
              actionId="create-app-submit"
              actionRole="action"
              description="Submit the create app form with the entered name and bundle ID"
              variant="primary"
              size="sm"
              onClick={createApp}
              loading={isCreating}
            >
              Create
            </ResolveKitAction>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </SectionCard>
      )}

      {/* App grid */}
      <div data-resolvekit-id="apps-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app, i) => (
          <div
            key={app.id}
            data-resolvekit-id={`app-card-${app.id}`}
            role="link"
            tabIndex={0}
            onClick={(event) => {
              if (editingAppId === app.id) return;
              handleAppCardClick(event, app.id);
            }}
            onKeyDown={(event) => {
              if (editingAppId === app.id) return;
              handleAppCardKeyDown(event, app.id);
            }}
            aria-label={`Open ${app.name} app settings`}
            className={`group relative glass-panel rounded-xl border border-border/70 p-4 transition-all hover:-translate-y-0.5 hover:border-border-2 hover:shadow-card cursor-pointer animate-fade-in-up ${
              i === 0 ? "" : i === 1 ? "delay-50" : i === 2 ? "delay-100" : "delay-150"
            }`}
          >
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button
                onClick={() => beginEdit(app)}
                className="rounded p-1 text-subtle hover:text-body"
                title="Rename / edit bundle ID"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536M9 13l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 16.536a4 4 0 01-1.414.943L7 19l1.52-4.122A4 4 0 019.536 13z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDeleteId(app.id)}
                className="rounded p-1 text-subtle hover:text-danger"
                title="Delete app"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

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
                <p className={`mt-1 text-[10px] ${app.integration_enabled ? "text-success" : "text-warning"}`}>
                  Integration {app.integration_enabled ? "Enabled" : "Disabled"}
                </p>
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

            {editingAppId === app.id && (
              <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3">
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    label="App name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="My iOS App"
                  />
                  <Input
                    label="Bundle ID (optional)"
                    value={editBundleId}
                    onChange={(e) => setEditBundleId(e.target.value)}
                    placeholder="com.example.app"
                    mono
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => updateAppDetails(app.id)}
                    loading={isUpdatingApp}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isUpdatingApp}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Nav chips */}
            <div className="flex flex-wrap gap-1.5">
              {APP_NAV_ITEMS.map((item) => (
                <Link
                  key={item.slug}
                  to={`/apps/${app.id}/${item.slug}`}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-subtle transition-colors hover:border-border-2 hover:bg-surface-2 hover:text-body"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => setConfirmToggleAppId(app.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  app.integration_enabled
                    ? "bg-warning-subtle border-warning-dim text-warning hover:text-body"
                    : "bg-success-subtle border-success-dim text-success hover:text-body"
                }`}
              >
                {app.integration_enabled ? "Disable Integration" : "Enable Integration"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {apps.length === 0 && !showCreate && (
        <div className="animate-fade-in-up">
          <EmptyState
            title="No apps yet"
            description="Create your first app to start shipping embedded LLM support."
          />
        </div>
      )}

      {loadError && (
        <SectionCard title="Unable to load apps" className="mt-4 animate-fade-in-up">
          <p className="text-sm text-danger">{loadError}</p>
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null && appToDelete !== null}
        title="Delete App"
        description={`Are you sure you want to delete "${appToDelete?.name ?? "this app"}"? This will permanently remove all associated configuration, functions, sessions, and API keys.`}
        confirmLabel="Delete App"
        confirmVariant="danger"
        confirmTextRequired={appToDelete?.name ?? ""}
        confirmTextLabel="Type app name to confirm"
        confirmTextPlaceholder="Enter app name exactly"
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          await deleteApp(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        open={confirmToggleAppId !== null}
        title={appToToggle?.integration_enabled ? "Disable App Integration" : "Enable App Integration"}
        description={
          appToToggle?.integration_enabled
            ? `Disable "${appToToggle.name}" integration? The SDK will show "Chat is unavailable, try again later".`
            : `Enable "${appToToggle?.name}" integration so the SDK can resume chat.`
        }
        confirmLabel={appToToggle?.integration_enabled ? "Disable Integration" : "Enable Integration"}
        confirmVariant={appToToggle?.integration_enabled ? "danger" : "primary"}
        onConfirm={async () => {
          if (!appToToggle) return;
          await toggleIntegration(appToToggle.id, !appToToggle.integration_enabled);
          setConfirmToggleAppId(null);
        }}
        onCancel={() => setConfirmToggleAppId(null)}
      />
    </div>
  );
}
