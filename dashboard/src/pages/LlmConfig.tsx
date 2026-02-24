import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Badge, Button, PageSpinner, Select, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Config {
  llm_profile_id: string | null;
  llm_profile_name: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  has_llm_api_key: boolean;
}

interface OrganizationLlmProfile {
  id: string;
  name: string;
  provider: string;
  model: string;
  has_api_key: boolean;
  api_base: string | null;
  updated_at: string;
}

export default function LlmConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Config | null>(null);
  const [draftProfileId, setDraftProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<OrganizationLlmProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = saved !== null && draftProfileId !== saved.llm_profile_id;

  useEffect(() => {
    Promise.all([
      api<Config>(`/v1/apps/${appId}/config`),
      api<OrganizationLlmProfile[]>("/v1/organizations/llm-profiles"),
    ]).then(([config, llmProfiles]) => {
      setSaved(config);
      setDraftProfileId(config.llm_profile_id);
      setProfiles(llmProfiles);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("llm");
    else markClean("llm");
    return () => markClean("llm");
  }, [isDirty, markDirty, markClean]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === draftProfileId) ?? null,
    [profiles, draftProfileId]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify({ llm_profile_id: draftProfileId }),
      });
      setSaved(updated);
      setDraftProfileId(updated.llm_profile_id);
      toast("LLM profile selection saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!saved) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">LLM Provider</h1>
        <p className="text-sm text-subtle mt-1">
          Choose which organization-level LLM profile this app uses at runtime.
        </p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            Profiles are managed at the organization level so multiple apps can share secure provider settings.
          </p>
          <Link
            to="/organization"
            className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-subtle hover:text-body hover:border-border-2 transition-colors"
          >
            Manage Profiles
          </Link>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-lg border border-warning-dim bg-warning-subtle px-3 py-2 text-sm text-warning">
            No organization LLM profiles found. Create one in Organization Admin first.
          </div>
        ) : (
          <Select
            label="Organization LLM Profile"
            value={draftProfileId || ""}
            onChange={(e) => setDraftProfileId(e.target.value || null)}
          >
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.provider}/{profile.model}
              </option>
            ))}
          </Select>
        )}

        {selectedProfile && (
          <div className="rounded-lg border border-border bg-canvas/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-strong">{selectedProfile.name}</p>
                <p className="text-xs text-subtle mt-0.5">
                  {selectedProfile.provider}/{selectedProfile.model}
                </p>
                {selectedProfile.api_base && (
                  <p className="text-xs text-dim font-mono mt-1">{selectedProfile.api_base}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="active" dot={selectedProfile.has_api_key}>API Key {selectedProfile.has_api_key ? "Set" : "Missing"}</Badge>
                <Badge variant="default">Updated {new Date(selectedProfile.updated_at).toLocaleDateString()}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-border">
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save LLM Config
          </Button>
        </div>
      </form>
    </div>
  );
}
