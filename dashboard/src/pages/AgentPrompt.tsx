import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Button, PageSpinner, Textarea, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

type ScopeMode = "open" | "strict";

interface Config {
  system_prompt: string;
  scope_mode: ScopeMode;
}

export default function AgentPrompt() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    saved !== null &&
    draft !== null &&
    (draft.system_prompt !== saved.system_prompt ||
      draft.scope_mode !== saved.scope_mode);

  useEffect(() => {
    api<Config & { scope_mode?: ScopeMode }>(`/v1/apps/${appId}/config`).then(
      (config) => {
        const normalized: Config = {
          system_prompt: config.system_prompt,
          scope_mode: config.scope_mode ?? "strict",
        };
        setSaved(normalized);
        setDraft(normalized);
      }
    );
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("agent");
    else markClean("agent");
    return () => markClean("agent");
  }, [isDirty, markDirty, markClean]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    try {
      const updated = await api<Config & { scope_mode?: ScopeMode }>(
        `/v1/apps/${appId}/config`,
        {
          method: "PUT",
          body: JSON.stringify({
            system_prompt: draft.system_prompt,
            scope_mode: draft.scope_mode,
          }),
        }
      );
      const normalized: Config = {
        system_prompt: updated.system_prompt,
        scope_mode: updated.scope_mode ?? "strict",
      };
      setSaved(normalized);
      setDraft(normalized);
      toast("Agent settings saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!saved || !draft) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">
          Agent Prompt
        </h1>
        <p className="text-sm text-subtle mt-1">
          Configure the system prompt and scope behavior used for every chat
          turn.
        </p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-xl p-6"
      >
        <Textarea
          label="System Prompt"
          value={draft.system_prompt}
          onChange={(e) =>
            setDraft({ ...draft, system_prompt: e.target.value })
          }
          rows={10}
          placeholder="You are a helpful assistant for this product..."
        />
        <p className="text-xs text-muted mt-1.5 text-right">
          {draft.system_prompt.length} characters
        </p>

        <div className="mt-5">
          <label className="text-xs font-medium text-subtle block mb-2">
            Scope Mode
          </label>
          <div className="flex gap-6 flex-wrap">
            {(["open", "strict"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope_mode"
                  value={mode}
                  checked={draft.scope_mode === mode}
                  onChange={() => setDraft({ ...draft, scope_mode: mode })}
                  className="accent-accent"
                />
                <span className="text-sm text-body capitalize">{mode}</span>
                <span className="text-xs text-subtle ml-1">
                  {mode === "open"
                    ? "- agent can answer any question"
                    : "- only answers app-related questions"}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-subtle mt-1.5">
            In strict mode, the agent politely declines questions unrelated to
            your app.
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={!isDirty}
          >
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
