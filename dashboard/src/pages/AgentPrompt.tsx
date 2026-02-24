import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Button, PageSpinner, Textarea, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Config {
  system_prompt: string;
}

export default function AgentPrompt() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = saved !== null && draft !== saved;

  useEffect(() => {
    api<Config>(`/v1/apps/${appId}/config`).then((config) => {
      setSaved(config.system_prompt);
      setDraft(config.system_prompt);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("agent");
    else markClean("agent");
    return () => markClean("agent");
  }, [isDirty, markDirty, markClean]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify({ system_prompt: draft }),
      });
      setSaved(updated.system_prompt);
      setDraft(updated.system_prompt);
      toast("Agent prompt saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (saved === null) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">Agent Prompt</h1>
        <p className="text-sm text-subtle mt-1">
          System prompt sent to the LLM at the start of every session.
        </p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6">
        <Textarea
          label="System Prompt"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder="You are a helpful iOS app assistant..."
        />
        <p className="text-xs text-muted mt-1.5 text-right">{draft.length} characters</p>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save Prompt
          </Button>
        </div>
      </form>
    </div>
  );
}
