import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { playbookOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type PlaybookUpdatePayload = {
  name?: string;
  description?: string;
  instructions?: string;
  is_active?: boolean;
};

async function loadOwnedPlaybook(playbookId: string, appId: string) {
  return prisma.playbook.findUnique({
    where: { id: playbookId },
    include: {
      playbookFunctions: {
        include: { function: { select: { name: true } } },
      },
    },
  }).then((pb) => {
    if (!pb || pb.appId !== appId) return null;
    return pb;
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, playbookId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const playbook = await loadOwnedPlaybook(playbookId, app.id);
  if (!playbook) return detail(404, "Playbook not found");
  return NextResponse.json(playbookOut(playbook));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, playbookId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const existing = await prisma.playbook.findUnique({ where: { id: playbookId } });
  if (!existing || existing.appId !== app.id) return detail(404, "Playbook not found");

  const body = await readJson<PlaybookUpdatePayload>(request);
  if (!body) return detail(422, "Invalid playbook update payload");

  const updated = await prisma.playbook.update({
    where: { id: playbookId },
    data: {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.instructions === "string" ? { instructions: body.instructions } : {}),
      ...(typeof body.is_active === "boolean" ? { isActive: body.is_active } : {}),
    },
    include: {
      playbookFunctions: {
        include: { function: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(playbookOut(updated));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, playbookId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const existing = await prisma.playbook.findUnique({ where: { id: playbookId } });
  if (!existing || existing.appId !== app.id) return detail(404, "Playbook not found");

  await prisma.playbook.delete({ where: { id: playbookId } });
  return new NextResponse(null, { status: 204 });
}
