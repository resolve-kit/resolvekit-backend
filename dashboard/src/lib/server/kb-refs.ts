import crypto from "crypto";

import { prisma } from "./prisma";

export async function upsertKbRef(
  organizationId: string,
  kbPayload: Record<string, unknown>,
) {
  const kbIdRaw = kbPayload.id;
  const kbName = typeof kbPayload.name === "string" && kbPayload.name.trim() ? kbPayload.name : "Knowledge Base";
  if (typeof kbIdRaw !== "string") {
    throw new Error("Invalid KB service response");
  }

  const existing = await prisma.knowledgeBaseRef.findFirst({
    where: {
      organizationId,
      externalKbId: kbIdRaw,
    },
  });

  if (existing) {
    return prisma.knowledgeBaseRef.update({
      where: { id: existing.id },
      data: { nameCache: kbName },
    });
  }

  return prisma.knowledgeBaseRef.create({
    data: {
      id: crypto.randomUUID(),
      organizationId,
      externalKbId: kbIdRaw,
      nameCache: kbName,
    },
  });
}

export async function syncRefsFromKbList(organizationId: string, items: unknown[]) {
  for (const item of items) {
    if (item && typeof item === "object") {
      await upsertKbRef(organizationId, item as Record<string, unknown>);
    }
  }
}
