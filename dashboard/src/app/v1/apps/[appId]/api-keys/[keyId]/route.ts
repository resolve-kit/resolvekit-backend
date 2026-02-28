import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string; keyId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, keyId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.appId !== app.id) return detail(404, "API key not found");

  await prisma.$transaction(async (tx) => {
    await tx.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
    await tx.auditEvent.create({
      data: {
        id: crypto.randomUUID(),
        appId: app.id,
        actorEmail: developer.email,
        eventType: "apikey.revoked",
        entityId: key.id,
        entityName: key.label || key.keyPrefix,
      },
    });
  });

  return new NextResponse(null, { status: 204 });
}
