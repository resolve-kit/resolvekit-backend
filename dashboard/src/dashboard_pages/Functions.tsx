import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Badge, Button, EmptyState, Textarea, useToast } from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";
import { iosSdkRepoUrl } from "../lib/public-urls";

type FnSeverity = "read" | "write" | "destructive";

interface Fn {
  id: string;
  name: string;
  description: string;
  description_override: string | null;
  parameters_schema: Record<string, unknown>;
  is_active: boolean;
  timeout_seconds: number;
  severity: FnSeverity;
  source: string;
  pack_name: string | null;
}

interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  required?: boolean;
}

function parseParams(schema: Record<string, unknown>): Array<{ name: string; required: boolean } & SchemaProperty> {
  const props = (schema.properties ?? {}) as Record<string, SchemaProperty>;
  const required = (schema.required ?? []) as string[];
  return Object.entries(props).map(([name, def]) => ({
    name,
    required: required.includes(name),
    ...def,
  }));
}

function ParamTable({ schema }: { schema: Record<string, unknown> }) {
  const params = parseParams(schema);
  if (params.length === 0) {
    return <p className="text-[12px] text-muted py-2">No parameters defined.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="grid border-b border-border bg-surface-2 px-3.5 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted"
        style={{ gridTemplateColumns: "1fr 90px 60px 1.6fr" }}
      >
        <span>Name</span>
        <span>Type</span>
        <span>Req</span>
        <span>Description</span>
      </div>
      {params.map((p) => (
        <div
          key={p.name}
          className="grid border-t border-border px-3.5 py-3"
          style={{ gridTemplateColumns: "1fr 90px 60px 1.6fr" }}
        >
          <span className="font-mono text-[13px] font-semibold text-strong">
            {p.name}
            {p.required && <span className="ml-0.5 text-danger">*</span>}
          </span>
          <span className="font-mono text-[11.5px] text-subtle">{p.type ?? "any"}</span>
          <span className={`font-mono text-[10.5px] font-bold tracking-[0.04em] ${p.required ? "text-danger" : "text-muted"}`}>
            {p.required ? "req" : "opt"}
          </span>
          <div>
            <p className="text-[12.5px] leading-[1.5] text-dim">{p.description ?? "—"}</p>
            {p.default !== undefined && (
              <p className="mt-1 font-mono text-[11px] text-muted">default: {JSON.stringify(p.default)}</p>
            )}
            {p.enum && (
              <p className="mt-1 font-mono text-[11px] text-muted">enum: {p.enum.map((v) => JSON.stringify(v)).join(", ")}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const SEVERITY_ICON_CLASS: Record<FnSeverity, string> = {
  read: "border-border bg-surface-2 text-subtle",
  write: "border-accent-dim bg-accent-subtle text-accent",
  destructive: "border-danger-dim bg-danger-subtle text-danger",
};

function FunctionRow({ fn, onToggle, onSaveOverride, onClearOverride, onSeverityChange }: {
  fn: Fn;
  onToggle: () => Promise<void>;
  onSaveOverride: (text: string) => Promise<void>;
  onClearOverride: () => Promise<void>;
  onSeverityChange: (s: FnSeverity) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [overrideText, setOverrideText] = useState(fn.description_override ?? "");
  const [showParams, setShowParams] = useState(false);
  const paramCount = Object.keys((fn.parameters_schema.properties ?? {}) as object).length;
  const isPack = fn.source === "playbook_pack";

  return (
    <div className={`border-b border-border last:border-0 transition-opacity ${fn.is_active ? "" : "opacity-60"}`}>
      {/* Main row */}
      <div
        className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-surface-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Severity-tinted icon */}
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border ${SEVERITY_ICON_CLASS[fn.severity ?? "read"]}`}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M3 2a1 1 0 0 0-1 1v1.586a1 1 0 0 0 .293.707l4 4a1 1 0 0 1 .293.707V12l2 2V9.586a1 1 0 0 1 .293-.707l4-4A1 1 0 0 0 13 4.586V3a1 1 0 0 0-1-1H3Z" />
          </svg>
        </div>

        {/* Name + desc */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-strong">{fn.name}</span>
            {/* Origin pill */}
            {isPack ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-dim bg-accent-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M6 1 1 3.5v5L6 11l5-2.5v-5L6 1Zm0 1.236 3.5 1.75v3.528L6 9.764 2.5 7.514V3.986L6 2.236Z"/></svg>
                {fn.pack_name ?? "pack"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-success-dim bg-success-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-success">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M2 2h8v1H2V2Zm0 4h8v1H2V6Zm0 4h8v1H2v-1Z"/></svg>
                inline
              </span>
            )}
          </div>
          <div className="mt-0.5 max-w-[64ch] truncate text-[12.5px] text-dim">
            {fn.description_override ?? fn.description}
          </div>
        </div>

        {/* Right meta */}
        <div className="flex flex-shrink-0 items-center gap-4">
          {paramCount > 0 && (
            <div className="text-right">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted">Params</div>
              <div className="font-mono text-[11.5px] font-semibold text-strong">{paramCount}</div>
            </div>
          )}
          <Badge variant={fn.is_active ? "active" : "inactive"} dot>
            {fn.is_active ? "Active" : "Inactive"}
          </Badge>
          <svg
            className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4" style={{ background: "linear-gradient(180deg, var(--color-surface-2,#edf4fb), var(--color-surface,#fff))" }}>
          {/* Meta strip */}
          <div className="mb-4 flex gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Timeout</div>
              <div className="mt-0.5 font-mono text-[12.5px] font-semibold text-strong">{fn.timeout_seconds}s</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">ID</div>
              <div className="mt-0.5 font-mono text-[11px] text-subtle truncate max-w-[240px]">{fn.id}</div>
            </div>
          </div>

          {/* desc-stack: SDK default + operator override in one bordered container */}
          {editing ? (
            <div className="mb-4 rounded-lg border border-border bg-surface p-4">
              <Textarea
                label="LLM Description Override"
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                rows={3}
                placeholder="Override the description the LLM sees…"
              />
              <div className="mt-3 flex gap-2">
                <Button variant="primary" size="sm" onClick={async () => { await onSaveOverride(overrideText); setEditing(false); }}>
                  Save
                </Button>
                {fn.description_override && (
                  <Button variant="danger" size="sm" onClick={async () => { await onClearOverride(); setEditing(false); }}>
                    Clear
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="mb-4 overflow-hidden rounded-[10px] border border-border">
              {/* SDK row */}
              <div className="flex gap-3.5 border-b border-border bg-surface-2 px-3.5 py-2.5">
                <span className="w-[88px] flex-shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted">SDK</span>
                <p className="text-[13px] leading-[1.55] text-body">{fn.description}</p>
              </div>
              {/* Override row */}
              {fn.description_override ? (
                <div className="flex gap-3.5 bg-accent-subtle px-3.5 py-2.5">
                  <span className="w-[88px] flex-shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Override</span>
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <p className="text-[13px] leading-[1.55] text-body">{fn.description_override}</p>
                    <Button variant="ghost" size="sm" onClick={() => { setOverrideText(fn.description_override ?? ""); setEditing(true); }}>
                      Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3.5 px-3.5 py-2">
                  <span className="w-[88px] flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Override</span>
                  <button
                    onClick={() => { setOverrideText(""); setEditing(true); }}
                    className="text-[12.5px] text-accent hover:text-accent-hover transition-colors"
                  >
                    + Add override
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Parameter schema */}
          {paramCount > 0 && (
            <div>
              <button
                onClick={() => setShowParams((v) => !v)}
                className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-subtle hover:text-body transition-colors"
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${showParams ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                Parameters ({paramCount})
              </button>
              {showParams && <ParamTable schema={fn.parameters_schema} />}
            </div>
          )}

          {/* Severity + actions row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Severity</span>
              <div className="inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-surface-2 p-[3px]">
                {(["read", "write", "destructive"] as FnSeverity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { void onSeverityChange(s); }}
                    className={`rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 capitalize ${
                      (fn.severity ?? "read") === s
                        ? s === "destructive"
                          ? "bg-danger-subtle text-danger shadow-sm"
                          : s === "write"
                          ? "bg-accent-subtle text-accent shadow-sm"
                          : "bg-surface text-strong shadow-sm"
                        : "text-subtle hover:text-body"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <Button variant={fn.is_active ? "outline" : "primary"} size="sm" onClick={onToggle}>
              {fn.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Functions() {
  const { appId } = useParams();
  const { toast } = useToast();
  const { refresh } = useOnboarding();
  const [functions, setFunctions] = useState<Fn[] | null>(null);
  const [loadedAppId, setLoadedAppId] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    api<Fn[]>(`/v1/apps/${appId}/functions`)
      .then((data) => { if (!cancelled) { setFunctions(data); setLoadedAppId(appId); } })
      .catch((err: unknown) => {
        if (!cancelled) { setFunctions([]); setLoadedAppId(appId); }
        toast(err instanceof ApiError ? err.detail : "Failed to load functions", "error");
      });
    return () => { cancelled = true; };
  }, [appId, toast]);

  async function toggleActive(fn: Fn) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !fn.is_active }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
      toast(`${fn.name} ${updated.is_active ? "activated" : "deactivated"}`, "success");
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update function", "error");
    }
  }

  async function saveOverride(fn: Fn, text: string) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description_override: text || null }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
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
      toast("Override cleared", "info");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to clear override", "error");
    }
  }

  async function saveSeverity(fn: Fn, severity: FnSeverity) {
    try {
      const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ severity }),
      });
      setFunctions((prev) => prev?.map((f) => (f.id === fn.id ? updated : f)) ?? prev);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update severity", "error");
    }
  }

  if (!appId) return null;
  if (loadedAppId !== appId || functions === null) {
    return (
      <div>
        <div className="glass-panel mb-5 flex items-center justify-between rounded-2xl px-5 py-4">
          <div className="space-y-2">
            <div className="skeleton h-6 w-32 rounded-lg" />
            <div className="skeleton h-4 w-56 rounded-md" />
          </div>
          <div className="skeleton h-4 w-20 rounded-md" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}>
              <div className="skeleton h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-40 rounded-md" />
                <div className="skeleton h-3 w-64 rounded-md" />
              </div>
              <div className="skeleton h-6 w-16 rounded-full" />
              <div className="skeleton h-7 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="glass-panel mb-5 flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-strong">Functions</h1>
          <p className="mt-0.5 text-sm text-subtle">Registered by the SDK. Toggle and override descriptions per-app.</p>
        </div>
        <div className="font-mono text-[11px] text-muted">{functions.length} registered</div>
      </div>

      {functions.length === 0 ? (
        <EmptyState
          title="No functions registered"
          description="Open your app with the SDK + API key configured to register functions here."
          action={
            iosSdkRepoUrl ? (
              <Button variant="outline" size="sm" onClick={() => window.open(iosSdkRepoUrl!, "_blank", "noopener,noreferrer")}>
                iOS SDK on GitHub
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {functions.map((fn) => (
            <FunctionRow
              key={fn.id}
              fn={fn}
              onToggle={() => toggleActive(fn)}
              onSaveOverride={(text) => saveOverride(fn, text)}
              onClearOverride={() => clearOverride(fn)}
              onSeverityChange={(s) => saveSeverity(fn, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
