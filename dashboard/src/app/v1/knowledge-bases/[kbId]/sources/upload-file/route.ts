import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { KBServiceError, kbSourcesAddUploadFile } from "@/lib/server/kb-service";

export const dynamic = "force-dynamic";

// 50 MB upload limit
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

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

  const form = await request.formData().catch(() => null);
  if (!form) return detail(422, "Invalid multipart payload");

  const file = form.get("file");
  if (!(file instanceof File)) return detail(422, "File is required");

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return detail(413, `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
  }

  const filename = (file.name ?? "").trim();
  if (!filename) return detail(422, "Uploaded file must have a name");

  const titleRaw = form.get("title");
  const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : undefined;

  const { kbId } = await context.params;

  try {
    const payload = await kbSourcesAddUploadFile(actorContext(developer), kbId, {
      filename,
      content: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type || "application/octet-stream",
      ...(title ? { title } : {}),
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof KBServiceError) return detail(error.status, error.message);
    return detail(503, "Knowledge base service unavailable");
  }
}
