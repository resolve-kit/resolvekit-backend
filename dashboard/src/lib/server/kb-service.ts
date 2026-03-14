import { SignJWT } from "jose";

const KB_BASE_URL = (process.env.IAA_KNOWLEDGE_BASES_BASE_URL ?? "http://kb-service:8100").replace(/\/$/, "");
const KB_AUDIENCE = process.env.IAA_KNOWLEDGE_BASES_AUDIENCE ?? "kb-service";
const KB_JWT_ALGORITHM = process.env.IAA_KNOWLEDGE_BASES_JWT_ALGORITHM ?? "HS256";
const KB_TIMEOUT_MS = Math.floor(Number(process.env.IAA_KNOWLEDGE_BASES_TIMEOUT_SECONDS ?? "20") * 1000);

const KB_INSECURE_KEY_VALUES = new Set(["", "change-me-kb-service-signing-key"]);

function resolveKbSigningKey(): string {
  const value = (process.env.IAA_KNOWLEDGE_BASES_SIGNING_KEY ?? "").trim();
  if (KB_INSECURE_KEY_VALUES.has(value)) {
    if (process.env.NODE_ENV === "test") {
      return "test-only-kb-service-signing-key";
    }
    // Skip during `next build` — runtime secrets are not available at build time.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(
        "IAA_KNOWLEDGE_BASES_SIGNING_KEY must be set to a secure non-default value",
      );
    }
    // During build, use a placeholder that will be replaced at runtime.
    return "build-phase-placeholder-kb-signing-key";
  }
  return value;
}

let _kbSigningKey: string | null = null;
function getKbSigningKey(): string {
  if (_kbSigningKey === null) _kbSigningKey = resolveKbSigningKey();
  return _kbSigningKey;
}

type ActorContext = {
  orgId: string;
  actorId: string;
  actorRole: string;
};

type KBErrorPayload = {
  status: number;
  detail: string;
  code: string | null;
};

export class KBServiceError extends Error {
  status: number;
  code: string | null;

  constructor(payload: KBErrorPayload) {
    super(payload.detail);
    this.status = payload.status;
    this.code = payload.code;
  }
}

function jwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(getKbSigningKey());
}

async function buildServiceToken(ctx: ActorContext): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    org_id: ctx.orgId,
    actor_id: ctx.actorId,
    actor_role: ctx.actorRole,
  })
    .setIssuer("core-api")
    .setAudience(KB_AUDIENCE)
    .setSubject("core-api")
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .setProtectedHeader({ alg: KB_JWT_ALGORITHM })
    .sign(jwtSecretBytes());
}

function parseErrorPayload(body: unknown, fallback: string): { detail: string; code: string | null } {
  if (!body || typeof body !== "object") {
    return { detail: fallback, code: null };
  }

  const payload = body as Record<string, unknown>;
  let code: string | null = null;

  if (typeof payload.code === "string") {
    code = payload.code;
  }

  const detail = payload.detail;
  if (detail && typeof detail === "object") {
    const nested = detail as Record<string, unknown>;
    if (typeof nested.code === "string") {
      code = nested.code;
    }
    if (typeof nested.detail === "string" && nested.detail.trim()) {
      return { detail: nested.detail, code };
    }
  }

  if (typeof detail === "string" && detail.trim()) {
    return { detail, code };
  }

  return { detail: fallback, code };
}

