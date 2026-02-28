import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import {
  AppNav,
  Badge,
  Button,
  Input,
  PageSpinner,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "../components/ui";

interface Config {
  system_prompt: string;
  scope_mode: "open" | "strict";
  llm_provider: string;
  llm_model: string;
  has_llm_api_key: boolean;
  llm_api_base: string | null;
  temperature: number;
  max_tokens: number;
  max_tool_rounds: number;
  session_ttl_minutes: number;
  max_context_messages: number;
}

interface ProviderInfo {
  id: string;
  name: string;
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

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="py-6 border-b border-border last:border-0">
      <h3 className="text-xs font-semibold text-subtle uppercase tracking-wider mb-5">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function AppConfig() {
  const { appId } = useParams();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isDynamic, setIsDynamic] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api<Config>(`/v1/apps/${appId}/config`).then((data) =>
      setConfig({ ...data, scope_mode: data.scope_mode ?? "strict" })
    );
    api<ProviderInfo[]>(`/v1/apps/${appId}/config/providers`).then(
      setProviders
    );
  }, [appId]);

  const hasLlmApiKey = Boolean(config?.has_llm_api_key);
  const llmProvider = config?.llm_provider ?? "";
  const llmModel = config?.llm_model ?? "";

  useEffect(() => {
    if (!hasLlmApiKey || !llmProvider) {
      setModels([]);
      setModelsError(null);
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    api<ModelsResponse>(
      `/v1/apps/${appId}/config/models?provider=${llmProvider}`
    )
      .then((res) => {
        setModels(res.models);
        setIsDynamic(res.is_dynamic);
        setModelsError(res.error ?? null);
        if (
          res.models.length > 0 &&
          !res.models.some((m) => m.id === llmModel)
        ) {
          setConfig((prev) => prev && { ...prev, llm_model: res.models[0].id });
        }
      })
      .finally(() => setModelsLoading(false));
  }, [appId, hasLlmApiKey, llmProvider, llmModel]);

  function handleProviderChange(providerId: string) {
    if (!config) return;
    setConfig({
      ...config,
      llm_provider: providerId,
      llm_api_base:
        providerId === "nexos"
          ? config.llm_api_base || "https://api.nexos.ai/v1"
          : null,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { ...config };
      delete body.has_llm_api_key;
      if (llmApiKey) body.llm_api_key = llmApiKey;
      const updated = await api<Config>(`/v1/apps/${appId}/config`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setConfig({ ...updated, scope_mode: updated.scope_mode ?? "strict" });
      setLlmApiKey("");
      toast("Configuration saved", "success");
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to save configuration",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!config) return <PageSpinner />;

  const showApiBaseField = config.llm_provider === "nexos";

  return (
    <div>
      <AppNav appId={appId!} />

      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">
            Agent Configuration
          </h1>
          <p className="text-sm text-subtle mt-1">
            Configure the LLM, system prompt, and runtime limits
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="glass-panel rounded-xl divide-y-0">
          {/* Agent Behavior */}
          <FormSection title="Agent Behavior">
            <Textarea
              label="System Prompt"
              hint="Describe your app clearly so the agent understands its purpose and scope. The more specific you are, the better the agent will perform."
              value={config.system_prompt}
              onChange={(e) =>
                setConfig({ ...config, system_prompt: e.target.value })
              }
              rows={5}
              placeholder={`Describe your app and what it does. For example:

"My app is a home automation controller that lets users manage smart lights, thermostats, and door locks. Users should be helped with device pairing, automation setup, scheduling, and troubleshooting connectivity issues."

This description is shown to the AI on every conversation turn to define what it should help with.`}
            />
            <div className="mt-4">
              <label className="text-xs font-medium text-subtle block mb-2">
                Scope Mode
              </label>
              <div className="flex gap-6">
                {(["open", "strict"] as const).map((mode) => (
                  <label
                    key={mode}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="scope_mode"
                      value={mode}
                      checked={config.scope_mode === mode}
                      onChange={() => setConfig({ ...config, scope_mode: mode })}
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
                In strict mode, the agent politely declines questions unrelated
                to your app.
              </p>
            </div>
          </FormSection>

          {/* LLM Provider */}
          <FormSection title="LLM Provider">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Provider"
                value={config.llm_provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>

              {/* Model picker */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-subtle">
                    Model
                  </label>
                  {config.has_llm_api_key && modelsLoading && (
                    <Spinner size="sm" />
                  )}
                  {config.has_llm_api_key && !modelsLoading && models.length > 0 && (
                    <Badge variant={isDynamic ? "live" : "default"}>
                      {isDynamic ? "live" : "default list"}
                    </Badge>
                  )}
                </div>
                {!config.has_llm_api_key ? (
                  <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">
                    Add an API key below to see available models
                  </div>
                ) : modelsLoading ? (
                  <div className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted">
                    Loading models...
                  </div>
                ) : models.length > 0 ? (
                  <select
                    value={config.llm_model}
                    onChange={(e) =>
                      setConfig({ ...config, llm_model: e.target.value })
                    }
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={config.llm_model}
                      onChange={(e) =>
                        setConfig({ ...config, llm_model: e.target.value })
                      }
                      placeholder="Enter model ID"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                    />
                    {modelsError && (
                      <p className="text-xs text-danger">
                        Failed to fetch live models: {modelsError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showApiBaseField && (
              <div className="mt-4">
                <Input
                  label="API Base URL"
                  value={config.llm_api_base || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      llm_api_base: e.target.value || null,
                    })
                  }
                  placeholder="https://api.nexos.ai/v1"
                  mono
                />
              </div>
            )}

            <div className="mt-4">
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs font-medium text-subtle">
                  LLM API Key
                </label>
                {config.has_llm_api_key && (
                  <Badge variant="active" dot>
                    Set
                  </Badge>
                )}
              </div>
              <input
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder={
                  config.has_llm_api_key
                    ? "Enter new key to update"
                    : "Enter API key"
                }
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
              />
            </div>
          </FormSection>

          {/* Sampling */}
          <FormSection title="Sampling">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={config.temperature}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    temperature: parseFloat(e.target.value),
                  })
                }
              />
              <Input
                label="Max Tokens"
                type="number"
                value={config.max_tokens}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_tokens: parseInt(e.target.value),
                  })
                }
              />
              <Input
                label="Max Tool Rounds"
                type="number"
                value={config.max_tool_rounds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_tool_rounds: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </FormSection>

          {/* Limits */}
          <FormSection title="Limits">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Session TTL (minutes)"
                type="number"
                value={config.session_ttl_minutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    session_ttl_minutes: parseInt(e.target.value),
                  })
                }
              />
              <Input
                label="Max Context Messages"
                type="number"
                value={config.max_context_messages}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_context_messages: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </FormSection>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="primary" size="md" loading={isSaving}>
            Save Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
