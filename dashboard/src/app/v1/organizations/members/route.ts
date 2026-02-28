import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { memberOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const members = await prisma.developerAccount.findMany({
    where: { organizationId: developer.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members.map(memberOut));
}
