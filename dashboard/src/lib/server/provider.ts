const PROVIDERS = [
  { id: "openai", name: "OpenAI", custom_base_url: false },
  { id: "anthropic", name: "Anthropic", custom_base_url: false },
  { id: "google", name: "Google", custom_base_url: false },
  { id: "openrouter", name: "OpenRouter", custom_base_url: false },
  { id: "nexos", name: "Nexos AI", custom_base_url: true },
] as const;

type RawModelInfo = {
  id: string;
  name: string;
  capabilities?: ModelCapabilities;
  pricing?: ModelPricing | null;
};

export type ModelPricing = {
  input_per_million_usd: number | null;
  output_per_million_usd: number | null;
  image_per_thousand_usd: number | null;
  source: string;
};

export type ModelCapabilities = {
  ocr_compatible: boolean;
  multimodal_vision: boolean;
};

const FALLBACK_MODELS: Record<string, RawModelInfo[]> = {
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
  openrouter: [
    { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o Mini" },
    { id: "openai/gpt-4o", name: "OpenAI GPT-4o" },
    { id: "anthropic/claude-3.5-sonnet", name: "Anthropic Claude 3.5 Sonnet" },
  ],
  nexos: [],
};

const FALLBACK_EMBEDDING_MODELS: Record<string, RawModelInfo[]> = {
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
  openrouter: [],
  nexos: [],
};

const PROVIDER_API_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  openrouter: "https://openrouter.ai/api/v1/models",
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
  capabilities: ModelCapabilities;
  pricing: ModelPricing | null;
};

function withCapabilities(models: RawModelInfo[]): ModelInfo[] {
  return models.map((model) => ({
    ...model,
    capabilities: model.capabilities ?? inferModelCapabilities(model.id, model.name),
    pricing: model.pricing ?? null,
  }));
}

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
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" ? m.name : m.id,
      capabilities: inferModelCapabilities(m.id, typeof m.name === "string" ? m.name : m.id),
      pricing: null,
    }));
}

type OpenRouterCatalogModel = {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing | null;
};

let openRouterCatalogCache: { expiresAt: number; items: OpenRouterCatalogModel[] } | null = null;
const OPENROUTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function _parseOpenRouterPricing(raw: unknown): ModelPricing | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const promptRaw = payload.prompt;
  const completionRaw = payload.completion;
  const imageRaw = payload.image;

  const prompt = typeof promptRaw === "string" || typeof promptRaw === "number" ? Number(promptRaw) : NaN;
  const completion = typeof completionRaw === "string" || typeof completionRaw === "number" ? Number(completionRaw) : NaN;
  const image = typeof imageRaw === "string" || typeof imageRaw === "number" ? Number(imageRaw) : NaN;

  const promptRate = Number.isFinite(prompt) ? prompt * 1_000_000 : null;
  const completionRate = Number.isFinite(completion) ? completion * 1_000_000 : null;
  const imageRate = Number.isFinite(image) ? image * 1_000 : null;

  if (promptRate === null && completionRate === null && imageRate === null) {
    return null;
  }
  return {
    input_per_million_usd: promptRate,
    output_per_million_usd: completionRate,
    image_per_thousand_usd: imageRate,
    source: "openrouter",
  };
}

function _extractModalities(record: Record<string, unknown>): string[] {
  const fromArchitecture = record.architecture;
  if (fromArchitecture && typeof fromArchitecture === "object") {
    const architecture = fromArchitecture as Record<string, unknown>;
    const input = architecture.input_modalities;
    if (Array.isArray(input)) {
      return input.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase());
    }
  }
  const direct = record.input_modalities;
  if (Array.isArray(direct)) {
    return direct.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase());
  }
  return [];
}

function _parseOpenRouterCapabilities(record: Record<string, unknown>, modelId: string, modelName: string): ModelCapabilities {
  const inferred = inferModelCapabilities(modelId, modelName);
  const modalities = _extractModalities(record);
  if (!modalities.length) return inferred;
  const hasImageInput = modalities.includes("image");
  return {
    ocr_compatible: inferred.ocr_compatible,
    multimodal_vision: inferred.multimodal_vision || hasImageInput,
  };
}

async function fetchOpenRouterCatalog(apiKey: string | null = null): Promise<OpenRouterCatalogModel[]> {
  const now = Date.now();
  if (openRouterCatalogCache && openRouterCatalogCache.expiresAt > now) {
    return openRouterCatalogCache.items;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${normalizeApiToken(apiKey)}`;
  }

  const response = await fetch(PROVIDER_API_URLS.openrouter, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenRouter model catalog request failed (${response.status})`);
  }
  const payload = await response.json().catch(() => ({})) as { data?: unknown };
  const itemsRaw = Array.isArray(payload.data) ? payload.data : [];
  const items: OpenRouterCatalogModel[] = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    if (!id) continue;
    const name = typeof record.name === "string" && record.name.trim() ? record.name : id;
    items.push({
      id,
      name,
      capabilities: _parseOpenRouterCapabilities(record, id, name),
      pricing: _parseOpenRouterPricing(record.pricing),
    });
  }
  openRouterCatalogCache = {
    expiresAt: now + OPENROUTER_CACHE_TTL_MS,
    items,
  };
  return items;
}

