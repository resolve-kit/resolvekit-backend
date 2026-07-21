import { SignJWT } from "jose";

const AGENT_BASE_URL = (process.env.RESOLVEKIT_SERVER_AGENT_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const INTERNAL_AUDIENCE = process.env.RK_INTERNAL_SERVICE_AUDIENCE ?? "agent-service";
const INTERNAL_JWT_ALGORITHM = process.env.RK_INTERNAL_SERVICE_JWT_ALGORITHM ?? "HS256";

const INSECURE_KEY_VALUES = new Set(["", "change-me-internal-service-signing-key"]);

function resolveSigningKey(): string {
  const value = (process.env.RK_INTERNAL_SERVICE_SIGNING_KEY ?? "").trim();
  if (INSECURE_KEY_VALUES.has(value)) {
    if (process.env.NODE_ENV === "test") {
      return "test-only-internal-service-signing-key";
    }
    // Skip during `next build` — runtime secrets are not available at build time.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("RK_INTERNAL_SERVICE_SIGNING_KEY must be set to a secure non-default value");
    }
    return "build-phase-placeholder-internal-signing-key";
  }
  return value;
}

let _signingKey: string | null = null;
function getSigningKey(): string {
  if (_signingKey === null) _signingKey = resolveSigningKey();
  return _signingKey;
}

function jwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(getSigningKey());
}

async function buildServiceToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setIssuer("core-api")
    .setAudience(INTERNAL_AUDIENCE)
    .setSubject("core-api")
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .setProtectedHeader({ alg: INTERNAL_JWT_ALGORITHM })
    .sign(jwtSecretBytes());
}

export type AgentHumanMessage = {
  id: string;
  created_at: string;
  session_id: string;
  sequence_number: number;
  role: string;
  content: string | null;
};

export async function postHumanMessage(sessionId: string, text: string): Promise<AgentHumanMessage> {
  const token = await buildServiceToken();
  const response = await fetch(`${AGENT_BASE_URL}/internal/sessions/${sessionId}/human-message`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Agent internal human-message call failed: ${response.status} ${body}`);
  }

  return (await response.json()) as AgentHumanMessage;
}
