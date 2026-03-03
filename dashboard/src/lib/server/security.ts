const INSECURE_VALUES = new Set(["", "change-me-in-production"]);

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return normalized + padding;
}

function hasValidFernetKey(value: string): boolean {
  try {
    return Buffer.from(toBase64(value), "base64").length === 32;
  } catch {
    return false;
  }
}

export function assertDashboardSecurityConfig(): void {
  if (process.env.NODE_ENV === "test") return;

  const jwtSecret = (process.env.IAA_JWT_SECRET ?? "").trim();
  if (INSECURE_VALUES.has(jwtSecret)) {
    throw new Error("IAA_JWT_SECRET must be set to a secure non-default value");
  }

  const encryptionKey = (process.env.IAA_ENCRYPTION_KEY ?? "").trim();
  if (!hasValidFernetKey(encryptionKey)) {
    throw new Error("IAA_ENCRYPTION_KEY must be a valid Fernet key");
  }
}
