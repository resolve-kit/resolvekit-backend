import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Button, Input, PageSpinner, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Limits {
  temperature: number;
  max_tokens: number;
  max_tool_rounds: number;
  session_ttl_minutes: number;
  max_context_messages: number;
}

export default function LimitsConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Limits | null>(null);
  const [draft, setDraft] = useState<Limits | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft);

  useEffect(() => {
    api<Limits>(`/v1/apps/${appId}/config`).then((config) => {
      const limits: Limits = {
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        max_tool_rounds: config.max_tool_rounds,
        session_ttl_minutes: config.session_ttl_minutes,
        max_context_messages: config.max_context_messages,
      };
      setSaved(limits);
      setDraft(limits);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("limits");
    else markClean("limits");
    return () => markClean("limits");
  }, [isDirty, markDirty, markClean]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    try {
      const updated = await api<Limits>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      const limits: Limits = {
        temperature: updated.temperature,
        max_tokens: updated.max_tokens,
        max_tool_rounds: updated.max_tool_rounds,
        session_ttl_minutes: updated.session_ttl_minutes,
        max_context_messages: updated.max_context_messages,
      };
      setSaved(limits);
      setDraft(limits);
      toast("Limits saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function set(field: keyof Limits, value: number) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  if (!draft || !saved) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">Runtime Limits</h1>
        <p className="text-sm text-subtle mt-1">Control sampling parameters and session constraints.</p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <label className="text-xs font-medium text-subtle block mb-1.5">
            Temperature
            <span className="ml-2 font-mono text-body">{draft.temperature.toFixed(1)}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value))}
              className="flex-1 accent-accent"
            />
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value))}
              className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-body text-center focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Max Tokens"
            type="number"
            value={draft.max_tokens}
            onChange={(e) => set("max_tokens", parseInt(e.target.value, 10))}
          />
          <Input
            label="Max Tool Rounds"
            type="number"
            value={draft.max_tool_rounds}
            onChange={(e) => set("max_tool_rounds", parseInt(e.target.value, 10))}
          />
          <Input
            label="Session TTL (minutes)"
            type="number"
            value={draft.session_ttl_minutes}
            onChange={(e) => set("session_ttl_minutes", parseInt(e.target.value, 10))}
          />
          <Input
            label="Max Context Messages"
            type="number"
            value={draft.max_context_messages}
            onChange={(e) => set("max_context_messages", parseInt(e.target.value, 10))}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save Limits
          </Button>
        </div>
      </form>
    </div>
  );
}
