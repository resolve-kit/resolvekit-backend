import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { getOrCreateConfig, resolveModelLookup } from "@/lib/server/config-service";
import { detail, readJson } from "@/lib/server/http";
import { listModelsForProvider } from "@/lib/server/provider";

export const dynamic = "force-dynamic";

type ModelsLookupPayload = {
  provider?: string | null;
  llm_api_key?: string | null;
  llm_api_base?: string | null;
};

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  try {
    const cfg = await getOrCreateConfig(app.id);
    const providerParam = request.nextUrl.searchParams.get("provider");
    const lookup = await resolveModelLookup({
      organizationId: app.organizationId,
      cfg,
      provider: providerParam,
      llmApiKey: null,
      llmApiBase: null,
    });

    const result = await listModelsForProvider(lookup.provider, lookup.apiKey, lookup.apiBase);
    return NextResponse.json({
      provider: lookup.provider,
      models: result.models.map((model) => ({
        id: model.id,
        name: model.name,
        capabilities: model.capabilities,
      })),
      is_dynamic: result.is_dynamic,
      error: result.error,
    });
  } catch (error) {
    return detail(400, error instanceof Error ? error.message : "Failed to load models");
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<ModelsLookupPayload>(request);
  if (!body) return detail(422, "Invalid models lookup payload");

  try {
    const cfg = await getOrCreateConfig(app.id);
    const lookup = await resolveModelLookup({
      organizationId: app.organizationId,
      cfg,
      provider: body.provider ?? null,
      llmApiKey: body.llm_api_key ?? null,
      llmApiBase: body.llm_api_base ?? null,
    });

    const result = await listModelsForProvider(lookup.provider, lookup.apiKey, lookup.apiBase);
    return NextResponse.json({
      provider: lookup.provider,
      models: result.models.map((model) => ({
        id: model.id,
        name: model.name,
        capabilities: model.capabilities,
      })),
      is_dynamic: result.is_dynamic,
      error: result.error,
    });
  } catch (error) {
    return detail(400, error instanceof Error ? error.message : "Failed to load models");
  }
}
