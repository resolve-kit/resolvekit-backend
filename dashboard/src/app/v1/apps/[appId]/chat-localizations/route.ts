import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { buildCatalogResponse, sanitizeOverridesForStorage } from "@/lib/server/chat-localizations";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type ChatLocalizationsUpdate = {
  overrides?: Record<string, Record<string, string>>;
};

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  return NextResponse.json({ locales: buildCatalogResponse(app) });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<ChatLocalizationsUpdate>(request);
  if (!body || !body.overrides || typeof body.overrides !== "object") {
    return detail(422, "Invalid chat localizations payload");
  }

  const stored = sanitizeOverridesForStorage(body.overrides);
  const updated = await prisma.app.update({
    where: { id: app.id },
    data: { chatLocalizationOverrides: stored as Prisma.InputJsonValue },
  });

  return NextResponse.json({ locales: buildCatalogResponse(updated) });
}
