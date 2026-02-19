import { type FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

interface Config {
  system_prompt: string;
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
}

export default function AppConfig() {
  const { appId } = useParams();
  const [config, setConfig] = useState<Config | null>(null);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isDynamic, setIsDynamic] = useState(false);

  useEffect(() => {
    api<Config>(`/v1/apps/${appId}/config`).then(setConfig);
    api<ProviderInfo[]>(`/v1/apps/${appId}/config/providers`).then(setProviders);
  }, [appId]);

  useEffect(() => {
    if (!config) return;
    setModelsLoading(true);
    api<ModelsResponse>(`/v1/apps/${appId}/config/models?provider=${config.llm_provider}`)
      .then((res) => {
        setModels(res.models);
        setIsDynamic(res.is_dynamic);
        if (res.models.length > 0 && !res.models.some((m) => m.id === config.llm_model)) {
          setConfig((prev) => prev && { ...prev, llm_model: res.models[0].id });
        }
      })
      .finally(() => setModelsLoading(false));
  }, [appId, config?.llm_provider]);

  function handleProviderChange(providerId: string) {
    if (!config) return;
    setConfig({
      ...config,
      llm_provider: providerId,
      llm_api_base: providerId === "nexos" ? config.llm_api_base || "https://api.nexos.ai/v1" : null,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    const body: Record<string, unknown> = { ...config };
    delete body.has_llm_api_key;
    if (llmApiKey) body.llm_api_key = llmApiKey;
    const updated = await api<Config>(`/v1/apps/${appId}/config`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setConfig(updated);
    setLlmApiKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!config) return <p>Loading...</p>;

  const showApiBaseField = config.llm_provider === "nexos";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apps" className="text-blue-600 hover:underline text-sm">
          &larr; Apps
        </Link>
        <h1 className="text-2xl font-bold">Agent Configuration</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">System Prompt</label>
          <textarea
            value={config.system_prompt}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
            rows={4}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">LLM Provider</label>
            <select
              value={config.llm_provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              LLM Model{" "}
              {modelsLoading ? (
                <span className="text-gray-400 text-xs">(loading...)</span>
              ) : models.length > 0 ? (
                <span className={`text-xs ${isDynamic ? "text-green-600" : "text-gray-400"}`}>
                  ({isDynamic ? "live" : "default list"})
                </span>
              ) : null}
            </label>
            {models.length > 0 ? (
              <select
                value={config.llm_model}
                onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={config.llm_model}
                onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
                placeholder="Enter model ID"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            )}
            {!config.has_llm_api_key && models.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Save your API key first to load models from the provider
              </p>
            )}
          </div>
        </div>

        {showApiBaseField && (
          <div>
            <label className="block text-sm font-medium mb-1">API Base URL</label>
            <input
              value={config.llm_api_base || ""}
              onChange={(e) => setConfig({ ...config, llm_api_base: e.target.value || null })}
              placeholder="https://api.nexos.ai/v1"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            LLM API Key{" "}
            {config.has_llm_api_key && <span className="text-green-600">(set)</span>}
          </label>
          <input
            type="password"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder="Enter new key to update"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Tokens</label>
            <input
              type="number"
              value={config.max_tokens}
              onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Tool Rounds</label>
            <input
              type="number"
              value={config.max_tool_rounds}
              onChange={(e) => setConfig({ ...config, max_tool_rounds: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Session TTL (minutes)</label>
            <input
              type="number"
              value={config.session_ttl_minutes}
              onChange={(e) => setConfig({ ...config, session_ttl_minutes: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Context Messages</label>
            <input
              type="number"
              value={config.max_context_messages}
              onChange={(e) => setConfig({ ...config, max_context_messages: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Save Configuration
          </button>
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
