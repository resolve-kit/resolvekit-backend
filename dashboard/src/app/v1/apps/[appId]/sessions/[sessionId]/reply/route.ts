import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { postHumanMessage } from "@/lib/server/agent-service";

export const dynamic = "force-dynamic";

export async function POST(
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

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return detail(400, "text is required");

  // The agent service owns the Message write and pushes it onto the session's
  // live SSE stream — do not also write it here, or the message would be duplicated.
  const message = await postHumanMessage(sessionId, text);

  return NextResponse.json(message);
}