function _openRouterCapabilitiesForModel(
  providerId: string,
  modelId: string,
  catalog: OpenRouterCatalogModel[],
): ModelCapabilities | null {
  const normalizedModelId = modelId.trim().toLowerCase();
  const normalizedProvider = providerId.trim().toLowerCase();
  const candidateIds = new Set<string>([
    normalizedModelId,
    `${normalizedProvider}/${normalizedModelId}`,
  ]);

  for (const item of catalog) {
    const itemId = item.id.trim().toLowerCase();
    if (candidateIds.has(itemId)) return item.capabilities;
  }
  return null;
}

function _openRouterPricingForModel(
  providerId: string,
  modelId: string,
  catalog: OpenRouterCatalogModel[],
): ModelPricing | null {
  const normalizedModelId = modelId.trim().toLowerCase();
  const normalizedProvider = providerId.trim().toLowerCase();
  const candidateIds = new Set<string>([
    normalizedModelId,
    `${normalizedProvider}/${normalizedModelId}`,
  ]);

  for (const item of catalog) {
    const itemId = item.id.trim().toLowerCase();
    if (candidateIds.has(itemId) && item.pricing) return item.pricing;
  }
  return null;
}

async function enrichModelsWithOpenRouterPricing(
  providerId: string,
  models: ModelInfo[],
  apiKey: string | null = null,
): Promise<ModelInfo[]> {
  try {
    const catalog = await fetchOpenRouterCatalog(apiKey);
    return models.map((model) => ({
      ...model,
      capabilities: _openRouterCapabilitiesForModel(providerId, model.id, catalog) ?? model.capabilities,
      pricing: model.pricing ?? _openRouterPricingForModel(providerId, model.id, catalog),
    }));
  } catch {
    return models;
  }
}

export function inferModelCapabilities(
  modelId: string,
  modelName: string = modelId,
): ModelCapabilities {
  const id = modelId.trim().toLowerCase();
  const name = modelName.trim().toLowerCase();
  const matchText = `${id} ${name}`;

  const isEmbeddingModel = /(embed|embedding)/.test(matchText);
  if (isEmbeddingModel) {
    return {
      ocr_compatible: false,
      multimodal_vision: false,
    };
  }

  const multimodalVision = /(vision|multimodal|gpt-4o|gpt-4\.1|gpt-4-turbo|gemini|claude[- ]?(3|4)|o1|o3)/.test(matchText);
  return {
    // OCR-safe mode reasons over text/OCR output; any non-embedding chat model is compatible.
    ocr_compatible: true,
    multimodal_vision: multimodalVision,
  };
}

