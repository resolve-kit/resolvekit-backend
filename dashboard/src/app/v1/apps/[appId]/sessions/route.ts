import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { loadSessionCostSummariesForSessions } from "@/lib/server/session-costs";
import { prisma } from "@/lib/server/prisma";
import { sessionOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const statusFilter = request.nextUrl.searchParams.get("status");
  const before = request.nextUrl.searchParams.get("before");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const offsetRaw = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;

  let beforeDate: Date | null = null;
  if (before) {
    const parsed = new Date(before.replace("Z", "+00:00"));
    if (Number.isNaN(parsed.valueOf())) {
      return detail(400, "Invalid before cursor");
    }
    beforeDate = parsed;
  }

  const sessions = await prisma.chatSession.findMany({
    where: {
      appId: app.id,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(beforeDate ? {} : { skip: offset }),
    take: limit,
  });

  const summariesBySessionId = await loadSessionCostSummariesForSessions(
    developer.organizationId,
    app.id,
    sessions.map((session) => session.id),
  );

  return NextResponse.json(
    sessions.map((session) => sessionOut(session, summariesBySessionId.get(session.id) ?? null)),
  );
}
