import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { defaultChatTheme, normalizeChatTheme } from "@/lib/server/chat-theme";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

function normalizeOrDefaultTheme(rawTheme: unknown): {
  normalized: ReturnType<typeof normalizeChatTheme>;
  shouldPersist: boolean;
} {
  try {
    const normalized = normalizeChatTheme(rawTheme);
    const shouldPersist = JSON.stringify(rawTheme) !== JSON.stringify(normalized);
    return { normalized, shouldPersist };
  } catch {
    return {
      normalized: normalizeChatTheme(defaultChatTheme()),
      shouldPersist: true,
    };
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  try {
    const { normalized, shouldPersist } = normalizeOrDefaultTheme(app.chatTheme);
    if (shouldPersist) {
      await prisma.app.update({
        where: { id: app.id },
        data: { chatTheme: normalized as Prisma.InputJsonValue },
      });
    }
    return NextResponse.json(normalized);
  } catch (error) {
    return detail(422, error instanceof Error ? error.message : "Invalid chat theme");
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson(request);
  if (!body) return detail(422, "Invalid chat theme payload");

  try {
    const normalized = normalizeChatTheme(body);
    await prisma.app.update({
      where: { id: app.id },
      data: { chatTheme: normalized as Prisma.InputJsonValue },
    });
    return NextResponse.json(normalized);
  } catch (error) {
    return detail(422, error instanceof Error ? error.message : "Invalid chat theme");
  }
}
