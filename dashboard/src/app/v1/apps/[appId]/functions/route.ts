import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { functionOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const functions = await prisma.registeredFunction.findMany({
    where: { appId: app.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(functions.map(functionOut));
}
