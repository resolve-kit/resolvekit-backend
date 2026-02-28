import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbCreate, kbList } from "@/lib/server/kb-service";
import { syncRefsFromKbList, upsertKbRef } from "@/lib/server/kb-refs";

export const dynamic = "force-dynamic";

type KnowledgeBaseCreatePayload = {
  name?: string;
  description?: string | null;
  embedding_profile_id?: string;
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
  if (!body || typeof body.name !== "string" || typeof body.embedding_profile_id !== "string") {
    return detail(422, "Invalid knowledge base payload");
  }

  try {
    const payload = await kbCreate(actorContext(developer), {
      name: body.name,
      description: body.description ?? null,
      embedding_profile_id: body.embedding_profile_id,
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
