const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: unknown };
    const detail = formatErrorDetail(body.detail, res.statusText);
    throw new ApiError(res.status, detail);
  }
  return res.json();
}
