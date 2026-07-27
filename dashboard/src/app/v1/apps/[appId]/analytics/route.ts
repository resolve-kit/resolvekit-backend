import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { coerceDbNumber } from "@/lib/server/numbers";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type DailyRow = {
  day: Date;
  total: number | string | bigint;
  resolved: number | string | bigint;
  escalated: number | string | bigint;
};

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
    return detail(400, "Invalid from/to date");
  }

  const [totalSessions, resolvedSessions, escalatedByStatus, escalatedByResolver, feedbackAgg, dailyRows] =
    await Promise.all([
      prisma.chatSession.count({
        where: { appId: app.id, createdAt: { gte: from, lte: to } },
      }),
      prisma.chatSession.count({
        where: { appId: app.id, createdAt: { gte: from, lte: to }, resolvedBy: "ai" },
      }),
      prisma.chatSession.count({
        where: { appId: app.id, createdAt: { gte: from, lte: to }, status: "escalated" },
      }),
      prisma.chatSession.count({
        where: { appId: app.id, createdAt: { gte: from, lte: to }, resolvedBy: "human" },
      }),
      prisma.sessionFeedback.aggregate({
        where: { session: { appId: app.id, createdAt: { gte: from, lte: to } } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE resolved_by = 'ai')::bigint AS resolved,
          COUNT(*) FILTER (WHERE status = 'escalated' OR resolved_by = 'human')::bigint AS escalated
        FROM chat_sessions
        WHERE app_id = ${app.id}::uuid
          AND created_at >= ${from}
          AND created_at <= ${to}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

  const ratingDistribution = await prisma.sessionFeedback.groupBy({
    by: ["rating"],
    where: { session: { appId: app.id, createdAt: { gte: from, lte: to } } },
    _count: { rating: true },
  });

  const escalatedSessions = Math.max(escalatedByStatus, escalatedByResolver);

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    total_sessions: totalSessions,
    resolved_sessions: resolvedSessions,
    escalated_sessions: escalatedSessions,
    abandoned_sessions: Math.max(0, totalSessions - resolvedSessions - escalatedSessions),
    resolution_rate: totalSessions > 0 ? resolvedSessions / totalSessions : 0,
    escalation_rate: totalSessions > 0 ? escalatedSessions / totalSessions : 0,
    avg_csat: feedbackAgg._avg.rating ?? null,
    csat_response_count: feedbackAgg._count.rating,
    csat_distribution: ratingDistribution
      .map((row) => ({ rating: row.rating, count: row._count.rating }))
      .sort((a, b) => a.rating - b.rating),
    daily: dailyRows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      total: coerceDbNumber(row.total),
      resolved: coerceDbNumber(row.resolved),
      escalated: coerceDbNumber(row.escalated),
    })),
  });
}