export async function lookupModelPricing(providerId: string, modelId: string): Promise<ModelPricing | null> {
  const normalizedProvider = providerId.trim().toLowerCase();
  const normalizedModel = modelId.trim();
  if (!normalizedProvider || !normalizedModel) return null;
  try {
    const catalog = await fetchOpenRouterCatalog();
    return _openRouterPricingForModel(normalizedProvider, normalizedModel, catalog);
  } catch {
    return null;
  }
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

function isUnstableGoogleModelAlias(modelId: string): boolean {
  return modelId.trim().toLowerCase().endsWith("-latest");
}

export function isProviderModelAllowedForPersistence(providerId: string, modelId: string): boolean {
  const normalizedProvider = providerId.trim().toLowerCase();
  const normalizedModel = modelId.trim();
  if (normalizedProvider === "google") {
    return !isUnstableGoogleModelAlias(normalizedModel);
  }
  return true;
}

export function googleModelsToData(payload: unknown, mode: "chat" | "embedding"): Array<{ id: string; name: string }> {
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
    if (isUnstableGoogleModelAlias(id)) continue;
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

  if (providerId === "openrouter") {
    const response = await fetch(apiUrl, {
      headers: {
        ...(apiKey?.trim() ? { Authorization: `Bearer ${normalizeApiToken(apiKey)}` } : {}),
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(extractHttpErrorMessage(payload) ?? `Request failed (${response.status})`);
    }
    const payload = await response.json().catch(() => ({})) as { data?: unknown };
    const models = mode === "embedding" ? filterEmbeddingModels(providerId, payload.data) : toModelInfo(payload.data);
    const catalog = await fetchOpenRouterCatalog(apiKey).catch(() => []);
    return models.map((model) => ({
      ...model,
      pricing: model.pricing ?? _openRouterPricingForModel(providerId, model.id, catalog),
    }));
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

function isIpv4(hostname: string): boolean {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;
  return octets.every((part) => {
    if (!/^[0-9]+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) return false;
  const [a, b] = hostname.split(".").map((part) => Number(part));
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isDisallowedApiBaseHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "0.0.0.0") return true;
  if (normalized === "::1") return true;
  if (normalized.includes(":")) return true; // Block raw IPv6 literals in custom base URLs.
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) return true;
  if (isPrivateIpv4(normalized)) return true;
  return false;
}

export function validateProviderApiBase(
  providerId: string,
  apiBase: string | null,
): { ok: boolean; normalized: string | null; error: string | null } {
  const normalizedProvider = providerId.trim().toLowerCase();
  if (normalizedProvider !== "nexos") {
    return { ok: true, normalized: null, error: null };
  }

  if (!apiBase || !apiBase.trim()) {
    return { ok: true, normalized: null, error: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(apiBase.trim());
  } catch {
    return { ok: false, normalized: null, error: "Invalid provider API base URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, normalized: null, error: "Provider API base URL must use https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, normalized: null, error: "Provider API base URL must not contain credentials" };
  }
  if (isDisallowedApiBaseHost(parsed.hostname)) {
    return { ok: false, normalized: null, error: "Provider API base host is not allowed" };
  }

  parsed.search = "";
  parsed.hash = "";
  const pathname = parsed.pathname.replace(/\/$/, "");
  return {
    ok: true,
    normalized: `${parsed.origin}${pathname}`,
    error: null,
  };
}

export async function listModelsForProvider(
  providerId: string,
  apiKey: string | null,
  apiBase: string | null,
): Promise<{ models: ModelInfo[]; is_dynamic: boolean; error: string | null }> {
  const normalizedProvider = providerId.trim().toLowerCase();
  const validation = validateProviderApiBase(normalizedProvider, apiBase);
  if (!validation.ok) {
    return {
      models: withCapabilities(FALLBACK_MODELS[normalizedProvider] ?? []),
      is_dynamic: false,
      error: validation.error,
    };
  }

  const apiUrl = normalizedProvider === "nexos" && validation.normalized
    ? `${validation.normalized}/models`
    : PROVIDER_API_URLS[normalizedProvider];

  if (apiUrl && apiKey) {
    try {
      const models = await fetchModels(normalizedProvider, apiUrl, apiKey, "chat");
      const enrichedModels = await enrichModelsWithOpenRouterPricing(normalizedProvider, models, apiKey);
      if (models.length > 0) {
        return { models: enrichedModels, is_dynamic: true, error: null };
      }
    } catch (error) {
      return {
        models: withCapabilities(FALLBACK_MODELS[normalizedProvider] ?? []),
        is_dynamic: false,
        error: error instanceof Error ? error.message : "Failed to fetch provider models",
      };
    }
  }

  return {
    models: await enrichModelsWithOpenRouterPricing(
      normalizedProvider,
      withCapabilities(FALLBACK_MODELS[normalizedProvider] ?? []),
      apiKey,
    ),
    is_dynamic: false,
    error: null,
  };
}

export async function listEmbeddingModelsForProvider(
  providerId: string,
  apiKey: string | null,
  apiBase: string | null,
): Promise<{ models: ModelInfo[]; is_dynamic: boolean; error: string | null }> {
  const normalizedProvider = providerId.trim().toLowerCase();

  if (normalizedProvider === "nexos") {
    const validation = validateProviderApiBase(normalizedProvider, apiBase);
    if (!validation.ok) {
      return {
        models: [],
        is_dynamic: false,
        error: validation.error,
      };
    }

    if (!apiKey) {
      return {
        models: [],
        is_dynamic: false,
        error: "Nexos API key required to load embedding models",
      };
    }

    const base = validation.normalized ?? "https://api.nexos.ai/v1";
    try {
      const models = await fetchNexosEmbeddingModels(`${base}/embeddings/models`, apiKey);
      const enrichedModels = await enrichModelsWithOpenRouterPricing(normalizedProvider, models, apiKey);
      if (models.length > 0) {
        return { models: enrichedModels, is_dynamic: true, error: null };
      }
      return { models: [], is_dynamic: true, error: "Nexos returned no embedding models for this API key" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch embedding models";
      return { models: [], is_dynamic: false, error: message };
    }
  }

  const apiUrl = PROVIDER_API_URLS[normalizedProvider];
  if (apiUrl && apiKey) {
    try {
      const models = await fetchModels(normalizedProvider, apiUrl, apiKey, "embedding");
      const enrichedModels = await enrichModelsWithOpenRouterPricing(normalizedProvider, models, apiKey);
      if (models.length > 0) {
        return { models: enrichedModels, is_dynamic: true, error: null };
      }
    } catch (error) {
      return {
        models: withCapabilities(FALLBACK_EMBEDDING_MODELS[normalizedProvider] ?? []),
        is_dynamic: false,
        error: error instanceof Error ? error.message : "Failed to fetch embedding models",
      };
    }
  }

  return {
    models: await enrichModelsWithOpenRouterPricing(
      normalizedProvider,
      withCapabilities(FALLBACK_EMBEDDING_MODELS[normalizedProvider] ?? []),
      apiKey,
    ),
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

  const validation = validateProviderApiBase(normalizedProvider, apiBase);
  if (!validation.ok) {
    return { ok: false, latency_ms: null, error: validation.error };
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
