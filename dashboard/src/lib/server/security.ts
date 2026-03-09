import crypto from "crypto";

const INSECURE_VALUES = new Set(["", "change-me-in-production"]);
const FERNET_KEY_ERROR = "IAA_ENCRYPTION_KEY must be a valid Fernet key";
const LOCAL_FERNET_NAMESPACE = "resolvekit-dashboard-local-fernet";

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + padding;
}

export function hasValidFernetKey(value: string): boolean {
  try {
    return Buffer.from(toBase64(value), "base64").length === 32;
  } catch {
    return false;
  }
}

function deriveLocalFernetKey(jwtSecret: string): string {
  return crypto
    .createHash("sha256")
    .update(`${LOCAL_FERNET_NAMESPACE}:${jwtSecret}`)
    .digest("base64url");
}

export function resolveDashboardEncryptionKey(): string {
  const configuredKey = (process.env.IAA_ENCRYPTION_KEY ?? "").trim();
  if (hasValidFernetKey(configuredKey)) {
    return configuredKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(FERNET_KEY_ERROR);
  }

  const jwtSecret = (process.env.IAA_JWT_SECRET ?? "").trim();
  if (INSECURE_VALUES.has(jwtSecret)) {
    throw new Error("IAA_JWT_SECRET must be set to a secure non-default value");
  }

  return deriveLocalFernetKey(jwtSecret);
}

export function assertDashboardSecurityConfig(): void {
  if (process.env.NODE_ENV === "test") return;
  // Skip during `next build` — runtime secrets are not available at build time
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const jwtSecret = (process.env.IAA_JWT_SECRET ?? "").trim();
  if (INSECURE_VALUES.has(jwtSecret)) {
    throw new Error("IAA_JWT_SECRET must be set to a secure non-default value");
  }

  resolveDashboardEncryptionKey();
}
