import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { organizationOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const organization = await prisma.organization.findUnique({ where: { id: developer.organizationId } });
  if (!organization) return detail(404, "Organization not found");
  return NextResponse.json(organizationOut(organization));
}
