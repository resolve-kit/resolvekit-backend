import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { messageOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ appId: string; sessionId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, sessionId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.appId !== app.id) return detail(404, "Session not found");

  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { sequenceNumber: "asc" },
  });

  return NextResponse.json(messages.map(messageOut));
}
