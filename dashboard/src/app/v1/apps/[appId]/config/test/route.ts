import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { getOrCreateConfig, resolveModelLookup } from "@/lib/server/config-service";
import { detail, readJson } from "@/lib/server/http";
import { testProviderConnection } from "@/lib/server/provider";

export const dynamic = "force-dynamic";

type ConnectionTestPayload = {
  provider?: string;
  llm_api_key?: string | null;
  llm_api_base?: string | null;
};

export async function POST(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<ConnectionTestPayload>(request);
  if (!body || typeof body.provider !== "string") {
    return detail(422, "Provider is required");
  }

  try {
    const cfg = await getOrCreateConfig(app.id);
    const lookup = await resolveModelLookup({
      organizationId: app.organizationId,
      cfg,
      provider: body.provider,
      llmApiKey: body.llm_api_key ?? null,
      llmApiBase: body.llm_api_base ?? null,
    });

    const result = await testProviderConnection(lookup.provider, lookup.apiKey, lookup.apiBase);
    return NextResponse.json(result);
  } catch (error) {
    return detail(400, error instanceof Error ? error.message : "Failed to test provider");
  }
}
