import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type CreateApiKeyPayload = {
  label?: string;
};

function apiKeyOut(key: {
  id: string;
  keyPrefix: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: key.id,
    key_prefix: key.keyPrefix,
    label: key.label,
    is_active: key.isActive,
    created_at: key.createdAt,
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

  const keys = await prisma.apiKey.findMany({
    where: { appId: app.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys.map(apiKeyOut));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<CreateApiKeyPayload>(request);
  const label = typeof body?.label === "string" ? body.label : "";

  const rawKey = `rk_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);

  const created = await prisma.$transaction(async (tx) => {
    const key = await tx.apiKey.create({
      data: {
        id: crypto.randomUUID(),
        appId: app.id,
        keyHash,
        keyPrefix,
        label,
      },
    });
    await tx.auditEvent.create({
      data: {
        id: crypto.randomUUID(),
        appId: app.id,
        actorEmail: developer.email,
        eventType: "apikey.created",
        entityId: key.id,
        entityName: label || key.keyPrefix,
      },
    });
    return key;
  });

  return NextResponse.json(
    {
      ...apiKeyOut(created),
      raw_key: rawKey,
    },
    { status: 201 },
  );
}
