import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbSearch } from "@/lib/server/kb-service";

export const dynamic = "force-dynamic";

type SearchPayload = {
  query?: string;
  limit?: number;
};

function actorContext(developer: { organizationId: string | null; id: string; role: string }) {
  if (!developer.organizationId) throw new Error("Organization not found");
  return {
    orgId: developer.organizationId,
    actorId: developer.id,
    actorRole: developer.role,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const body = await readJson<SearchPayload>(request);
  if (!body || typeof body.query !== "string") return detail(422, "Query is required");
  const limit = typeof body.limit === "number" ? Math.min(50, Math.max(1, Math.trunc(body.limit))) : 10;

  const { kbId } = await context.params;

  try {
    const payload = await kbSearch(actorContext(developer), kbId, {
      query: body.query,
      limit,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
