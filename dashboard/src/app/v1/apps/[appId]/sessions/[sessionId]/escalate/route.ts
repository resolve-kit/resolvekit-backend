import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { postSessionEscalated } from "@/lib/server/agent-service";
import { prisma } from "@/lib/server/prisma";
import { sessionOut } from "@/lib/server/serializers";

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
  if (session.status === "closed") return detail(409, "Session is already closed");

  const reason = `Manually taken over by ${developer.name}`;
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: "escalated",
      escalatedAt: new Date(),
      escalationReason: reason,
    },
  });

  // Best-effort: notify any connected client so it can show the escalated
  // state and suppress a stale CSAT prompt. Don't fail the takeover if the
  // agent is unreachable.
  await postSessionEscalated(sessionId, reason).catch(() => {});

  return NextResponse.json(sessionOut(updated));
}
