import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ResolveKitAction } from "@resolvekit/nextjs/react";

import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Select,
  useToast,
} from "../components/ui";
import { PageHeader } from "../components/layout/PageHeader";
import OnboardingTipCard from "../components/OnboardingTipCard";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  embedding_profile_id: string | null;
  embedding_profile_name: string | null;
  pending_embedding_profile_id: string | null;
  embedding_regeneration_status: string;
  embedding_regeneration_error: string | null;
  summary_llm_profile_id: string | null;
  summary_llm_profile_name: string | null;
  summary_provider: string | null;
  summary_model: string | null;
  summary_text: string | null;
  summary_topics: string[];
  summary_status: string;
  summary_last_error: string | null;
  summary_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmbeddingProfile {
  id: string;
  organization_id: string;
  name: string;
  llm_profile_id: string;
  llm_profile_name: string;
  provider: string;
  embedding_model: string;
  api_base: string | null;
  updated_at: string;
  created_at: string;
}

interface OrganizationLlmProfile {
  id: string;
  name: string;
  provider: string;
  has_api_key: boolean;
  api_base: string | null;
}

interface EmbeddingModelItem {
  id: string;
  name: string;
}

interface EmbeddingModelsResponse {
  llm_profile_id: string;
  provider: string;
  models: EmbeddingModelItem[];
  is_dynamic: boolean;
  error: string | null;
}

interface ChatModelItem {
  id: string;
  name: string;
  capabilities: {
    ocr_compatible: boolean;
    multimodal_vision: boolean;
  };
}

