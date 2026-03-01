import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Badge, Button, Input, PageSpinner, Select, useToast } from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";
import { useOnboarding } from "../context/OnboardingContext";

interface Config {
  llm_profile_id: string | null;
  llm_profile_name: string | null;
  llm_provider: string | null;
  llm_model: string;
  kb_vision_mode: "ocr_safe" | "multimodal";
  has_llm_api_key: boolean;
  llm_api_base: string | null;
}

interface OrganizationLlmProfile {
  id: string;
  name: string;
  provider: string;
  has_api_key: boolean;
  api_base: string | null;
  updated_at: string;
}

interface ModelInfo {
  id: string;
  name: string;
  capabilities: {
    ocr_compatible: boolean;
    multimodal_vision: boolean;
  };
}

interface LlmModelsResponse {
  llm_profile_id: string;
  provider: string;
  models: ModelInfo[];
  is_dynamic: boolean;
  error: string | null;
}

export default function LlmConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();
  const { refresh } = useOnboarding();

  const [saved, setSaved] = useState<Config | null>(null);
  const [draftProfileId, setDraftProfileId] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState("");
  const [draftVisionMode, setDraftVisionMode] = useState<"ocr_safe" | "multimodal">("ocr_safe");
  const [profiles, setProfiles] = useState<OrganizationLlmProfile[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsDynamic, setModelsDynamic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    saved !== null &&
    (
      draftProfileId !== saved.llm_profile_id
      || draftModel !== saved.llm_model
      || draftVisionMode !== saved.kb_vision_mode
    );

  useEffect(() => {
    Promise.all([
      api<Config>(`/v1/apps/${appId}/config`),
      api<OrganizationLlmProfile[]>("/v1/organizations/llm-profiles"),
    ]).then(([config, llmProfiles]) => {
      setSaved(config);
      setDraftProfileId(config.llm_profile_id);
      setDraftModel(config.llm_model || "");
      setDraftVisionMode(config.kb_vision_mode ?? "ocr_safe");
      setProfiles(llmProfiles);
    });
  }, [appId]);

  useEffect(() => {
    if (isDirty) markDirty("llm");
    else markClean("llm");
    return () => markClean("llm");
  }, [isDirty, markDirty, markClean]);

  useEffect(() => {
    if (!draftProfileId) {
      setModels([]);
      setModelsError(null);
      setModelsDynamic(false);
      return;
    }

    setModelsLoading(true);
    setModelsError(null);
    api<LlmModelsResponse>(`/v1/organizations/llm-models?llm_profile_id=${encodeURIComponent(draftProfileId)}`)
      .then((payload) => {
        const items = payload.models ?? [];
        setModels(items);
        setModelsDynamic(payload.is_dynamic);
        setModelsError(payload.error ?? null);
        if (items.length > 0 && !items.some((model) => model.id === draftModel)) {
          setDraftModel(items[0].id);
        }
      })
      .catch((err: unknown) => {
        setModels([]);
        setModelsDynamic(false);
        setModelsError(err instanceof ApiError ? err.detail : "Failed to load models");
      })
      .finally(() => setModelsLoading(false));
  }, [draftProfileId, draftModel]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === draftProfileId) ?? null,
    [profiles, draftProfileId]
  );
  const selectedModel = useMemo(
    () => models.find((model) => model.id === draftModel) ?? null,
    [models, draftModel]
  );
  const visionModeValidationError = useMemo(() => {
    if (!draftModel.trim()) {
      return "Select a model before setting KB vision mode.";
    }
    if (!selectedModel) {
      if (draftVisionMode === "multimodal") {
        return "Choose a discovered model with multimodal support before enabling Full multimodal mode.";
      }
      return null;
    }
    if (draftVisionMode === "multimodal" && !selectedModel.capabilities.multimodal_vision) {
      return `Model '${selectedModel.name}' does not support multimodal vision.`;
    }
    if (draftVisionMode === "ocr_safe" && !selectedModel.capabilities.ocr_compatible) {
      return `Model '${selectedModel.name}' is not OCR compatible.`;
    }
    return null;
  }, [draftModel, draftVisionMode, selectedModel]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draftProfileId || !draftModel.trim()) return;
    setIsSaving(true);
    try {
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify({
          llm_profile_id: draftProfileId,
          llm_model: draftModel.trim(),
          kb_vision_mode: draftVisionMode,
        }),
      });
      setSaved(updated);
      setDraftProfileId(updated.llm_profile_id);
      setDraftModel(updated.llm_model);
      setDraftVisionMode(updated.kb_vision_mode ?? "ocr_safe");
      toast("LLM configuration saved", "success");
      await refresh();
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
        <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">LLM Provider</h1>
        <p className="text-sm text-subtle mt-1">
          Select organization provider credentials first, then choose the app model.
        </p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            Provider keys are managed in Organization Admin. This page selects the model used by this app.
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
          <>
            <Select
              label="Organization LLM Profile"
              value={draftProfileId || ""}
              onChange={(e) => setDraftProfileId(e.target.value || null)}
            >
              <option value="">Select profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.provider}
                </option>
              ))}
            </Select>

            {!draftProfileId ? (
              <div className="rounded-lg border border-border bg-canvas/40 px-3 py-2 text-sm text-subtle">
                Select a profile to load available models.
              </div>
            ) : modelsLoading ? (
              <div className="rounded-lg border border-border bg-canvas/40 px-3 py-2 text-sm text-subtle">
                Loading models...
              </div>
            ) : models.length > 0 ? (
              <Select
                label="Model"
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label="Model"
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
                placeholder="Enter model ID"
              />
            )}

            <div className="rounded-lg border border-border bg-canvas/40 p-3">
              <label className="text-xs font-medium text-subtle">Knowledge Base Vision Mode</label>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kb_vision_mode"
                    value="ocr_safe"
                    checked={draftVisionMode === "ocr_safe"}
                    onChange={() => setDraftVisionMode("ocr_safe")}
                    className="accent-accent mt-0.5"
                  />
                  <span className="text-sm text-body">
                    <span className="font-medium">Low-risk OCR</span>
                    <span className="ml-1 text-subtle">Use text and OCR-derived KB context only.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kb_vision_mode"
                    value="multimodal"
                    checked={draftVisionMode === "multimodal"}
                    onChange={() => setDraftVisionMode("multimodal")}
                    className="accent-accent mt-0.5"
                  />
                  <span className="text-sm text-body">
                    <span className="font-medium">Full multimodal</span>
                    <span className="ml-1 text-subtle">Allow image-aware retrieval and vision reasoning when supported.</span>
                  </span>
                </label>
              </div>
            </div>
          </>
        )}

        {selectedProfile && (
          <div className="rounded-lg border border-border bg-canvas/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-strong">{selectedProfile.name}</p>
                <p className="text-xs text-subtle mt-0.5">
                  Provider: {selectedProfile.provider}
                </p>
                {selectedProfile.api_base && (
                  <p className="text-xs text-dim font-mono mt-1">{selectedProfile.api_base}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedProfile.has_api_key ? "active" : "revoked"} dot>
                  API Key {selectedProfile.has_api_key ? "Set" : "Missing"}
                </Badge>
                {models.length > 0 && (
                  <Badge variant={modelsDynamic ? "live" : "default"}>
                    {modelsDynamic ? "Live models" : "Fallback models"}
                  </Badge>
                )}
                {selectedModel && (
                  <>
                    <Badge variant={selectedModel.capabilities.ocr_compatible ? "active" : "revoked"}>
                      OCR Compatible
                    </Badge>
                    <Badge variant={selectedModel.capabilities.multimodal_vision ? "active" : "default"}>
                      Multimodal Vision
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {modelsError && (
          <p className="text-xs text-warning">Model discovery warning: {modelsError}</p>
        )}
        {visionModeValidationError && (
          <p className="text-xs text-warning">{visionModeValidationError}</p>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-border">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={!isDirty || !draftProfileId || !draftModel.trim() || Boolean(visionModeValidationError)}
          >
            Save LLM Config
          </Button>
        </div>
      </form>
    </div>
  );
}
