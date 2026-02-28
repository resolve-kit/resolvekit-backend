import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { decryptWithFernet } from "@/lib/server/fernet";
import { detail } from "@/lib/server/http";
import { listModelsForProvider } from "@/lib/server/provider";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const profileId = request.nextUrl.searchParams.get("llm_profile_id");
  if (!profileId) return detail(422, "llm_profile_id is required");

  const profile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.organizationId !== developer.organizationId) {
    return detail(404, "LLM profile not found");
  }

  const result = await listModelsForProvider(
    profile.provider,
    decryptWithFernet(profile.apiKeyEncrypted),
    profile.apiBase,
  );

  return NextResponse.json({
    llm_profile_id: profile.id,
    provider: profile.provider,
    models: result.models,
    is_dynamic: result.is_dynamic,
    error: result.error,
  });
}
