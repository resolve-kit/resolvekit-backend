import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { decryptWithFernet } from "@/lib/server/fernet";
import { detail, readJson } from "@/lib/server/http";
import { embeddingProfilesCreate, embeddingProfilesList, KBServiceError } from "@/lib/server/kb-service";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type EmbeddingProfileCreatePayload = {
  name?: string;
  llm_profile_id?: string;
  embedding_model?: string;
};

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) {
    throw new Error("Organization not found");
  }
  return {
    orgId: developer.organizationId,
    actorId: developer.id,
    actorRole: developer.role,
  };
}

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  try {
    const payload = await embeddingProfilesList(actorContext(developer));
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}

export async function POST(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<EmbeddingProfileCreatePayload>(request);
  if (!body || typeof body.name !== "string" || typeof body.llm_profile_id !== "string" || typeof body.embedding_model !== "string") {
    return detail(422, "Invalid embedding profile payload");
  }

  const llmProfile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: body.llm_profile_id } });
  if (!llmProfile || llmProfile.organizationId !== developer.organizationId) {
    return detail(404, "LLM profile not found");
  }

  try {
    const payload = await embeddingProfilesCreate(actorContext(developer), {
      name: body.name,
      llm_profile_id: llmProfile.id,
      llm_profile_name: llmProfile.name,
      provider: llmProfile.provider,
      embedding_model: body.embedding_model,
      api_key: decryptWithFernet(llmProfile.apiKeyEncrypted),
      api_base: llmProfile.apiBase,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
