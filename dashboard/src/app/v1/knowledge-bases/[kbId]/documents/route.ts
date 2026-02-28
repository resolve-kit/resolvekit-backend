import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { KBServiceError, kbDocumentsList } from "@/lib/server/kb-service";

export const dynamic = "force-dynamic";

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) throw new Error("Organization not found");
  return {
    orgId: developer.organizationId,
    actorId: developer.id,
    actorRole: developer.role,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const { kbId } = await context.params;
  const query = request.nextUrl.searchParams.get("query");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;

  try {
    const payload = await kbDocumentsList(actorContext(developer), kbId, {
      query,
      limit,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
