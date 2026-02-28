import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { invitationOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const now = new Date();
  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      inviteeDeveloperId: developer.id,
      status: "pending",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations.map(invitationOut));
}
