const PROVIDERS = [
  { id: "openai", name: "OpenAI", custom_base_url: false },
  { id: "anthropic", name: "Anthropic", custom_base_url: false },
  { id: "google", name: "Google", custom_base_url: false },
  { id: "nexos", name: "Nexos AI", custom_base_url: true },
] as const;

const FALLBACK_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-3-5", name: "Claude Haiku 3.5" },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
  nexos: [],
};

const FALLBACK_EMBEDDING_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openai: [
    { id: "text-embedding-3-large", name: "text-embedding-3-large" },
    { id: "text-embedding-3-small", name: "text-embedding-3-small" },
    { id: "text-embedding-ada-002", name: "text-embedding-ada-002" },
  ],
  anthropic: [
    { id: "claude-embedding-1", name: "Claude Embedding 1" },
  ],
  google: [
    { id: "text-embedding-004", name: "text-embedding-004" },
    { id: "gemini-embedding-001", name: "gemini-embedding-001" },
  ],
  nexos: [],
};

const PROVIDER_API_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  nexos: "https://api.nexos.ai/v1/models",
};

const OPENAI_CHAT_PATTERN = /^(gpt-|o[13])/;
const OPENAI_EMBEDDING_PATTERN = /^text-embedding-/;
const GENERIC_EMBEDDING_PATTERN = /(embed|embedding)/;

export type ProviderInfo = {
  id: string;
  name: string;
  custom_base_url: boolean;
};

export type ModelInfo = {
  id: string;
  name: string;
};

function normalizeApiToken(apiKey: string): string {
  const key = apiKey.trim();
  const lower = key.toLowerCase();
  if (lower.startsWith("bearer ")) return key.slice(7).trim();
  if (lower.startsWith("hydra ")) return key.slice(6).trim();
  return key;
}

function nexosAuthCandidates(apiKey: string): string[] {
  const token = normalizeApiToken(apiKey);
  return [`Bearer ${token}`, `hydra ${token}`];
}

function toModelInfo(raw: unknown): ModelInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { id: string; name?: string } => Boolean(m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string"))
    .map((m) => ({ id: m.id, name: typeof m.name === "string" ? m.name : m.id }));
}

function filterOpenAiModels(raw: unknown): ModelInfo[] {
  return toModelInfo(raw)
    .filter((m) => OPENAI_CHAT_PATTERN.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function filterEmbeddingModels(providerId: string, raw: unknown): ModelInfo[] {
  const models = toModelInfo(raw).filter((m) => {
    const matchText = `${m.id} ${m.name}`.toLowerCase();
    if (providerId === "openai") {
      return OPENAI_EMBEDDING_PATTERN.test(m.id);
    }
    return GENERIC_EMBEDDING_PATTERN.test(matchText);
  });
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

function extractHttpErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const error = p.error;
  if (error && typeof error === "object") {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  const detail = p.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  return null;
}

function googleModelsToData(payload: unknown, mode: "chat" | "embedding"): Array<{ id: string; name: string }> {
  if (!payload || typeof payload !== "object") return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  const out: Array<{ id: string; name: string }> = [];
  for (const raw of models) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const sourceName = record.name;
    if (typeof sourceName !== "string") continue;

    const methodsRaw = Array.isArray(record.supportedGenerationMethods)
      ? (record.supportedGenerationMethods as unknown[])
      : [];
    const methods = new Set(methodsRaw.filter((m): m is string => typeof m === "string").map((m) => m.trim().toLowerCase()));
    const lowered = sourceName.toLowerCase();

    const supportsMode = mode === "embedding"
      ? methods.has("embedcontent") || lowered.includes("embedding")
      : methods.has("generatecontent") || methods.has("counttokens") || (!lowered.includes("embedding") && !lowered.includes("embed"));

    if (!supportsMode) continue;

    const id = sourceName.startsWith("models/") ? sourceName.slice("models/".length) : sourceName;
    const displayName = record.displayName;
    out.push({ id, name: typeof displayName === "string" && displayName.trim() ? displayName : id });
  }

  return out;
}

async function fetchModels(
  providerId: string,
  apiUrl: string,
  apiKey: string,
  mode: "chat" | "embedding",
): Promise<ModelInfo[]> {
  const token = normalizeApiToken(apiKey);

  if (providerId === "google") {
    const response = await fetch(`${apiUrl}?key=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`);
    }
    const payload = await response.json().catch(() => null);
    const raw = googleModelsToData(payload, mode);
    return mode === "embedding" ? filterEmbeddingModels(providerId, raw) : toModelInfo(raw);
  }

  if (providerId === "anthropic") {
    const response = await fetch(apiUrl, {
      headers: {
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`);
    }
    const payload = await response.json().catch(() => ({})) as { data?: unknown };
    return mode === "embedding" ? filterEmbeddingModels(providerId, payload.data) : toModelInfo(payload.data);
  }

  if (providerId === "nexos") {
    let lastError: Error | null = null;
    for (const authValue of nexosAuthCandidates(apiKey)) {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: authValue,
          Accept: "*/*",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage = extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`;
        lastError = new Error(errorMessage);
        if (response.status === 401 || response.status === 403) {
          continue;
        }
        throw lastError;
      }
      const payload = await response.json().catch(() => ({})) as { data?: unknown };
      return mode === "embedding" ? filterEmbeddingModels(providerId, payload.data) : toModelInfo(payload.data);
    }
    throw lastError ?? new Error("Failed to authenticate with Nexos models endpoint");
  }

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`);
  }
  const payload = await response.json().catch(() => ({})) as { data?: unknown };
  return mode === "embedding" ? filterEmbeddingModels(providerId, payload.data) : toModelInfo(payload.data);
}

async function fetchNexosEmbeddingModels(apiUrl: string, apiKey: string): Promise<ModelInfo[]> {
  let lastError: Error | null = null;
  for (const authValue of nexosAuthCandidates(apiKey)) {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: authValue,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const errorMessage = extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`;
      lastError = new Error(errorMessage);
      if (response.status === 401 || response.status === 403) {
        continue;
      }
      throw lastError;
    }
    const payload = await response.json().catch(() => ({})) as { data?: unknown };
    return toModelInfo(payload.data);
  }
  throw lastError ?? new Error("Failed to authenticate with Nexos embedding models endpoint");
}

