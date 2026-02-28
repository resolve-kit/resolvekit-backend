import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { KBServiceError, kbSourcesAddUrl } from "@/lib/server/kb-service";

export const dynamic = "force-dynamic";

type UrlSourcePayload = {
  url?: string;
  title?: string | null;
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
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<UrlSourcePayload>(request);
  if (!body || typeof body.url !== "string") return detail(422, "URL is required");

  const { kbId } = await context.params;

  try {
    const payload = await kbSourcesAddUrl(actorContext(developer), kbId, {
      url: body.url,
      title: typeof body.title === "string" ? body.title : null,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
