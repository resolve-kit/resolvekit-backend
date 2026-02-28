import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { embeddingProfilesChangeImpact, KBServiceError } from "@/lib/server/kb-service";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type EmbeddingProfileChangeImpactPayload = {
  llm_profile_id?: string | null;
  embedding_model?: string | null;
};

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) throw new Error("Organization not found");
  return {
    orgId: developer.organizationId,
    actorId: developer.id,
    actorRole: developer.role,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<EmbeddingProfileChangeImpactPayload>(request);
  if (!body) return detail(422, "Invalid embedding profile change-impact payload");

  let profile = null as Awaited<ReturnType<typeof prisma.organizationLlmProviderProfile.findUnique>>;
  if (typeof body.llm_profile_id === "string") {
    profile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: body.llm_profile_id } });
    if (!profile || profile.organizationId !== developer.organizationId) {
      return detail(404, "LLM profile not found");
    }
  }

  const { profileId } = await context.params;

  try {
    const payload = await embeddingProfilesChangeImpact(actorContext(developer), profileId, {
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { llm_profile_id: profile?.id ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { provider: profile?.provider ?? null } : {}),
      ...(typeof body.embedding_model === "string" ? { embedding_model: body.embedding_model } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { api_base: profile?.apiBase ?? null } : {}),
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
