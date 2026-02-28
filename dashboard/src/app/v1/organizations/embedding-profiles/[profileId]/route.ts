import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { decryptWithFernet } from "@/lib/server/fernet";
import { detail, readJson } from "@/lib/server/http";
import { embeddingProfilesDelete, embeddingProfilesUpdate, KBServiceError } from "@/lib/server/kb-service";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type EmbeddingProfileUpdatePayload = {
  name?: string;
  llm_profile_id?: string | null;
  embedding_model?: string;
  confirm_regeneration?: boolean;
};

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) throw new Error("Organization not found");
  return {
    orgId: developer.organizationId,
    actorId: developer.id,
    actorRole: developer.role,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<EmbeddingProfileUpdatePayload>(request);
  if (!body) return detail(422, "Invalid embedding profile update payload");

  let llmProfile = null as Awaited<ReturnType<typeof prisma.organizationLlmProviderProfile.findUnique>>;
  if (typeof body.llm_profile_id === "string") {
    llmProfile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: body.llm_profile_id } });
    if (!llmProfile || llmProfile.organizationId !== developer.organizationId) {
      return detail(404, "LLM profile not found");
    }
  }

  const { profileId } = await context.params;

  try {
    const payload = await embeddingProfilesUpdate(actorContext(developer), profileId, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { llm_profile_id: llmProfile?.id ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { llm_profile_name: llmProfile?.name ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { provider: llmProfile?.provider ?? null } : {}),
      ...(typeof body.embedding_model === "string" ? { embedding_model: body.embedding_model } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { api_key: llmProfile ? decryptWithFernet(llmProfile.apiKeyEncrypted) : null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { api_base: llmProfile?.apiBase ?? null } : {}),
      confirm_regeneration: body.confirm_regeneration ?? false,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const { profileId } = await context.params;

  try {
    await embeddingProfilesDelete(actorContext(developer), profileId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