async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KB_TIMEOUT_MS);
  try {
    return await fetch(`${KB_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new KBServiceError({
      status: 503,
      detail: "Knowledge base service unavailable",
      code: null,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callInternal(path: string, payload: Record<string, unknown>, ctx: ActorContext): Promise<Record<string, unknown>> {
  const token = await buildServiceToken(ctx);
  const response = await doFetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = parseErrorPayload(body, response.statusText || "Knowledge base service request failed");
    throw new KBServiceError({ status: response.status, detail: parsed.detail, code: parsed.code });
  }

  if (!body || typeof body !== "object") {
    throw new KBServiceError({ status: 502, detail: "Knowledge base service returned invalid response", code: null });
  }

  return body as Record<string, unknown>;
}

export async function callInternalMultipart(
  path: string,
  fields: Record<string, string>,
  file: { filename: string; content: Uint8Array; contentType: string },
  ctx: ActorContext,
): Promise<Record<string, unknown>> {
  const token = await buildServiceToken(ctx);
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  form.set("file", new Blob([file.content], { type: file.contentType }), file.filename);

  const response = await doFetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = parseErrorPayload(body, response.statusText || "Knowledge base service request failed");
    throw new KBServiceError({ status: response.status, detail: parsed.detail, code: parsed.code });
  }

  if (!body || typeof body !== "object") {
    throw new KBServiceError({ status: 502, detail: "Knowledge base service returned invalid response", code: null });
  }

  return body as Record<string, unknown>;
}

export async function kbList(ctx: ActorContext) {
  return callInternal("/internal/kbs/list", { organization_id: ctx.orgId }, ctx);
}

export async function kbCreate(
  ctx: ActorContext,
  payload: {
    name: string;
    description: string | null;
    embedding_profile_id: string;
    summary_llm_profile_id: string;
    summary_llm_profile_name: string;
    summary_provider: string;
    summary_model: string;
    summary_api_key: string;
    summary_api_base: string | null;
  },
) {
  return callInternal(
    "/internal/kbs/create",
    {
      organization_id: ctx.orgId,
      ...payload,
    },
    ctx,
  );
}

export async function kbGet(ctx: ActorContext, kbId: string) {
  return callInternal("/internal/kbs/get", { organization_id: ctx.orgId, kb_id: kbId }, ctx);
}

export async function kbUpdate(
  ctx: ActorContext,
  kbId: string,
  payload: {
    name?: string | null;
    description?: string | null;
    embedding_profile_id?: string | null;
    summary_llm_profile_id?: string | null;
    summary_llm_profile_name?: string | null;
    summary_provider?: string | null;
    summary_model?: string | null;
    summary_api_key?: string | null;
    summary_api_base?: string | null;
    confirm_regeneration?: boolean;
  },
) {
  return callInternal(
    "/internal/kbs/update",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      ...payload,
    },
    ctx,
  );
}

export async function kbRefreshIndex(ctx: ActorContext, kbId: string) {
  return callInternal(
    "/internal/kbs/refresh-index",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
    },
    ctx,
  );
}

export async function kbEmbeddingChangeImpact(ctx: ActorContext, kbId: string, embeddingProfileId: string) {
  return callInternal(
    "/internal/kbs/embedding-change-impact",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      embedding_profile_id: embeddingProfileId,
    },
    ctx,
  );
}

export async function kbDelete(ctx: ActorContext, kbId: string) {
  return callInternal("/internal/kbs/delete", { organization_id: ctx.orgId, kb_id: kbId }, ctx);
}

export async function kbSourcesList(ctx: ActorContext, kbId: string) {
  return callInternal("/internal/sources/list", { organization_id: ctx.orgId, kb_id: kbId }, ctx);
}

export async function kbSourcesAddUrl(ctx: ActorContext, kbId: string, payload: { url: string; title?: string | null }) {
  return callInternal(
    "/internal/sources/add-url",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      ...payload,
    },
    ctx,
  );
}

export async function kbSourcesAddUpload(ctx: ActorContext, kbId: string, payload: { title: string; content: string }) {
  return callInternal(
    "/internal/sources/add-upload",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      ...payload,
    },
    ctx,
  );
}

export async function kbSourcesAddUploadFile(
  ctx: ActorContext,
  kbId: string,
  payload: { filename: string; content: Uint8Array; contentType: string; title?: string },
) {
  const fields: Record<string, string> = {
    organization_id: ctx.orgId,
    kb_id: kbId,
  };
  if (payload.title) {
    fields.title = payload.title;
  }
  return callInternalMultipart(
    "/internal/sources/add-upload-file",
    fields,
    {
      filename: payload.filename,
      content: payload.content,
      contentType: payload.contentType,
    },
    ctx,
  );
}

export async function kbSourcesRecrawl(ctx: ActorContext, kbId: string, sourceId: string) {
  return callInternal(
    "/internal/sources/recrawl",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      source_id: sourceId,
    },
    ctx,
  );
}

export async function kbSourcesDelete(ctx: ActorContext, kbId: string, sourceId: string) {
  return callInternal(
    "/internal/sources/delete",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      source_id: sourceId,
    },
    ctx,
  );
}

export async function kbJobsList(ctx: ActorContext, kbId: string) {
  return callInternal("/internal/jobs/list", { organization_id: ctx.orgId, kb_id: kbId }, ctx);
}

export async function kbDocumentsList(
  ctx: ActorContext,
  kbId: string,
  payload: { query?: string | null; limit: number },
) {
  return callInternal(
    "/internal/documents/list",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      ...payload,
    },
    ctx,
  );
}

export async function kbDocumentDelete(ctx: ActorContext, kbId: string, documentId: string) {
  return callInternal(
    "/internal/documents/delete",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      document_id: documentId,
    },
    ctx,
  );
}

export async function kbSearch(ctx: ActorContext, kbId: string, payload: { query: string; limit: number }) {
  return callInternal(
    "/internal/search",
    {
      organization_id: ctx.orgId,
      kb_id: kbId,
      ...payload,
    },
    ctx,
  );
}

export async function kbUsageSummary(
  ctx: ActorContext,
  payload: { from_ts: string; to_ts: string; app_id?: string; session_id?: string },
) {
  return callInternal(
    "/internal/usage/summary",
    {
      organization_id: ctx.orgId,
      from_ts: payload.from_ts,
      to_ts: payload.to_ts,
      ...(payload.app_id ? { app_id: payload.app_id } : {}),
      ...(payload.session_id ? { session_id: payload.session_id } : {}),
    },
    ctx,
  );
}

export async function embeddingProfilesList(ctx: ActorContext) {
  return callInternal("/internal/embedding-profiles/list", { organization_id: ctx.orgId }, ctx);
}

export async function embeddingProfilesCreate(
  ctx: ActorContext,
  payload: {
    name: string;
    llm_profile_id: string;
    llm_profile_name: string;
    provider: string;
    embedding_model: string;
    api_key: string;
    api_base: string | null;
  },
) {
  return callInternal(
    "/internal/embedding-profiles/create",
    {
      organization_id: ctx.orgId,
      ...payload,
    },
    ctx,
  );
}

export async function embeddingProfilesUpdate(
  ctx: ActorContext,
  profileId: string,
  payload: {
    name?: string | null;
    llm_profile_id?: string | null;
    llm_profile_name?: string | null;
    provider?: string | null;
    embedding_model?: string | null;
    api_key?: string | null;
    api_base?: string | null;
    confirm_regeneration?: boolean;
  },
) {
  return callInternal(
    "/internal/embedding-profiles/update",
    {
      organization_id: ctx.orgId,
      profile_id: profileId,
      ...payload,
    },
    ctx,
  );
}

export async function embeddingProfilesDelete(ctx: ActorContext, profileId: string) {
  return callInternal(
    "/internal/embedding-profiles/delete",
    {
      organization_id: ctx.orgId,
      profile_id: profileId,
    },
    ctx,
  );
}

export async function embeddingProfilesChangeImpact(
  ctx: ActorContext,
  profileId: string,
  payload: {
    llm_profile_id?: string | null;
    provider?: string | null;
    embedding_model?: string | null;
    api_base?: string | null;
  },
) {
  return callInternal(
    "/internal/embedding-profiles/change-impact",
    {
      organization_id: ctx.orgId,
      profile_id: profileId,
      ...payload,
    },
    ctx,
  );
}