interface ChatModelsResponse {
  llm_profile_id: string;
  provider: string;
  models: ChatModelItem[];
  is_dynamic: boolean;
  error: string | null;
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

interface ActionModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

interface SearchHit {
  document_id: string;
  title: string | null;
  url: string | null;
  snippet: string;
  score: number;
}

const DOCUMENTS_PER_PAGE = 10;
const SUPPORTED_UPLOAD_FORMATS = [
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".html",
  ".htm",
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
];

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
        llm_profile_id: string;
        embedding_model: string;
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

function ActionModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = "max-w-4xl",
}: ActionModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[45] flex items-start justify-center overflow-y-auto p-4 pt-20 md:pt-24">
      <div className="absolute inset-0 bg-slate-900/28 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidthClass} glass-panel rounded-2xl border border-border/70 p-4 shadow-card md:p-5`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-strong">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-subtle transition-colors hover:border-border-2 hover:text-body"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function KnowledgeBases() {
  const [kbs, setKbs] = useState<KnowledgeBaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [embeddingProfiles, setEmbeddingProfiles] = useState<EmbeddingProfile[]>([]);
  const [embeddingLoading, setEmbeddingLoading] = useState(true);
  const [organizationLlmProfiles, setOrganizationLlmProfiles] = useState<OrganizationLlmProfile[]>([]);

  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileLlmProfileId, setNewProfileLlmProfileId] = useState("");
  const [newProfileEmbeddingModel, setNewProfileEmbeddingModel] = useState("");
  const [newProfileEmbeddingModels, setNewProfileEmbeddingModels] = useState<EmbeddingModelItem[]>([]);
  const [newProfileModelsLoading, setNewProfileModelsLoading] = useState(false);
  const [newProfileModelsError, setNewProfileModelsError] = useState<string | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [isEmbeddingModalOpen, setIsEmbeddingModalOpen] = useState(false);
  const [isCreateKbModalOpen, setIsCreateKbModalOpen] = useState(false);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileLlmProfileId, setEditProfileLlmProfileId] = useState("");
  const [editProfileEmbeddingModel, setEditProfileEmbeddingModel] = useState("");
  const [editProfileEmbeddingModels, setEditProfileEmbeddingModels] = useState<EmbeddingModelItem[]>([]);
  const [editProfileModelsLoading, setEditProfileModelsLoading] = useState(false);
  const [editProfileModelsError, setEditProfileModelsError] = useState<string | null>(null);
  const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false);

  const [newKbName, setNewKbName] = useState("");
  const [newKbDescription, setNewKbDescription] = useState("");
  const [newKbEmbeddingProfileId, setNewKbEmbeddingProfileId] = useState("");
  const [newKbSummaryLlmProfileId, setNewKbSummaryLlmProfileId] = useState("");
  const [newKbSummaryModel, setNewKbSummaryModel] = useState("");
  const [newKbSummaryModels, setNewKbSummaryModels] = useState<ChatModelItem[]>([]);
  const [newKbSummaryModelsLoading, setNewKbSummaryModelsLoading] = useState(false);
  const [newKbSummaryModelsError, setNewKbSummaryModelsError] = useState<string | null>(null);
  const [isCreatingKb, setIsCreatingKb] = useState(false);

  const [kbEmbeddingDraftId, setKbEmbeddingDraftId] = useState("");
  const [isUpdatingKbEmbedding, setIsUpdatingKbEmbedding] = useState(false);
  const [kbSummaryDraftProfileId, setKbSummaryDraftProfileId] = useState("");
  const [kbSummaryDraftModel, setKbSummaryDraftModel] = useState("");
  const [kbSummaryModels, setKbSummaryModels] = useState<ChatModelItem[]>([]);
  const [kbSummaryModelsLoading, setKbSummaryModelsLoading] = useState(false);
  const [kbSummaryModelsError, setKbSummaryModelsError] = useState<string | null>(null);
  const [isSavingKbSummary, setIsSavingKbSummary] = useState(false);
  const [isRefreshingKbIndex, setIsRefreshingKbIndex] = useState(false);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [jobs, setJobs] = useState<KnowledgeJob[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsPage, setDocumentsPage] = useState(1);

  const [newUrl, setNewUrl] = useState("");
  const [newUrlTitle, setNewUrlTitle] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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

  const totalDocumentPages = Math.max(1, Math.ceil(documents.length / DOCUMENTS_PER_PAGE));
  const pagedDocuments = useMemo(() => {
    const start = (documentsPage - 1) * DOCUMENTS_PER_PAGE;
    return documents.slice(start, start + DOCUMENTS_PER_PAGE);
  }, [documents, documentsPage]);

  const selectedNewProfileLlm = useMemo(
    () => organizationLlmProfiles.find((profile) => profile.id === newProfileLlmProfileId) ?? null,
    [organizationLlmProfiles, newProfileLlmProfileId]
  );

  const loadEmbeddingProfiles = useCallback(async () => {
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
  }, [toast]);

  const loadOrganizationLlmProfiles = useCallback(async () => {
    try {
      const profiles = await api<OrganizationLlmProfile[]>("/v1/organizations/llm-profiles");
      setOrganizationLlmProfiles(profiles);
      setNewProfileLlmProfileId((prev) => prev || profiles[0]?.id || "");
      setNewKbSummaryLlmProfileId((prev) => prev || profiles[0]?.id || "");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load organization LLM profiles", "error");
    }
  }, [toast]);

  const loadChatModelsForLlmProfile = useCallback(async (
    llmProfileId: string,
    target: "new-kb" | "selected-kb",
  ) => {
    if (!llmProfileId) {
      if (target === "new-kb") {
        setNewKbSummaryModels([]);
        setNewKbSummaryModel("");
        setNewKbSummaryModelsError(null);
      } else {
        setKbSummaryModels([]);
        setKbSummaryDraftModel("");
        setKbSummaryModelsError(null);
      }
      return;
    }

    if (target === "new-kb") {
      setNewKbSummaryModelsLoading(true);
      setNewKbSummaryModelsError(null);
    } else {
      setKbSummaryModelsLoading(true);
      setKbSummaryModelsError(null);
    }
    try {
      const payload = await api<ChatModelsResponse>(
        `/v1/organizations/llm-models?llm_profile_id=${encodeURIComponent(llmProfileId)}`
      );
      const models = (payload.models ?? []).filter((model) => model.capabilities.ocr_compatible);
      if (target === "new-kb") {
        setNewKbSummaryModels(models);
        setNewKbSummaryModel((prev) =>
          prev && models.some((model) => model.id === prev) ? prev : (models[0]?.id ?? "")
        );
        setNewKbSummaryModelsError(payload.error ?? null);
      } else {
        setKbSummaryModels(models);
        setKbSummaryDraftModel((prev) =>
          prev && models.some((model) => model.id === prev) ? prev : (models[0]?.id ?? "")
        );
        setKbSummaryModelsError(payload.error ?? null);
      }
    } catch (err: unknown) {
      const detail = err instanceof ApiError ? err.detail : "Failed to load summary models";
      toast(detail, "error");
      if (target === "new-kb") {
        setNewKbSummaryModels([]);
        setNewKbSummaryModel("");
        setNewKbSummaryModelsError(detail);
      } else {
        setKbSummaryModels([]);
        setKbSummaryDraftModel("");
        setKbSummaryModelsError(detail);
      }
    } finally {
      if (target === "new-kb") setNewKbSummaryModelsLoading(false);
      else setKbSummaryModelsLoading(false);
    }
  }, [toast]);

  const loadEmbeddingModelsForLlmProfile = useCallback(async (
    llmProfileId: string,
    target: "new" | "edit",
  ) => {
    if (!llmProfileId) {
      if (target === "new") {
        setNewProfileEmbeddingModels([]);
        setNewProfileEmbeddingModel("");
        setNewProfileModelsError(null);
      } else {
        setEditProfileEmbeddingModels([]);
        setEditProfileEmbeddingModel("");
        setEditProfileModelsError(null);
      }
      return;
    }

    if (target === "new") {
      setNewProfileModelsLoading(true);
      setNewProfileModelsError(null);
    } else {
      setEditProfileModelsLoading(true);
      setEditProfileModelsError(null);
    }

    try {
      const payload = await api<EmbeddingModelsResponse>(
        `/v1/organizations/embedding-models?llm_profile_id=${encodeURIComponent(llmProfileId)}`
      );
      const models = payload.models ?? [];
      if (target === "new") {
        setNewProfileEmbeddingModels(models);
        setNewProfileEmbeddingModel((prev) =>
          prev && models.some((model) => model.id === prev) ? prev : (models[0]?.id ?? "")
        );
        setNewProfileModelsError(payload.error ?? null);
      } else {
        setEditProfileEmbeddingModels(models);
        setEditProfileEmbeddingModel((prev) =>
          prev && models.some((model) => model.id === prev) ? prev : (models[0]?.id ?? "")
        );
        setEditProfileModelsError(payload.error ?? null);
      }
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load embedding models", "error");
      if (target === "new") {
        setNewProfileEmbeddingModels([]);
        setNewProfileEmbeddingModel("");
        setNewProfileModelsError(err instanceof ApiError ? err.detail : "Model catalog unavailable");
      } else {
        setEditProfileEmbeddingModels([]);
        setEditProfileEmbeddingModel("");
        setEditProfileModelsError(err instanceof ApiError ? err.detail : "Model catalog unavailable");
      }
    } finally {
      if (target === "new") setNewProfileModelsLoading(false);
      else setEditProfileModelsLoading(false);
    }
  }, [toast]);

  const loadKnowledgeBases = useCallback(async () => {
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
  }, [toast]);

  const loadKbDetails = useCallback(async (kbId: string) => {
    try {
      const [sourcesPayload, jobsPayload, docsPayload] = await Promise.all([
        api<{ items: KnowledgeSource[] }>(`/v1/knowledge-bases/${kbId}/sources`),
        api<{ items: KnowledgeJob[] }>(`/v1/knowledge-bases/${kbId}/jobs`),
        api<{ items: KnowledgeDocument[] }>(`/v1/knowledge-bases/${kbId}/documents?limit=200`),
      ]);
      setSources(sourcesPayload.items ?? []);
      setJobs(jobsPayload.items ?? []);
      setDocuments(docsPayload.items ?? []);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load KB details", "error");
    }
  }, [toast]);

  useEffect(() => {
    void Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases(), loadOrganizationLlmProfiles()]);
  }, [loadEmbeddingProfiles, loadKnowledgeBases, loadOrganizationLlmProfiles]);

  useEffect(() => {
    if (!newProfileLlmProfileId) {
      setNewProfileEmbeddingModels([]);
      setNewProfileEmbeddingModel("");
      return;
    }
    void loadEmbeddingModelsForLlmProfile(newProfileLlmProfileId, "new");
  }, [newProfileLlmProfileId, loadEmbeddingModelsForLlmProfile]);

  useEffect(() => {
    if (!editProfileLlmProfileId) {
      setEditProfileEmbeddingModels([]);
      setEditProfileEmbeddingModel("");
      return;
    }
    void loadEmbeddingModelsForLlmProfile(editProfileLlmProfileId, "edit");
  }, [editProfileLlmProfileId, loadEmbeddingModelsForLlmProfile]);

  useEffect(() => {
    if (!newKbSummaryLlmProfileId) {
      setNewKbSummaryModels([]);
      setNewKbSummaryModel("");
      return;
    }
    void loadChatModelsForLlmProfile(newKbSummaryLlmProfileId, "new-kb");
  }, [newKbSummaryLlmProfileId, loadChatModelsForLlmProfile]);

  useEffect(() => {
    if (!selectedId) {
      setSources([]);
      setJobs([]);
      setDocuments([]);
      setDocumentsPage(1);
      return;
    }
    void loadKbDetails(selectedId);
  }, [selectedId, loadKbDetails]);

  useEffect(() => {
    setDocumentsPage(1);
  }, [selectedId]);

  useEffect(() => {
    setDocumentsPage((current) => Math.min(current, totalDocumentPages));
  }, [totalDocumentPages]);

  useEffect(() => {
    if (!selectedKb) {
      setKbEmbeddingDraftId("");
      setKbSummaryDraftProfileId("");
      setKbSummaryDraftModel("");
      return;
    }
    setKbEmbeddingDraftId(selectedKb.embedding_profile_id || "");
    setKbSummaryDraftProfileId(selectedKb.summary_llm_profile_id || "");
    setKbSummaryDraftModel(selectedKb.summary_model || "");
  }, [selectedKb]);

  useEffect(() => {
    if (!kbSummaryDraftProfileId) {
      setKbSummaryModels([]);
      return;
    }
    void loadChatModelsForLlmProfile(kbSummaryDraftProfileId, "selected-kb");
  }, [kbSummaryDraftProfileId, loadChatModelsForLlmProfile]);

  async function createEmbeddingProfile() {
    if (!newProfileName.trim() || !newProfileLlmProfileId || !newProfileEmbeddingModel.trim()) {
      return;
    }

    setIsCreatingProfile(true);
    try {
      await api("/v1/organizations/embedding-profiles", {
        method: "POST",
        body: JSON.stringify({
          name: newProfileName.trim(),
          llm_profile_id: newProfileLlmProfileId,
          embedding_model: newProfileEmbeddingModel.trim(),
        }),
      });
      setNewProfileName("");
      setNewProfileEmbeddingModel("");
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
    setEditProfileLlmProfileId(profile.llm_profile_id);
    setEditProfileEmbeddingModel(profile.embedding_model);
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
      llm_profile_id: editProfileLlmProfileId,
      embedding_model: editProfileEmbeddingModel.trim(),
    };

    const behaviorChanged =
      payload.llm_profile_id !== original.llm_profile_id ||
      payload.embedding_model !== original.embedding_model;

    if (behaviorChanged) {
      try {
        const impact = await api<ImpactResponse>(
          `/v1/organizations/embedding-profiles/${editingProfileId}/change-impact`,
          {
            method: "POST",
            body: JSON.stringify({
              llm_profile_id: payload.llm_profile_id,
              embedding_model: payload.embedding_model,
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
      llm_profile_id: string;
      embedding_model: string;
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
      toast("Embedding profile updated", "success");
      await Promise.all([loadEmbeddingProfiles(), loadKnowledgeBases()]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update embedding profile", "error");
    } finally {
      setIsSavingProfileEdit(false);
    }
  }

  async function createKnowledgeBase() {
    if (!newKbName.trim() || !newKbEmbeddingProfileId || !newKbSummaryLlmProfileId || !newKbSummaryModel.trim()) return false;
    setIsCreatingKb(true);
    try {
      await api("/v1/knowledge-bases", {
        method: "POST",
        body: JSON.stringify({
          name: newKbName.trim(),
          description: newKbDescription.trim() || null,
          embedding_profile_id: newKbEmbeddingProfileId,
          summary_llm_profile_id: newKbSummaryLlmProfileId,
          summary_model: newKbSummaryModel.trim(),
        }),
      });
      setNewKbName("");
      setNewKbDescription("");
      setNewKbSummaryModel("");
      toast("Knowledge base created", "success");
      await loadKnowledgeBases();
      return true;
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create knowledge base", "error");
      return false;
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

  async function saveKbSummaryConfig() {
    if (!selectedKb || !kbSummaryDraftProfileId || !kbSummaryDraftModel.trim()) return;
    setIsSavingKbSummary(true);
    try {
      await api(`/v1/knowledge-bases/${selectedKb.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          summary_llm_profile_id: kbSummaryDraftProfileId,
          summary_model: kbSummaryDraftModel.trim(),
        }),
      });
      toast("KB summary model updated", "success");
      await Promise.all([loadKnowledgeBases(), loadKbDetails(selectedKb.id)]);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update KB summary model", "error");
    } finally {
      setIsSavingKbSummary(false);
    }
  }

  async function refreshKbIndex() {
    if (!selectedKb) return;
    setIsRefreshingKbIndex(true);
    try {
      await api(`/v1/knowledge-bases/${selectedKb.id}/index/refresh`, {
        method: "POST",
      });
      toast("KB index refresh job queued", "success");
      await loadKbDetails(selectedKb.id);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to refresh KB index", "error");
    } finally {
      setIsRefreshingKbIndex(false);
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
    if (!selectedId || !uploadFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadTitle.trim()) {
        formData.append("title", uploadTitle.trim());
      }

      await api(`/v1/knowledge-bases/${selectedId}/sources/upload-file`, {
        method: "POST",
        body: formData,
      });
      setUploadTitle("");
      setUploadFile(null);
      toast("File uploaded. Ingestion job queued.", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to upload knowledge file", "error");
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
  const kbCountLabel = isLoading ? "Loading..." : `${kbs.length} KB${kbs.length === 1 ? "" : "s"}`;
  const profileCountLabel = embeddingLoading
    ? "Loading..."
    : `${embeddingProfiles.length} profile${embeddingProfiles.length === 1 ? "" : "s"}`;

  async function handleCreateKbFromModal() {
    const created = await createKnowledgeBase();
    if (created) {
      setIsCreateKbModalOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge Bases"
        subtitle="Crawl docs, add support content, and assign reusable knowledge across apps."
      />
      <OnboardingTipCard tipId="knowledge_bases_tip" fallbackRoute="/knowledge-bases" />

      <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-strong">Knowledge Base Setup</h2>
            <p className="text-xs text-subtle">
              Keep the page clean and trigger setup only when needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="active">{kbCountLabel}</Badge>
            <Badge variant={embeddingProfiles.length > 0 ? "active" : "default"}>{profileCountLabel}</Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ResolveKitAction
            as={Button}
            actionId="add-knowledge-base-btn"
            actionRole="action"
            description="Open form to add a new knowledge base"
            onClick={() => setIsCreateKbModalOpen(true)}
          >
            Add Knowledge Base
          </ResolveKitAction>
          <Button variant="outline" onClick={() => setIsEmbeddingModalOpen(true)}>
            Manage Embedding Profiles
          </Button>
        </div>
        {!embeddingLoading && embeddingProfiles.length === 0 && (
          <div className="mt-3 rounded-lg border border-warning-dim bg-warning-subtle px-3 py-2">
            <p className="text-xs text-warning">
              No embedding profiles configured. Set one up before creating a knowledge base.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
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
                      : "border-border bg-surface hover:border-border-2"
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
              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                        {profile.name} · {profile.provider}/{profile.embedding_model}
                      </option>
                    ))}
                  </Select>
                  <div className="md:col-span-2 flex items-end">
                    <Button
                      className="w-full md:w-auto"
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
                    Active target profile: {selectedEmbeddingProfile.provider}/{selectedEmbeddingProfile.embedding_model}
                  </p>
                )}

                <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-strong">KB Summary Index</p>
                    <Badge
                      variant={
                        selectedKb.summary_status === "ready"
                          ? "active"
                          : selectedKb.summary_status === "failed"
                          ? "revoked"
                          : "default"
                      }
                    >
                      {selectedKb.summary_status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select
                      label="Summary LLM Profile"
                      value={kbSummaryDraftProfileId}
                      onChange={(e) => setKbSummaryDraftProfileId(e.target.value)}
                    >
                      <option value="">Select LLM profile</option>
                      {organizationLlmProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} · {profile.provider}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Summary Model"
                      value={kbSummaryDraftModel}
                      onChange={(e) => setKbSummaryDraftModel(e.target.value)}
                      disabled={!kbSummaryDraftProfileId || kbSummaryModelsLoading}
                    >
                      <option value="">
                        {kbSummaryModelsLoading
                          ? "Loading models..."
                          : kbSummaryModels.length === 0
                            ? "No chat models available"
                            : "Select summary model"}
                      </option>
                      {kbSummaryModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </Select>
                    <div className="flex flex-col md:items-end justify-end gap-2">
                      <Button
                        className="w-full md:w-auto"
                        loading={isSavingKbSummary}
                        onClick={() => {
                          void saveKbSummaryConfig();
                        }}
                        disabled={
                          !kbSummaryDraftProfileId
                          || !kbSummaryDraftModel.trim()
                          || (
                            kbSummaryDraftProfileId === (selectedKb.summary_llm_profile_id || "")
                            && kbSummaryDraftModel === (selectedKb.summary_model || "")
                          )
                        }
                      >
                        Save Summary Model
                      </Button>
                      <Button
                        className="w-full md:w-auto"
                        variant="outline"
                        loading={isRefreshingKbIndex}
                        onClick={() => {
                          void refreshKbIndex();
                        }}
                        disabled={!selectedKb.summary_llm_profile_id || !selectedKb.summary_model}
                      >
                        Refresh KB Index
                      </Button>
                    </div>
                  </div>
                  {kbSummaryModelsError && (
                    <p className="text-xs text-warning">Model catalog note: {kbSummaryModelsError}</p>
                  )}
                  {selectedKb.summary_last_error && (
                    <p className="text-xs text-danger">{selectedKb.summary_last_error}</p>
                  )}
                  {selectedKb.summary_text ? (
                    <div className="rounded-md border border-border bg-canvas/40 p-2">
                      <p className="text-xs text-subtle">{selectedKb.summary_text}</p>
                      {(selectedKb.summary_topics ?? []).length > 0 && (
                        <p className="text-xs text-dim mt-2">
                          Topics: {(selectedKb.summary_topics ?? []).join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-subtle">
                      {selectedKb.summary_status === "disabled"
                        ? "Summary index disabled until a summary profile/model is configured."
                        : "Summary index not generated yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up space-y-4">
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

                <h3 className="text-sm font-semibold text-strong">Add File Source</h3>
                <div className="space-y-3">
                  <Input
                    label="Title (optional)"
                    placeholder="FAQ v1"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                  <div>
                    <label className="text-sm font-medium text-strong mb-1 block">File</label>
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-strong"
                    />
                    <p className="text-xs text-subtle mt-1">
                      Supported formats: {SUPPORTED_UPLOAD_FORMATS.join(", ")}
                    </p>
                    <p className="text-xs text-subtle mt-1">Maximum size: 25 MB per file.</p>
                    {uploadFile && (
                      <p className="text-xs text-subtle mt-1 truncate">Selected: {uploadFile.name}</p>
                    )}
                  </div>
                  <Button loading={isUploading} onClick={addUploadSource} disabled={!uploadFile}>
                    Upload File
                  </Button>
                </div>
              </div>

              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Sources</h3>
                {sources.length === 0 ? (
                  <p className="text-xs text-subtle">No sources yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
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
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                          {source.source_type === "url" && (
                            <Button size="sm" variant="outline" onClick={() => void recrawlSource(source.id)}>
                              Recrawl
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => void removeSource(source.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Search</h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    placeholder="Search by keyword or natural question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button className="w-full sm:w-auto" loading={isSearching} onClick={runSearch}>
                    Search
                  </Button>
                </div>
                <div className="space-y-2 mt-4">
                  {searchHits.map((hit) => (
                    <div key={`${hit.document_id}-${hit.score}`} className="rounded-lg border border-border bg-surface px-3 py-2">
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

              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Indexed Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-subtle">No indexed documents yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pagedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-strong truncate">{doc.title || "Untitled"}</p>
                          {doc.canonical_url && (
                            <p className="text-xs text-subtle truncate">{doc.canonical_url}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void removeDocument(doc.id)} className="w-full sm:w-auto">
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-subtle">
                        Page {documentsPage} of {totalDocumentPages}
                      </p>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={documentsPage <= 1}
                          onClick={() => setDocumentsPage((current) => Math.max(1, current - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={documentsPage >= totalDocumentPages}
                          onClick={() => setDocumentsPage((current) => Math.min(totalDocumentPages, current + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-2xl border border-border/70 p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Ingestion Jobs</h3>
                {jobs.length === 0 ? (
                  <p className="text-xs text-subtle">No jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-lg border border-border bg-surface px-3 py-2">
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
            <div className="glass-panel rounded-2xl border border-border/70 p-8 animate-fade-in-up">
              <p className="text-sm text-subtle">Select a knowledge base to manage sources and search content.</p>
            </div>
          )}
        </div>
      </div>

      <ActionModal
        open={isCreateKbModalOpen}
        onClose={() => setIsCreateKbModalOpen(false)}
        title="Create Knowledge Base"
        subtitle="Name the KB, add optional description, and choose embedding + summary model settings."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          {embeddingProfiles.length === 0 && !embeddingLoading && (
            <div className="rounded-lg border border-warning-dim bg-warning-subtle px-3 py-2">
              <p className="text-xs text-warning">
                You need an embedding profile first.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCreateKbModalOpen(false);
                  setIsEmbeddingModalOpen(true);
                }}
                className="mt-1 text-xs font-semibold text-accent hover:text-accent-hover"
              >
                Open embedding profile setup
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              disabled={embeddingLoading || embeddingProfiles.length === 0}
            >
              <option value="">
                {embeddingLoading
                  ? "Loading profiles..."
                  : embeddingProfiles.length === 0
                    ? "No profiles configured"
                    : "Select profile"}
              </option>
              {embeddingProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.provider}/{profile.embedding_model}
                </option>
              ))}
            </Select>
            <Select
              label="Summary LLM Profile"
              value={newKbSummaryLlmProfileId}
              onChange={(e) => setNewKbSummaryLlmProfileId(e.target.value)}
              disabled={organizationLlmProfiles.length === 0}
            >
              <option value="">
                {organizationLlmProfiles.length === 0
                  ? "No LLM profiles configured"
                  : "Select LLM profile"}
              </option>
              {organizationLlmProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.provider}
                </option>
              ))}
            </Select>
            <Select
              label="Summary Model"
              value={newKbSummaryModel}
              onChange={(e) => setNewKbSummaryModel(e.target.value)}
              disabled={!newKbSummaryLlmProfileId || newKbSummaryModelsLoading}
            >
              <option value="">
                {newKbSummaryModelsLoading
                  ? "Loading models..."
                  : newKbSummaryModels.length === 0
                    ? "No chat models available"
                    : "Select summary model"}
              </option>
              {newKbSummaryModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </div>
          {newKbSummaryModelsError && (
            <p className="text-xs text-warning">Model catalog note: {newKbSummaryModelsError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreateKbModalOpen(false)} disabled={isCreatingKb}>
              Cancel
            </Button>
            <Button
              loading={isCreatingKb}
              onClick={() => {
                void handleCreateKbFromModal();
              }}
              disabled={
                embeddingLoading
                || embeddingProfiles.length === 0
                || !newKbName.trim()
                || !newKbEmbeddingProfileId
                || !newKbSummaryLlmProfileId
                || !newKbSummaryModel.trim()
              }
            >
              Create Knowledge Base
            </Button>
          </div>
        </div>
      </ActionModal>

      <ActionModal
        open={isEmbeddingModalOpen}
        onClose={() => setIsEmbeddingModalOpen(false)}
        title="Embedding Profiles"
        subtitle="One-time setup. Add or edit profiles used by knowledge bases."
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {organizationLlmProfiles.length === 0 && (
            <div className="rounded-lg border border-warning-dim bg-warning-subtle px-3 py-2">
              <p className="text-xs text-warning">
                No organization LLM profiles configured. Create one in Organization Admin first.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              label="Profile Name"
              placeholder="OpenAI Embeddings"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
            <Select
              label="LLM Profile"
              value={newProfileLlmProfileId}
              onChange={(e) => setNewProfileLlmProfileId(e.target.value)}
            >
              <option value="">Select LLM profile</option>
              {organizationLlmProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.provider}
                </option>
              ))}
            </Select>
            <Select
              label="Embedding Model"
              value={newProfileEmbeddingModel}
              onChange={(e) => setNewProfileEmbeddingModel(e.target.value)}
              disabled={!newProfileLlmProfileId || newProfileModelsLoading}
            >
              <option value="">
                {newProfileModelsLoading
                  ? "Loading models..."
                  : newProfileEmbeddingModels.length === 0
                    ? "No embedding models available"
                    : "Select embedding model"}
              </option>
              {newProfileEmbeddingModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button
                className="w-full"
                loading={isCreatingProfile}
                onClick={createEmbeddingProfile}
                disabled={
                  organizationLlmProfiles.length === 0 ||
                  !newProfileName.trim() ||
                  !newProfileLlmProfileId ||
                  !newProfileEmbeddingModel
                }
              >
                Add
              </Button>
            </div>
          </div>

          {selectedNewProfileLlm && (
            <p className="text-xs text-subtle">
              Credentials source: {selectedNewProfileLlm.name} ({selectedNewProfileLlm.provider})
            </p>
          )}
          {newProfileModelsError && (
            <p className="text-xs text-warning">Model catalog note: {newProfileModelsError}</p>
          )}

          {embeddingLoading ? (
            <p className="text-xs text-subtle">Loading embedding profiles...</p>
          ) : embeddingProfiles.length === 0 ? (
            <p className="text-xs text-subtle">No embedding profiles configured yet.</p>
          ) : (
            <div className="space-y-2">
              {embeddingProfiles.map((profile) => (
                <div key={profile.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  {editingProfileId === profile.id ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Input
                        label="Name"
                        value={editProfileName}
                        onChange={(e) => setEditProfileName(e.target.value)}
                      />
                      <Select
                        label="LLM Profile"
                        value={editProfileLlmProfileId}
                        onChange={(e) => setEditProfileLlmProfileId(e.target.value)}
                      >
                        <option value="">Select LLM profile</option>
                        {organizationLlmProfiles.map((llmProfile) => (
                          <option key={llmProfile.id} value={llmProfile.id}>
                            {llmProfile.name} · {llmProfile.provider}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Embedding Model"
                        value={editProfileEmbeddingModel}
                        onChange={(e) => setEditProfileEmbeddingModel(e.target.value)}
                        disabled={!editProfileLlmProfileId || editProfileModelsLoading}
                      >
                        <option value="">
                          {editProfileModelsLoading
                            ? "Loading models..."
                            : editProfileEmbeddingModels.length === 0
                              ? "No embedding models available"
                              : "Select embedding model"}
                        </option>
                        {editProfileEmbeddingModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </Select>
                      <div className="flex items-end gap-2">
                        <Button
                          size="sm"
                          loading={isSavingProfileEdit}
                          onClick={saveEmbeddingProfileEdit}
                          disabled={!editProfileName.trim() || !editProfileLlmProfileId || !editProfileEmbeddingModel}
                        >
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
                      {editProfileModelsError && (
                        <p className="text-xs text-warning md:col-span-4">
                          Model catalog note: {editProfileModelsError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-strong">{profile.name}</p>
                        <p className="text-xs text-subtle">
                          {profile.provider}/{profile.embedding_model}
                        </p>
                        <p className="text-xs text-dim truncate">
                          LLM profile: {profile.llm_profile_name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
      </ActionModal>

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
