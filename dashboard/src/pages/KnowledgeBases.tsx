import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  embedding_profile_id: string | null;
  embedding_profile_name: string | null;
  pending_embedding_profile_id: string | null;
  embedding_regeneration_status: string;
  embedding_regeneration_error: string | null;
  created_at: string;
  updated_at: string;
}

interface EmbeddingProfile {
  id: string;
  organization_id: string;
  name: string;
  provider: string;
  model: string;
  api_base: string | null;
  updated_at: string;
  created_at: string;
}

interface ImpactResponse {
  kb_count: number;
  doc_count: number;
  chunk_count: number;
  estimated_tokens: number;
  estimate_available: boolean;
}

interface KnowledgeSource {
  id: string;
  source_type: "url" | "upload";
  input_url: string | null;
  title: string | null;
  status: string;
  last_crawled_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface KnowledgeJob {
  id: string;
  status: string;
  job_type: string;
  error: string | null;
  stats: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

interface KnowledgeDocument {
  id: string;
  title: string | null;
  canonical_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SearchHit {
  document_id: string;
  title: string | null;
  url: string | null;
  snippet: string;
  score: number;
}

type ConfirmAction =
  | {
      kind: "kb-embedding-change";
      kbId: string;
      embeddingProfileId: string;
      impact: ImpactResponse;
    }
  | {
      kind: "profile-update";
      profileId: string;
      payload: {
        name: string;
        provider: string;
        model: string;
        api_key: string | null;
        api_base: string | null;
      };
      impact: ImpactResponse;
    }
  | null;

function estimateLabel(impact: ImpactResponse): string {
  if (!impact.estimate_available) {
    return "Cost estimate unavailable";
  }
  return `Estimated tokens to regenerate: ${impact.estimated_tokens.toLocaleString()}`;
}

export default function KnowledgeBases() {
  const [kbs, setKbs] = useState<KnowledgeBaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [embeddingProfiles, setEmbeddingProfiles] = useState<EmbeddingProfile[]>([]);
  const [embeddingLoading, setEmbeddingLoading] = useState(true);

  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileProvider, setNewProfileProvider] = useState("openai");
  const [newProfileModel, setNewProfileModel] = useState("");
  const [newProfileApiKey, setNewProfileApiKey] = useState("");
  const [newProfileApiBase, setNewProfileApiBase] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileProvider, setEditProfileProvider] = useState("");
  const [editProfileModel, setEditProfileModel] = useState("");
  const [editProfileApiBase, setEditProfileApiBase] = useState("");
  const [editProfileApiKey, setEditProfileApiKey] = useState("");
  const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false);

  const [newKbName, setNewKbName] = useState("");
  const [newKbDescription, setNewKbDescription] = useState("");
  const [newKbEmbeddingProfileId, setNewKbEmbeddingProfileId] = useState("");
  const [isCreatingKb, setIsCreatingKb] = useState(false);

  const [kbEmbeddingDraftId, setKbEmbeddingDraftId] = useState("");
  const [isUpdatingKbEmbedding, setIsUpdatingKbEmbedding] = useState(false);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [jobs, setJobs] = useState<KnowledgeJob[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);

  const [newUrl, setNewUrl] = useState("");
  const [newUrlTitle, setNewUrlTitle] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const { toast } = useToast();

  const selectedKb = useMemo(
    () => kbs.find((kb) => kb.id === selectedId) ?? null,
    [kbs, selectedId]
  );

  const selectedEmbeddingProfile = useMemo(
    () => embeddingProfiles.find((profile) => profile.id === kbEmbeddingDraftId) ?? null,
    [embeddingProfiles, kbEmbeddingDraftId]
  );

  async function loadEmbeddingProfiles() {
    setEmbeddingLoading(true);
    try {
      const payload = await api<{ items: EmbeddingProfile[] }>("/v1/organizations/embedding-profiles");
      const items = payload.items ?? [];
      setEmbeddingProfiles(items);
      setNewKbEmbeddingProfileId((prev) => prev || items[0]?.id || "");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load embedding profiles", "error");
    } finally {
      setEmbeddingLoading(false);
    }
  }

