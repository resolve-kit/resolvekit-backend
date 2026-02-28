import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { auditEventOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;
  const cursor = request.nextUrl.searchParams.get("cursor");
  const eventType = request.nextUrl.searchParams.get("event_type");

  let cursorDate: Date | null = null;
  if (cursor) {
    const parsed = new Date(cursor);
    if (Number.isNaN(parsed.valueOf())) return detail(400, "Invalid cursor");
    cursorDate = parsed;
  }

  const rows = await prisma.auditEvent.findMany({
    where: {
      appId: app.id,
      ...(eventType ? { eventType } : {}),
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit);

  return NextResponse.json({
    events: events.map(auditEventOut),
    next_cursor: hasMore && events.length > 0 ? events[events.length - 1].createdAt.toISOString() : null,
  });
}
