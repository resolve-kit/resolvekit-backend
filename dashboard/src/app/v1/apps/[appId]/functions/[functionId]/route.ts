import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { functionOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type FunctionUpdatePayload = {
  description?: string;
  description_override?: string | null;
  parameters_schema?: Record<string, unknown>;
  is_active?: boolean;
  timeout_seconds?: number;
  availability?: Record<string, unknown>;
  source?: "app_inline" | "playbook_pack";
  pack_name?: string | null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ appId: string; functionId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, functionId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const fn = await prisma.registeredFunction.findUnique({ where: { id: functionId } });
  if (!fn || fn.appId !== app.id) return detail(404, "Function not found");

  const body = await readJson<FunctionUpdatePayload>(request);
  if (!body) return detail(422, "Invalid function update payload");
  if (
    Object.prototype.hasOwnProperty.call(body, "required_entitlements")
    || Object.prototype.hasOwnProperty.call(body, "required_capabilities")
  ) {
    return detail(422, "required_entitlements and required_capabilities are no longer supported");
  }

  const oldIsActive = fn.isActive;
  const oldOverride = fn.descriptionOverride;

  const data: {
    description?: string;
    descriptionOverride?: string | null;
    parametersSchema?: Prisma.InputJsonValue;
    isActive?: boolean;
    timeoutSeconds?: number;
    availability?: Prisma.InputJsonValue;
    source?: "app_inline" | "playbook_pack";
    packName?: string | null;
  } = {};

  if (typeof body.description === "string") data.description = body.description;
  if (Object.prototype.hasOwnProperty.call(body, "description_override")) data.descriptionOverride = body.description_override ?? null;
  if (body.parameters_schema && typeof body.parameters_schema === "object") {
    data.parametersSchema = body.parameters_schema as Prisma.InputJsonValue;
  }
  if (typeof body.is_active === "boolean") data.isActive = body.is_active;
  if (typeof body.timeout_seconds === "number") data.timeoutSeconds = body.timeout_seconds;
  if (body.availability && typeof body.availability === "object") {
    data.availability = body.availability as Prisma.InputJsonValue;
  }
  if (body.source === "app_inline" || body.source === "playbook_pack") data.source = body.source;
  if (Object.prototype.hasOwnProperty.call(body, "pack_name")) data.packName = body.pack_name ?? null;

  const updated = await prisma.registeredFunction.update({
    where: { id: functionId },
    data,
  });

  const auditEvents: Array<{
    eventType: string;
    entityName: string;
  }> = [];

  if (typeof data.isActive === "boolean" && data.isActive !== oldIsActive) {
    auditEvents.push({
      eventType: data.isActive ? "function.activated" : "function.deactivated",
      entityName: updated.name,
    });
  }

  if (Object.prototype.hasOwnProperty.call(data, "descriptionOverride") && data.descriptionOverride !== oldOverride) {
    auditEvents.push({
      eventType: "function.override_set",
      entityName: updated.name,
    });
  }

  if (auditEvents.length > 0) {
    await prisma.auditEvent.createMany({
      data: auditEvents.map((event) => ({
        id: crypto.randomUUID(),
        appId: app.id,
        actorEmail: developer.email,
        eventType: event.eventType,
        entityId: functionId,
        entityName: event.entityName,
      })),
    });
  }

  return NextResponse.json(functionOut(updated));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string; functionId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId, functionId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const fn = await prisma.registeredFunction.findUnique({ where: { id: functionId } });
  if (!fn || fn.appId !== app.id) return detail(404, "Function not found");

  await prisma.registeredFunction.update({
    where: { id: functionId },
    data: { isActive: false },
  });

  return new NextResponse(null, { status: 204 });
}
