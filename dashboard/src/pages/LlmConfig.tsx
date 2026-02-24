import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  Input,
  PageSpinner,
  Select,
  Spinner,
  useToast,
} from "../components/ui";
import { useDirtyState } from "../context/DirtyStateContext";

interface Config {
  llm_provider: string;
  llm_model: string;
  has_llm_api_key: boolean;
  llm_api_base: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  custom_base_url: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
}

interface ModelsResponse {
  provider: string;
  models: ModelInfo[];
  is_dynamic: boolean;
  error?: string | null;
}

interface ModelsLookupRequest {
  provider?: string;
  llm_api_key?: string | null;
  llm_api_base?: string | null;
}

interface TestResult {
  ok: boolean;
  latency_ms: number | null;
  error: string | null;
}

export default function LlmConfig() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();
  const { markDirty, markClean } = useDirtyState();

  const [saved, setSaved] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isDynamic, setIsDynamic] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const isDirty =
    saved !== null &&
    draft !== null &&
    (draft.llm_provider !== saved.llm_provider ||
      draft.llm_model !== saved.llm_model ||
      draft.llm_api_base !== saved.llm_api_base ||
      apiKey !== "");

  useEffect(() => {
    Promise.all([
      api<Config>(`/v1/apps/${appId}/config`),
      api<ProviderInfo[]>(`/v1/apps/${appId}/config/providers`),
    ]).then(([config, providerList]) => {
      setSaved(config);
      setDraft(config);
      setProviders(providerList);
    });
  }, [appId]);

  useEffect(() => {
    if (!draft?.llm_provider) return;
    if (!apiKey.trim() && !saved?.has_llm_api_key) {
      setModels([]);
      setIsDynamic(false);
      setModelsError(null);
      return;
    }

    const timeout = setTimeout(() => {
      setModelsLoading(true);
      setModelsError(null);

      const body: ModelsLookupRequest = {
        provider: draft.llm_provider,
        llm_api_key: apiKey.trim() || null,
        llm_api_base: draft.llm_api_base || null,
      };

      api<ModelsResponse>(`/v1/apps/${appId}/config/models`, {
        method: "POST",
        body: JSON.stringify(body),
      })
        .then((response) => {
          setModels(response.models);
          setIsDynamic(response.is_dynamic);
          setModelsError(response.error ?? null);
          if (
            response.models.length > 0 &&
            draft &&
            !response.models.some((model) => model.id === draft.llm_model)
          ) {
            setDraft((prev) => (prev ? { ...prev, llm_model: response.models[0].id } : prev));
          }
        })
        .catch((err: unknown) => {
          setModels([]);
          setIsDynamic(false);
          setModelsError(err instanceof ApiError ? err.detail : "Failed to fetch models");
        })
        .finally(() => setModelsLoading(false));
    }, 350);

    return () => clearTimeout(timeout);
  }, [appId, draft?.llm_provider, draft?.llm_api_base, apiKey, saved?.has_llm_api_key]);

  useEffect(() => {
    if (isDirty) markDirty("llm");
    else markClean("llm");
    return () => markClean("llm");
  }, [isDirty, markDirty, markClean]);

  const currentProvider = providers.find((provider) => provider.id === draft?.llm_provider);
  const showApiBase = currentProvider?.custom_base_url ?? false;
  const hasAnyApiKey = (saved?.has_llm_api_key ?? false) || apiKey.trim() !== "";

  function handleProviderChange(providerId: string) {
    if (!draft) return;
    const provider = providers.find((entry) => entry.id === providerId);
    setDraft({
      ...draft,
      llm_provider: providerId,
      llm_api_base: provider?.custom_base_url ? (draft.llm_api_base || "") : null,
    });
    setTestResult(null);
  }

  async function handleTest() {
    if (!draft) return;
    if (!hasAnyApiKey) {
      toast("Enter or save an API key before testing the connection", "error");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await api<TestResult>(`/v1/apps/${appId}/config/test`, {
        method: "POST",
        body: JSON.stringify({
          provider: draft.llm_provider,
          model: draft.llm_model,
          llm_api_key: apiKey || null,
          llm_api_base: draft.llm_api_base || null,
        }),
      });
      setTestResult(result);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Test failed", "error");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        llm_provider: draft.llm_provider,
        llm_model: draft.llm_model,
        llm_api_base: draft.llm_api_base,
      };
      if (apiKey) body.llm_api_key = apiKey;
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSaved(updated);
      setDraft(updated);
      setApiKey("");
      setTestResult(null);
      toast("LLM configuration saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (!draft || !saved) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-strong">LLM Provider</h1>
        <p className="text-sm text-subtle mt-1">
          Configure the AI model and credentials for this app&apos;s agent.
        </p>
      </div>

      {isDirty && (
        <div className="mb-4 flex items-center gap-2 text-sm text-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Unsaved changes
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Provider" value={draft.llm_provider} onChange={(e) => handleProviderChange(e.target.value)}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-subtle">Model</label>
              {modelsLoading && <Spinner size="sm" />}
              {!modelsLoading && models.length > 0 && (
                <Badge variant={isDynamic ? "live" : "default"}>
                  {isDynamic ? "live" : "default list"}
                </Badge>
              )}
            </div>
            {modelsLoading ? (
              <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">
                Loading models...
              </div>
            ) : models.length > 0 ? (
              <select
                value={draft.llm_model}
                onChange={(e) => setDraft({ ...draft, llm_model: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            ) : !hasAnyApiKey ? (
              <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">
                Enter API key to load models
              </div>
            ) : (
              <div className="space-y-1">
                <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">
                  No models available for this provider/key yet.
                </div>
                {modelsError && (
                  <p className="text-xs text-danger">Failed to fetch models: {modelsError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-medium text-subtle">LLM API Key</label>
            {saved.has_llm_api_key && <Badge variant="active" dot>Set</Badge>}
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={saved.has_llm_api_key ? "Enter new key to rotate" : "Enter API key"}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
          />
        </div>

        {showApiBase && (
          <Input
            label="API Base URL"
            value={draft.llm_api_base || ""}
            onChange={(e) => setDraft({ ...draft, llm_api_base: e.target.value || null })}
            placeholder="https://api.example.com/v1"
            mono
          />
        )}

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
              testResult.ok
                ? "bg-success-subtle border-success-dim text-success"
                : "bg-danger-subtle border-danger-dim text-danger"
            }`}
          >
            {testResult.ok ? (
              <>
                <span className="w-2 h-2 rounded-full bg-success" />
                Connected · {testResult.latency_ms}ms
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-danger" />
                {testResult.error || "Connection failed"}
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleTest}
            loading={isTesting}
            disabled={!hasAnyApiKey}
          >
            Test Connection
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={!isDirty}>
            Save LLM Config
          </Button>
        </div>
      </form>
    </div>
  );
}
