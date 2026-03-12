const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/$/, "");
const SESSION_OPTIONAL_AUTH_ROUTES = new Set([
  "/v1/auth/login",
  "/v1/auth/signup",
  "/v1/auth/password-guidance",
]);
const SESSION_COOKIE_BOUND_AUTH_ROUTES = new Set([
  "/v1/auth/login",
  "/v1/auth/signup",
  "/v1/auth/password-guidance",
  "/v1/auth/me",
  "/v1/auth/logout",
]);

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

function normalizePath(path: string): string {
  if (!path) return "/";
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function isSessionOptionalAuthRoute(path: string): boolean {
  return SESSION_OPTIONAL_AUTH_ROUTES.has(normalizePath(path));
}

function shouldUseSameOriginAuthRoute(path: string): boolean {
  return SESSION_COOKIE_BOUND_AUTH_ROUTES.has(normalizePath(path));
}

function shouldAttachBearerToken(path: string): boolean {
  return !shouldUseSameOriginAuthRoute(path);
}

function toRequestUrl(path: string): string {
  return shouldUseSameOriginAuthRoute(path) ? path : `${BASE}${path}`;
}

export async function logout(): Promise<void> {
  try {
    await fetch(toRequestUrl("/v1/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort logout; always clear client token state.
  } finally {
    clearToken();
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(
    status: number,
    detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function asMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const msg = (value as { msg?: unknown }).msg;
    if (typeof msg === "string" && msg.trim()) return msg;
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return null;
}

function formatErrorDetail(detail: unknown, fallback: string): string {
  const single = asMessage(detail);
  if (single) return single;

  if (Array.isArray(detail)) {
    const messages = detail.map(asMessage).filter((msg): msg is string => Boolean(msg));
    if (messages.length > 0) return messages.join(" ");
  }

  return fallback;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!isFormDataBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token && shouldAttachBearerToken(path)) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(toRequestUrl(path), {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: unknown };
    const detail = formatErrorDetail(body.detail, res.statusText || "Unauthorized");
    if (!isSessionOptionalAuthRoute(path)) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:expired"));
      throw new ApiError(401, "Session expired");
    }
    throw new ApiError(401, detail);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: unknown };
    const detail = formatErrorDetail(body.detail, res.statusText);
    throw new ApiError(res.status, detail);
  }
  return res.json();
}
