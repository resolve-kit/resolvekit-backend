import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type UpdateAppPayload = {
  name?: string | null;
  bundle_id?: string | null;
  integration_enabled?: boolean;
};

function appOut(app: {
  id: string;
  developerId: string;
  organizationId: string;
  name: string;
  bundleId: string | null;
  integrationEnabled: boolean;
  createdAt: Date;
}) {
  return {
    id: app.id,
    developer_id: app.developerId,
    organization_id: app.organizationId,
    name: app.name,
    bundle_id: app.bundleId,
    integration_enabled: app.integrationEnabled,
    created_at: app.createdAt,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");
  return NextResponse.json(appOut(app));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const existing = await getOwnedAppOrNull(appId, developer);
  if (!existing) return detail(404, "App not found");

  const body = await readJson<UpdateAppPayload>(request);
  if (!body) return detail(422, "Invalid app update payload");

  const updateData: {
    name?: string;
    bundleId?: string | null;
    integrationEnabled?: boolean;
    integrationVersion?: { increment: number };
  } = {};

  if (typeof body.name === "string") {
    updateData.name = body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "bundle_id")) {
    updateData.bundleId = body.bundle_id ?? null;
  }
  if (typeof body.integration_enabled === "boolean" && body.integration_enabled !== existing.integrationEnabled) {
    updateData.integrationEnabled = body.integration_enabled;
    updateData.integrationVersion = { increment: 1 };
  }

  const app = await prisma.app.update({
    where: { id: appId },
    data: updateData,
  });
  return NextResponse.json(appOut(app));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const existing = await getOwnedAppOrNull(appId, developer);
  if (!existing) return detail(404, "App not found");
  await prisma.app.delete({ where: { id: appId } });
  return new NextResponse(null, { status: 204 });
}
