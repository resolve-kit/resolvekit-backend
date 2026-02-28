import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbDelete, kbGet, kbUpdate } from "@/lib/server/kb-service";
import { prisma } from "@/lib/server/prisma";
import { upsertKbRef } from "@/lib/server/kb-refs";

export const dynamic = "force-dynamic";

type KnowledgeBaseUpdatePayload = {
  name?: string | null;
  description?: string | null;
  embedding_profile_id?: string | null;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const { kbId } = await context.params;

  try {
    const payload = await kbGet(actorContext(developer), kbId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<KnowledgeBaseUpdatePayload>(request);
  if (!body) return detail(422, "Invalid knowledge base update payload");

  const { kbId } = await context.params;

  try {
    const payload = await kbUpdate(actorContext(developer), kbId, {
      ...(Object.prototype.hasOwnProperty.call(body, "name") ? { name: body.name ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "description") ? { description: body.description ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "embedding_profile_id") ? { embedding_profile_id: body.embedding_profile_id ?? null } : {}),
      confirm_regeneration: body.confirm_regeneration ?? false,
    });

    if (payload.item && typeof payload.item === "object") {
      await upsertKbRef(developer.organizationId, payload.item as Record<string, unknown>);
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const { kbId } = await context.params;

  try {
    await kbDelete(actorContext(developer), kbId);
    await prisma.knowledgeBaseRef.deleteMany({
      where: {
        organizationId: developer.organizationId,
        externalKbId: kbId,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
