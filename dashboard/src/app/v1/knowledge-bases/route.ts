import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { decryptWithFernet } from "@/lib/server/fernet";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbCreate, kbList } from "@/lib/server/kb-service";
import { inferModelCapabilities } from "@/lib/server/provider";
import { prisma } from "@/lib/server/prisma";
import { syncRefsFromKbList, upsertKbRef } from "@/lib/server/kb-refs";

export const dynamic = "force-dynamic";

type KnowledgeBaseCreatePayload = {
  name?: string;
  description?: string | null;
  embedding_profile_id?: string;
  summary_llm_profile_id?: string;
  summary_model?: string;
};

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) throw new Error("Organization not found");
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
    const payload = await kbList(actorContext(developer));
    const items = Array.isArray(payload.items) ? payload.items : [];
    await syncRefsFromKbList(developer.organizationId, items);
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

  const body = await readJson<KnowledgeBaseCreatePayload>(request);
  if (
    !body
    || typeof body.name !== "string"
    || typeof body.embedding_profile_id !== "string"
    || typeof body.summary_llm_profile_id !== "string"
    || typeof body.summary_model !== "string"
  ) {
    return detail(422, "Invalid knowledge base payload");
  }
  const summaryModel = body.summary_model.trim();
  if (!summaryModel) return detail(422, "Summary model is required");
  if (!inferModelCapabilities(summaryModel).ocr_compatible) {
    return detail(422, "Summary model must be chat-capable");
  }

  const summaryProfile = await prisma.organizationLlmProviderProfile.findUnique({
    where: { id: body.summary_llm_profile_id },
  });
  if (!summaryProfile || summaryProfile.organizationId !== developer.organizationId) {
    return detail(404, "LLM profile not found");
  }

  try {
    const payload = await kbCreate(actorContext(developer), {
      name: body.name,
      description: body.description ?? null,
      embedding_profile_id: body.embedding_profile_id,
      summary_llm_profile_id: summaryProfile.id,
      summary_llm_profile_name: summaryProfile.name,
      summary_provider: summaryProfile.provider,
      summary_model: summaryModel,
      summary_api_key: decryptWithFernet(summaryProfile.apiKeyEncrypted),
      summary_api_base: summaryProfile.apiBase,
    });

    if (payload.item && typeof payload.item === "object") {
      await upsertKbRef(developer.organizationId, payload.item as Record<string, unknown>);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
