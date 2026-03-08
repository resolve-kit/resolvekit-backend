import { createResolveKitClientTokenHandler } from "@resolvekit/nextjs/server";
import type { NextRequest } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";

function resolveAllowedOrigins(): string[] {
  const origins = new Set<string>();

  for (const rawValue of [process.env.IAA_CORS_ALLOWED_ORIGINS, process.env.NEXT_PUBLIC_DASHBOARD_URL]) {
    for (const value of (rawValue ?? "").split(",")) {
      const origin = value.trim();
      if (origin) {
        origins.add(origin);
      }
    }
  }

  if (origins.size === 0) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return [...origins];
}

const handler = createResolveKitClientTokenHandler({
  agentBaseUrl: process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL ?? "http://localhost:8000",
  resolveApiKey: () => process.env.RESOLVEKIT_KEY ?? null,
  authorizeRequest: async ({ request }) => (await getDeveloperFromRequest(request as NextRequest)) !== null,
  allowedOrigins: resolveAllowedOrigins(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