export function listProviders(): ProviderInfo[] {
  return [...PROVIDERS];
}

export function isSupportedProvider(providerId: string): boolean {
  return PROVIDERS.some((provider) => provider.id === providerId);
}

export async function listModelsForProvider(
  providerId: string,
  apiKey: string | null,
  apiBase: string | null,
): Promise<{ models: ModelInfo[]; is_dynamic: boolean; error: string | null }> {
  const apiUrl = providerId === "nexos" && apiBase
    ? `${apiBase.replace(/\/$/, "")}/models`
    : PROVIDER_API_URLS[providerId];

  if (apiUrl && apiKey) {
    try {
      const models = await fetchModels(providerId, apiUrl, apiKey, "chat");
      if (models.length > 0) {
        return { models, is_dynamic: true, error: null };
      }
    } catch (error) {
      return {
        models: FALLBACK_MODELS[providerId] ?? [],
        is_dynamic: false,
        error: error instanceof Error ? error.message : "Failed to fetch provider models",
      };
    }
  }

  return {
    models: FALLBACK_MODELS[providerId] ?? [],
    is_dynamic: false,
    error: null,
  };
}

export async function listEmbeddingModelsForProvider(
  providerId: string,
  apiKey: string | null,
  apiBase: string | null,
): Promise<{ models: ModelInfo[]; is_dynamic: boolean; error: string | null }> {
  if (providerId === "nexos") {
    if (!apiKey) {
      return {
        models: [],
        is_dynamic: false,
        error: "Nexos API key required to load embedding models",
      };
    }

    const base = apiBase ? apiBase.replace(/\/$/, "") : "https://api.nexos.ai/v1";
    try {
      const models = await fetchNexosEmbeddingModels(`${base}/embeddings/models`, apiKey);
      if (models.length > 0) {
        return { models, is_dynamic: true, error: null };
      }
      return { models: [], is_dynamic: true, error: "Nexos returned no embedding models for this API key" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch embedding models";
      return { models: [], is_dynamic: false, error: message };
    }
  }

  const apiUrl = PROVIDER_API_URLS[providerId];
  if (apiUrl && apiKey) {
    try {
      const models = await fetchModels(providerId, apiUrl, apiKey, "embedding");
      if (models.length > 0) {
        return { models, is_dynamic: true, error: null };
      }
    } catch (error) {
      return {
        models: FALLBACK_EMBEDDING_MODELS[providerId] ?? [],
        is_dynamic: false,
        error: error instanceof Error ? error.message : "Failed to fetch embedding models",
      };
    }
  }

  return {
    models: FALLBACK_EMBEDDING_MODELS[providerId] ?? [],
    is_dynamic: false,
    error: null,
  };
}

export async function testProviderConnection(
  provider: string,
  apiKey: string | null,
  apiBase: string | null,
): Promise<{ ok: boolean; latency_ms: number | null; error: string | null }> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!isSupportedProvider(normalizedProvider)) {
    return { ok: false, latency_ms: null, error: `Unsupported provider: ${provider}` };
  }

  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) {
    return { ok: false, latency_ms: null, error: "API key required" };
  }

  const start = Date.now();
  const result = await listModelsForProvider(normalizedProvider, normalizedKey, apiBase);
  if (result.error) {
    return { ok: false, latency_ms: null, error: result.error };
  }
  if (!result.is_dynamic) {
    return {
      ok: false,
      latency_ms: null,
      error: "Could not verify connection with live provider response",
    };
  }
  if (result.models.length === 0) {
    return { ok: false, latency_ms: null, error: "No models returned - check your API key" };
  }
  return { ok: true, latency_ms: Date.now() - start, error: null };
}