  async function loadKnowledgeBases() {
    setIsLoading(true);
    try {
      const payload = await api<{ items: KnowledgeBaseItem[] }>("/v1/knowledge-bases");
      const items = payload.items ?? [];
      setKbs(items);
      setSelectedId((prev) => prev ?? items[0]?.id ?? null);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load knowledge bases", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadKbDetails(kbId: string) {
    try {
      const [sourcesPayload, jobsPayload, docsPayload] = await Promise.all([
        api<{ items: KnowledgeSource[] }>(`/v1/knowledge-bases/${kbId}/sources`),
        api<{ items: KnowledgeJob[] }>(`/v1/knowledge-bases/${kbId}/jobs`),
        api<{ items: KnowledgeDocument[] }>(`/v1/knowledge-bases/${kbId}/documents?limit=100`),
      ]);
      setSources(sourcesPayload.items ?? []);
      setJobs(jobsPayload.items ?? []);
      setDocuments(docsPayload.items ?? []);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load KB details", "error");
    }
  }

  useEffect(() => {
    void Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases()]);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSources([]);
      setJobs([]);
      setDocuments([]);
      return;
    }
    void loadKbDetails(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedKb) {
      setKbEmbeddingDraftId("");
      return;
    }
    setKbEmbeddingDraftId(selectedKb.embedding_profile_id || "");
  }, [selectedKb?.id, selectedKb?.embedding_profile_id]);

  async function createEmbeddingProfile() {
    if (!newProfileName.trim() || !newProfileProvider.trim() || !newProfileModel.trim() || !newProfileApiKey.trim()) {
      return;
    }

    setIsCreatingProfile(true);
    try {
      await api("/v1/organizations/embedding-profiles", {
        method: "POST",
        body: JSON.stringify({
          name: newProfileName.trim(),
          provider: newProfileProvider.trim(),
          model: newProfileModel.trim(),
          api_key: newProfileApiKey.trim(),
          api_base: newProfileApiBase.trim() || null,
        }),
      });
      setNewProfileName("");
      setNewProfileModel("");
      setNewProfileApiKey("");
      setNewProfileApiBase("");
      toast("Embedding profile created", "success");
      await Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases()]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create embedding profile", "error");
    } finally {
      setIsCreatingProfile(false);
    }
  }

  function startEditingProfile(profile: EmbeddingProfile) {
    setEditingProfileId(profile.id);
    setEditProfileName(profile.name);
    setEditProfileProvider(profile.provider);
    setEditProfileModel(profile.model);
    setEditProfileApiBase(profile.api_base || "");
    setEditProfileApiKey("");
  }

  async function deleteEmbeddingProfile(profileId: string) {
    setDeletingProfileId(profileId);
    try {
      await api(`/v1/organizations/embedding-profiles/${profileId}`, {
        method: "DELETE",
      });
      toast("Embedding profile removed", "info");
      await Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases()]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to delete embedding profile", "error");
    } finally {
      setDeletingProfileId(null);
    }
  }

  async function saveEmbeddingProfileEdit() {
    if (!editingProfileId) return;

    const original = embeddingProfiles.find((profile) => profile.id === editingProfileId);
    if (!original) return;

    const payload = {
      name: editProfileName.trim(),
      provider: editProfileProvider.trim(),
      model: editProfileModel.trim(),
      api_key: editProfileApiKey.trim() || null,
      api_base: editProfileApiBase.trim() || null,
    };

    const behaviorChanged =
      payload.provider !== original.provider ||
      payload.model !== original.model ||
      payload.api_base !== (original.api_base || null);

    if (behaviorChanged) {
      try {
        const impact = await api<ImpactResponse>(
          `/v1/organizations/embedding-profiles/${editingProfileId}/change-impact`,
          {
            method: "POST",
            body: JSON.stringify({
              provider: payload.provider,
              model: payload.model,
              api_base: payload.api_base,
            }),
          }
        );
        if (impact.chunk_count > 0) {
          setConfirmAction({
            kind: "profile-update",
            profileId: editingProfileId,
            payload,
            impact,
          });
          return;
        }
      } catch (err: unknown) {
        toast(err instanceof ApiError ? err.detail : "Failed to estimate impact", "error");
        return;
      }
    }

    await applyEmbeddingProfileUpdate(editingProfileId, payload, false);
  }

  async function applyEmbeddingProfileUpdate(
    profileId: string,
    payload: {
      name: string;
      provider: string;
      model: string;
      api_key: string | null;
      api_base: string | null;
    },
    confirmRegeneration: boolean
  ) {
    setIsSavingProfileEdit(true);
    try {
      await api(`/v1/organizations/embedding-profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          confirm_regeneration: confirmRegeneration,
        }),
      });
      setEditingProfileId(null);
      setEditProfileApiKey("");
      toast("Embedding profile updated", "success");
      await Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases()]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update embedding profile", "error");
    } finally {
      setIsSavingProfileEdit(false);
    }
  }

  async function createKnowledgeBase() {
    if (!newKbName.trim() || !newKbEmbeddingProfileId) return;
    setIsCreatingKb(true);
    try {
      await api("/v1/knowledge-bases", {
        method: "POST",
        body: JSON.stringify({
          name: newKbName.trim(),
          description: newKbDescription.trim() || null,
          embedding_profile_id: newKbEmbeddingProfileId,
        }),
      });
      setNewKbName("");
      setNewKbDescription("");
      toast("Knowledge base created", "success");
      await loadKnowledgeBases();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create knowledge base", "error");
    } finally {
      setIsCreatingKb(false);
    }
  }

  async function deleteKnowledgeBase(id: string) {
    try {
      await api(`/v1/knowledge-bases/${id}`, { method: "DELETE" });
      toast("Knowledge base deleted", "info");
      if (selectedId === id) {
        setSelectedId(null);
      }
      await loadKnowledgeBases();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to delete knowledge base", "error");
    }
  }

  async function requestKbEmbeddingChange() {
    if (!selectedKb || !kbEmbeddingDraftId || kbEmbeddingDraftId === selectedKb.embedding_profile_id) return;

    try {
      const impact = await api<ImpactResponse>(`/v1/knowledge-bases/${selectedKb.id}/embedding-change-impact`, {
        method: "POST",
        body: JSON.stringify({ embedding_profile_id: kbEmbeddingDraftId }),
      });

      if (impact.chunk_count > 0) {
        setConfirmAction({
          kind: "kb-embedding-change",
          kbId: selectedKb.id,
          embeddingProfileId: kbEmbeddingDraftId,
          impact,
        });
        return;
      }

      await applyKbEmbeddingChange(selectedKb.id, kbEmbeddingDraftId, false);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to evaluate embedding change impact", "error");
    }
  }

  async function applyKbEmbeddingChange(kbId: string, embeddingProfileId: string, confirmRegeneration: boolean) {
    setIsUpdatingKbEmbedding(true);
    try {
      await api(`/v1/knowledge-bases/${kbId}`, {
        method: "PATCH",
        body: JSON.stringify({
          embedding_profile_id: embeddingProfileId,
          confirm_regeneration: confirmRegeneration,
        }),
      });
      toast(
        confirmRegeneration
          ? "Embedding regeneration queued. Existing vectors stay active until completed."
          : "Embedding profile updated",
        "success"
      );
      await Promise.all([loadKnowledgeBases(), loadKbDetails(kbId)]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update embedding profile", "error");
    } finally {
      setIsUpdatingKbEmbedding(false);
    }
  }

  async function addUrlSource() {
    if (!selectedId || !newUrl.trim()) return;
    setIsAddingUrl(true);
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/url`, {
        method: "POST",
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newUrlTitle.trim() || null,
        }),
      });
      setNewUrl("");
      setNewUrlTitle("");
      toast("Source added. Ingestion job queued.", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to add source URL", "error");
    } finally {
      setIsAddingUrl(false);
    }
  }

  async function addUploadSource() {
    if (!selectedId || !uploadTitle.trim() || !uploadContent.trim()) return;
    setIsUploading(true);
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/upload`, {
        method: "POST",
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent,
        }),
      });
      setUploadTitle("");
      setUploadContent("");
      toast("Content uploaded. Ingestion job queued.", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to upload knowledge content", "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function recrawlSource(sourceId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/${sourceId}/recrawl`, {
        method: "POST",
      });
      toast("Recrawl job queued", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to queue recrawl", "error");
    }
  }

  async function removeSource(sourceId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/${sourceId}`, {
        method: "DELETE",
      });
      toast("Source removed", "info");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to remove source", "error");
    }
  }

  async function runSearch() {
    if (!selectedId || !searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const payload = await api<{ items: SearchHit[] }>(`/v1/knowledge-bases/${selectedId}/search`, {
        method: "POST",
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: 10,
        }),
      });
      setSearchHits(payload.items ?? []);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to search knowledge base", "error");
    } finally {
      setIsSearching(false);
    }
  }

  async function removeDocument(documentId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/documents/${documentId}`, {
        method: "DELETE",
      });
      toast("Document removed", "info");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to remove document", "error");
    }
  }

  async function confirmRegenerationAction() {
    if (!confirmAction) return;

    if (confirmAction.kind === "kb-embedding-change") {
      await applyKbEmbeddingChange(confirmAction.kbId, confirmAction.embeddingProfileId, true);
      setConfirmAction(null);
      return;
    }

    if (confirmAction.kind === "profile-update") {
      await applyEmbeddingProfileUpdate(confirmAction.profileId, confirmAction.payload, true);
      setConfirmAction(null);
    }
  }

  const confirmTitle =
    confirmAction?.kind === "profile-update"
      ? "Regenerate Embeddings For Affected Knowledge Bases?"
      : "Regenerate Knowledge Base Embeddings?";

  const confirmDescription = confirmAction
    ? `This change will regenerate embeddings and may increase LLM/embedding usage costs. Affected: ${confirmAction.impact.kb_count} KB(s), ${confirmAction.impact.doc_count} documents, ${confirmAction.impact.chunk_count} chunks. ${estimateLabel(confirmAction.impact)}.`
    : "";

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Knowledge Bases</h1>
          <p className="text-sm text-subtle mt-1">
            Crawl docs, add support content, and assign reusable knowledge across apps.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up space-y-4">
        <h2 className="text-sm font-semibold text-strong">Embedding Profiles</h2>
        <p className="text-xs text-subtle">
          Configure organization-wide embedding provider/model profiles. Changing provider/model can trigger full vector regeneration.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Input
            label="Profile Name"
            placeholder="OpenAI Embeddings"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
          <Input
            label="Provider"
            placeholder="openai"
            value={newProfileProvider}
            onChange={(e) => setNewProfileProvider(e.target.value)}
          />
          <Input
            label="Model"
            placeholder="text-embedding-3-small"
            value={newProfileModel}
            onChange={(e) => setNewProfileModel(e.target.value)}
          />
          <Input
            label="API Key"
            type="password"
            placeholder="sk-..."
            value={newProfileApiKey}
            onChange={(e) => setNewProfileApiKey(e.target.value)}
          />
          <Input
            label="API Base (optional)"
            placeholder="https://api.example.com/v1"
            value={newProfileApiBase}
            onChange={(e) => setNewProfileApiBase(e.target.value)}
            mono
          />
          <div className="flex items-end">
            <Button className="w-full" loading={isCreatingProfile} onClick={createEmbeddingProfile}>
              Add
            </Button>
          </div>
        </div>

        {embeddingLoading ? (
          <p className="text-xs text-subtle">Loading embedding profiles...</p>
        ) : embeddingProfiles.length === 0 ? (
          <p className="text-xs text-subtle">No embedding profiles configured yet.</p>
        ) : (
          <div className="space-y-2">
            {embeddingProfiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                {editingProfileId === profile.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <Input
                      label="Name"
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                    />
                    <Input
                      label="Provider"
                      value={editProfileProvider}
                      onChange={(e) => setEditProfileProvider(e.target.value)}
                    />
                    <Input
                      label="Model"
                      value={editProfileModel}
                      onChange={(e) => setEditProfileModel(e.target.value)}
                    />
                    <Input
                      label="Rotate API Key (optional)"
                      type="password"
                      value={editProfileApiKey}
                      onChange={(e) => setEditProfileApiKey(e.target.value)}
                    />
                    <Input
                      label="API Base"
                      value={editProfileApiBase}
                      onChange={(e) => setEditProfileApiBase(e.target.value)}
                      mono
                    />
                    <div className="flex items-end gap-2">
                      <Button size="sm" loading={isSavingProfileEdit} onClick={saveEmbeddingProfileEdit}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingProfileId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-strong">{profile.name}</p>
                      <p className="text-xs text-subtle">
                        {profile.provider}/{profile.model}
                      </p>
                      {profile.api_base && <p className="text-xs text-dim font-mono truncate">{profile.api_base}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Updated {new Date(profile.updated_at).toLocaleDateString()}</Badge>
                      <Button size="sm" variant="outline" onClick={() => startEditingProfile(profile)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={deletingProfileId === profile.id}
                        onClick={() => {
                          void deleteEmbeddingProfile(profile.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-strong mb-3">Create Knowledge Base</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            label="Name"
            placeholder="iOS Support Docs"
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Troubleshooting and FAQ"
            value={newKbDescription}
            onChange={(e) => setNewKbDescription(e.target.value)}
          />
          <Select
            label="Embedding Profile"
            value={newKbEmbeddingProfileId}
            onChange={(e) => setNewKbEmbeddingProfileId(e.target.value)}
          >
            <option value="">Select profile</option>
            {embeddingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.provider}/{profile.model}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button className="w-full" loading={isCreatingKb} onClick={createKnowledgeBase}>
              Create
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-3">All Knowledge Bases</h2>
          {isLoading ? (
            <p className="text-xs text-subtle">Loading...</p>
          ) : kbs.length === 0 ? (
            <p className="text-xs text-subtle">No knowledge bases yet.</p>
          ) : (
            <div className="space-y-2">
              {kbs.map((kb) => (
                <div
                  key={kb.id}
                  className={`rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    selectedId === kb.id
                      ? "border-accent-dim bg-accent-subtle"
                      : "border-border bg-canvas/40 hover:border-border-2"
                  }`}
                  onClick={() => setSelectedId(kb.id)}
                >
                  <p className="text-sm text-strong">{kb.name}</p>
                  {kb.description && <p className="text-xs text-subtle mt-0.5">{kb.description}</p>}
                  <p className="text-[11px] text-subtle mt-1">
                    Embedding: {kb.embedding_profile_name || "Unassigned"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge
                      variant={
                        kb.embedding_regeneration_status === "failed"
                          ? "revoked"
                          : kb.embedding_regeneration_status === "pending" || kb.embedding_regeneration_status === "processing"
                          ? "live"
                          : "default"
                      }
                    >
                      {kb.embedding_regeneration_status}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteKnowledgeBase(kb.id);
                      }}
                      className="text-xs text-danger hover:text-danger/80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedKb ? (
            <>
              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-strong">{selectedKb.name}</h2>
                    <p className="text-xs text-subtle mt-1">{selectedKb.description || "No description"}</p>
                  </div>
                  <Badge variant="active">{sources.length} sources</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    label="Embedding Profile"
                    value={kbEmbeddingDraftId}
                    onChange={(e) => setKbEmbeddingDraftId(e.target.value)}
                  >
                    <option value="">Select profile</option>
                    {embeddingProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} · {profile.provider}/{profile.model}
                      </option>
                    ))}
                  </Select>
                  <div className="md:col-span-2 flex items-end">
                    <Button
                      loading={isUpdatingKbEmbedding}
                      onClick={() => {
                        void requestKbEmbeddingChange();
                      }}
                      disabled={!kbEmbeddingDraftId || kbEmbeddingDraftId === selectedKb.embedding_profile_id}
                    >
                      Apply Embedding Profile
                    </Button>
                  </div>
                </div>

                {selectedKb.embedding_regeneration_status !== "idle" && (
                  <div className="rounded-lg border border-warning-dim bg-warning-subtle px-3 py-2">
                    <p className="text-xs text-warning">
                      Embedding regeneration status: {selectedKb.embedding_regeneration_status}
                    </p>
                    {selectedKb.embedding_regeneration_error && (
                      <p className="text-xs text-danger mt-1">{selectedKb.embedding_regeneration_error}</p>
                    )}
                  </div>
                )}
                {selectedEmbeddingProfile && (
                  <p className="text-xs text-subtle">
                    Active target profile: {selectedEmbeddingProfile.provider}/{selectedEmbeddingProfile.model}
                  </p>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up space-y-4">
                <h3 className="text-sm font-semibold text-strong">Add URL Source</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Source URL"
                    placeholder="https://docs.example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <Input
                    label="Title (optional)"
                    placeholder="Developer Docs"
                    value={newUrlTitle}
                    onChange={(e) => setNewUrlTitle(e.target.value)}
                  />
                  <div className="flex items-end">
                    <Button className="w-full" loading={isAddingUrl} onClick={addUrlSource}>
                      Add URL
                    </Button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-strong">Add Text/Markdown Content</h3>
                <div className="space-y-3">
                  <Input
                    label="Content Title"
                    placeholder="FAQ v1"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                  <Textarea
                    label="Content"
                    placeholder="Paste markdown or support notes..."
                    rows={8}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                  />
                  <Button loading={isUploading} onClick={addUploadSource}>
                    Upload Content
                  </Button>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Sources</h3>
                {sources.length === 0 ? (
                  <p className="text-xs text-subtle">No sources yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-strong truncate">
                            {source.title || source.input_url || "Uploaded content"}
                          </p>
                          <p className="text-xs text-subtle truncate">
                            {source.source_type === "url" ? source.input_url : "Manual upload"}
                          </p>
                          {source.last_error && <p className="text-xs text-danger mt-1">{source.last_error}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              source.status === "ready"
                                ? "active"
                                : source.status === "failed"
                                ? "revoked"
                                : "default"
                            }
                          >
                            {source.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => void recrawlSource(source.id)}>
                            Recrawl
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void removeSource(source.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Search</h3>
                <div className="flex gap-3">
                  <Input
                    placeholder="Search by keyword or natural question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button loading={isSearching} onClick={runSearch}>
                    Search
                  </Button>
                </div>
                <div className="space-y-2 mt-4">
                  {searchHits.map((hit) => (
                    <div key={`${hit.document_id}-${hit.score}`} className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-strong truncate">{hit.title || "Untitled Document"}</p>
                        <span className="text-xs text-subtle">score {hit.score.toFixed(3)}</span>
                      </div>
                      {hit.url && <p className="text-xs text-dim truncate mt-1">{hit.url}</p>}
                      <p className="text-xs text-subtle mt-2 line-clamp-3">{hit.snippet}</p>
                    </div>
                  ))}
                  {searchHits.length === 0 && (
                    <p className="text-xs text-subtle mt-2">No search results yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Indexed Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-subtle">No indexed documents yet.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-strong truncate">{doc.title || "Untitled"}</p>
                          {doc.canonical_url && (
                            <p className="text-xs text-subtle truncate">{doc.canonical_url}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void removeDocument(doc.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Ingestion Jobs</h3>
                {jobs.length === 0 ? (
                  <p className="text-xs text-subtle">No jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-dim">{job.id.slice(0, 8)}...</p>
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "active"
                                : job.status === "failed"
                                ? "revoked"
                                : "default"
                            }
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-subtle mt-1">{job.job_type}</p>
                        {job.error && <p className="text-xs text-danger mt-1">{job.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-8 animate-fade-in-up">
              <p className="text-sm text-subtle">Select a knowledge base to manage sources and search content.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Regenerate"
        confirmVariant="primary"
        onConfirm={confirmRegenerationAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
