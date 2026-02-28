import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { playbookListOut, playbookOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type PlaybookCreatePayload = {
  name?: string;
  description?: string;
  instructions?: string;
  is_active?: boolean;
};

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const playbooks = await prisma.playbook.findMany({
    where: { appId: app.id },
    include: {
      _count: {
        select: { playbookFunctions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(playbooks.map((pb) => playbookListOut(pb, pb._count.playbookFunctions)));
}

export async function POST(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<PlaybookCreatePayload>(request);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return detail(422, "Playbook name is required");
  }

  const created = await prisma.playbook.create({
    data: {
      id: crypto.randomUUID(),
      appId: app.id,
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description : "",
      instructions: typeof body.instructions === "string" ? body.instructions : "",
      isActive: body.is_active ?? true,
    },
    include: {
      playbookFunctions: {
        include: { function: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(playbookOut(created), { status: 201 });
}
