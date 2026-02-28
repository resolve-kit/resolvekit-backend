import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { invitationOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const now = new Date();
  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      organizationId: developer.organizationId,
      status: "pending",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations.map(invitationOut));
}
