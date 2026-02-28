import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbGet } from "@/lib/server/kb-service";
import { prisma } from "@/lib/server/prisma";
import { upsertKbRef } from "@/lib/server/kb-refs";

export const dynamic = "force-dynamic";

type AppKnowledgeBasesPayload = {
  knowledge_base_ids?: string[];
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
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const refs = await prisma.knowledgeBaseRef.findMany({
    where: {
      appAssignments: {
        some: { appId: app.id },
      },
    },
    orderBy: { nameCache: "asc" },
  });

  return NextResponse.json({
    items: refs.map((ref) => ({ id: ref.externalKbId, name: ref.nameCache })),
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<AppKnowledgeBasesPayload>(request);
  if (!body || !Array.isArray(body.knowledge_base_ids)) {
    return detail(422, "Invalid app knowledge base assignment payload");
  }

  const uniqueKbIds = [...new Set(body.knowledge_base_ids)];
  const refs: Array<{ id: string; externalKbId: string; nameCache: string }> = [];

  for (const kbId of uniqueKbIds) {
    let ref = await prisma.knowledgeBaseRef.findFirst({
      where: {
        organizationId: developer.organizationId,
        externalKbId: kbId,
      },
    });

    if (!ref) {
      try {
        const payload = await kbGet(actorContext(developer), kbId);
        if (!payload.item || typeof payload.item !== "object") {
          return detail(502, "Invalid KB service response");
        }
        ref = await upsertKbRef(developer.organizationId, payload.item as Record<string, unknown>);
      } catch (error) {
        if (error instanceof KBServiceError) return detail(error.status, error.message);
        return detail(503, "Knowledge base service unavailable");
      }
    }

    refs.push(ref);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appKnowledgeBase.deleteMany({ where: { appId: app.id } });
    if (refs.length > 0) {
      await tx.appKnowledgeBase.createMany({
        data: refs.map((ref) => ({
          appId: app.id,
          knowledgeBaseRefId: ref.id,
        })),
      });
    }
  });

  return NextResponse.json({
    items: refs.map((ref) => ({ id: ref.externalKbId, name: ref.nameCache })),
  });
}
