import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { playbookOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type PlaybookFunctionIn = {
  function_id?: string;
  step_order?: number;
  step_description?: string | null;
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, playbookId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const playbook = await prisma.playbook.findUnique({ where: { id: playbookId } });
  if (!playbook || playbook.appId !== app.id) return detail(404, "Playbook not found");

  const body = await readJson<PlaybookFunctionIn[]>(request);
  if (!Array.isArray(body)) return detail(422, "Invalid playbook function payload");

  const functionIds = body
    .map((item) => item.function_id)
    .filter((id): id is string => typeof id === "string");

  if (functionIds.length !== body.length) {
    return detail(422, "Invalid function IDs");
  }

  if (functionIds.length > 0) {
    const validIds = await prisma.registeredFunction.findMany({
      where: {
        id: { in: functionIds },
        appId: app.id,
      },
      select: { id: true },
    });
    const valid = new Set(validIds.map((item) => item.id));
    const invalid = functionIds.filter((id) => !valid.has(id));
    if (invalid.length > 0) {
      return detail(400, `Invalid function IDs: ${invalid.join(", ")}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.playbookFunction.deleteMany({ where: { playbookId } });
    if (body.length > 0) {
      await tx.playbookFunction.createMany({
        data: body.map((item) => ({
          playbookId,
          functionId: item.function_id as string,
          stepOrder: typeof item.step_order === "number" ? item.step_order : 0,
          stepDescription: typeof item.step_description === "string" ? item.step_description : null,
        })),
      });
    }
  });

  const updated = await prisma.playbook.findUnique({
    where: { id: playbookId },
    include: {
      playbookFunctions: {
        include: { function: { select: { name: true } } },
      },
    },
  });

  if (!updated) return detail(404, "Playbook not found");
  return NextResponse.json(playbookOut(updated));
}
