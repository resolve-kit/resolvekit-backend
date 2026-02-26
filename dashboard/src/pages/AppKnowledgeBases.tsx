import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Button, useToast } from "../components/ui";
import OnboardingTipCard from "../components/OnboardingTipCard";

interface KnowledgeBaseItem {
  id: string;
  name: string;
}

interface AppSummary {
  id: string;
  name: string;
}

export default function AppKnowledgeBases() {
  const { appId } = useParams<{ appId: string }>();
  const [appName, setAppName] = useState("");
  const [allKnowledgeBases, setAllKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const selectedSet = useMemo(() => new Set(selectedKnowledgeBaseIds), [selectedKnowledgeBaseIds]);

  useEffect(() => {
    if (!appId) return;
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [app, kbList, assigned] = await Promise.all([
          api<AppSummary>(`/v1/apps/${appId}`),
          api<{ items: KnowledgeBaseItem[] }>("/v1/knowledge-bases"),
          api<{ items: KnowledgeBaseItem[] }>(`/v1/apps/${appId}/knowledge-bases`),
        ]);
        if (isCancelled) return;
        setAppName(app.name);
        setAllKnowledgeBases(kbList.items ?? []);
        setSelectedKnowledgeBaseIds((assigned.items ?? []).map((item) => item.id));
      } catch (err: unknown) {
        if (!isCancelled) {
          toast(err instanceof ApiError ? err.detail : "Failed to load knowledge base assignments", "error");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isCancelled = true;
    };
  }, [appId]);

  if (!appId) return null;

  async function saveAssignments() {
    setIsSaving(true);
    try {
      await api(`/v1/apps/${appId}/knowledge-bases`, {
        method: "PUT",
        body: JSON.stringify({ knowledge_base_ids: selectedKnowledgeBaseIds }),
      });
      toast("Knowledge base assignments updated", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save assignments", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleKb(kbId: string) {
    setSelectedKnowledgeBaseIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold text-strong">App Knowledge Bases</h1>
        <p className="text-sm text-subtle mt-1">
          {appName ? `${appName}: select which knowledge bases the session agent can query.` : "Loading app..."}
        </p>
      </div>
      <OnboardingTipCard tipId="knowledge_bases_tip" fallbackRoute={`/apps/${appId}/knowledge-bases`} />

      <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-strong mb-3">Assigned Knowledge Bases</h2>
        {isLoading ? (
          <p className="text-xs text-subtle">Loading...</p>
        ) : allKnowledgeBases.length === 0 ? (
          <p className="text-xs text-subtle">No knowledge bases exist yet. Create one in the Knowledge Bases section.</p>
        ) : (
          <div className="space-y-2">
            {allKnowledgeBases.map((kb) => (
              <label
                key={kb.id}
                className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-sm text-strong">{kb.name}</p>
                  <p className="text-[11px] text-dim font-mono">{kb.id.slice(0, 8)}...</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedSet.has(kb.id)}
                  onChange={() => toggleKb(kb.id)}
                  className="w-4 h-4 accent-accent"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button loading={isSaving} onClick={saveAssignments}>
            Save Assignments
          </Button>
        </div>
      </div>
    </div>
  );
}
