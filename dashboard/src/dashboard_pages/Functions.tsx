import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  PageSpinner,
  Textarea,
  useToast,
} from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";

interface Fn {
  id: string;
  name: string;
  description: string;
  description_override: string | null;
  parameters_schema: Record<string, unknown>;
  is_active: boolean;
  timeout_seconds: number;
}

const IOS_SDK_REPO_URL = "https://github.com/Nights-Are-Late/resolvekit-ios-sdk";

export default function Functions() {
  const { appId } = useParams();
  const { toast } = useToast();
  const { refresh } = useOnboarding();
  const [functions, setFunctions] = useState<Fn[] | null>(null);
  const [loadedAppId, setLoadedAppId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState("");
  const [openSchemas, setOpenSchemas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;

    api<Fn[]>(`/v1/apps/${appId}/functions`)
      .then((data) => {
        if (cancelled) return;
        setFunctions(data);
        setLoadedAppId(appId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFunctions([]);
        setLoadedAppId(appId);
        toast(err instanceof ApiError ? err.detail : "Failed to load functions", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [appId, toast]);

  async function toggleActive(fn: Fn) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !fn.is_active }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
      toast(
        `${fn.name} ${updated.is_active ? "activated" : "deactivated"}`,
        "success"
      );
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update function", "error");
    }
  }

  function startEditOverride(fn: Fn) {
    setEditingId(fn.id);
    setOverrideText(fn.description_override || "");
  }

  async function saveOverride(fn: Fn) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description_override: overrideText || null }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
      setEditingId(null);
      toast("Description override saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save override", "error");
    }
  }

  async function clearOverride(fn: Fn) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description_override: null }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
      setEditingId(null);
      toast("Override cleared", "info");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to clear override", "error");
    }
  }

  function toggleSchema(id: string) {
    setOpenSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!appId) return null;

  const isLoading = loadedAppId !== appId || functions === null;
  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">
            Registered Functions
          </h1>
          <p className="text-sm text-subtle mt-1">
            Functions registered by the iOS SDK. Toggle visibility and override descriptions.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {functions.map((fn) => (
          <div
            key={fn.id}
            className={`glass-panel rounded-xl p-4 transition-opacity ${
              !fn.is_active ? "opacity-50" : ""
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-subtle border border-accent-dim flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-mono font-medium">fn</span>
                </div>
                <div>
                  <span className="font-mono text-sm font-medium text-strong">
                    {fn.name}
                  </span>
                  <span className="ml-2.5">
                    <Badge variant={fn.is_active ? "active" : "inactive"} dot>
                      {fn.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(fn)}
              >
                {fn.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>

            {/* SDK description */}
            <div className="mb-3">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">
                SDK Description
              </p>
              <p className="text-sm text-dim">{fn.description}</p>
            </div>

            {/* Override section */}
            {editingId === fn.id ? (
              <div className="bg-surface-2 border border-border rounded-lg p-3 mb-3">
                <Textarea
                  label="LLM Description Override"
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  rows={3}
                  placeholder="Override the description the LLM sees..."
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => saveOverride(fn)}
                  >
                    Save
                  </Button>
                  {fn.description_override && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => clearOverride(fn)}
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                {fn.description_override ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 bg-accent-subtle border border-accent-dim rounded-lg px-3 py-2">
                      <p className="text-xs text-accent uppercase tracking-wider mb-1">
                        LLM Override
                      </p>
                      <p className="text-sm text-body">{fn.description_override}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditOverride(fn)}
                      className="mt-1"
                    >
                      Edit
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditOverride(fn)}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    + Add description override
                  </button>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-4 text-xs text-muted">
              <span>Timeout: {fn.timeout_seconds}s</span>
              {Object.keys(fn.parameters_schema).length > 0 && (
                <button
                  onClick={() => toggleSchema(fn.id)}
                  className="flex items-center gap-1 text-subtle hover:text-body transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${
                      openSchemas.has(fn.id) ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Parameters schema
                </button>
              )}
            </div>

            {openSchemas.has(fn.id) && (
              <pre className="mt-3 bg-canvas border border-border rounded-lg p-3 text-xs text-dim font-mono overflow-auto max-h-48">
                {JSON.stringify(fn.parameters_schema, null, 2)}
              </pre>
            )}
          </div>
        ))}

        {functions.length === 0 && (
          <div className="text-center py-16 text-subtle">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
              <span className="font-mono text-muted text-sm">fn</span>
            </div>
            <p className="text-sm">No functions registered yet.</p>
            <p className="text-xs mt-2 text-muted">
              Open your iOS app with SDK + API key configured to register functions here.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.open(IOS_SDK_REPO_URL, "_blank", "noopener,noreferrer")}
            >
              Open iOS SDK GitHub repo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
