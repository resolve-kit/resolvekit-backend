import { NextRequest, NextResponse } from "next/server";

import { ORG_ROLE_MEMBER } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { invitationOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { invitationId } = await context.params;
  const invitation = await prisma.organizationInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.inviteeDeveloperId !== developer.id) {
    return detail(404, "Invitation not found");
  }

  if (invitation.status !== "pending") {
    return detail(409, "Invitation is not pending");
  }

  const now = new Date();
  if (invitation.expiresAt <= now) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "expired" },
    });
    return detail(410, "Invitation has expired");
  }

  const accepted = await prisma.$transaction(async (tx) => {
    await tx.developerAccount.update({
      where: { id: developer.id },
      data: {
        organizationId: invitation.organizationId,
        role: ORG_ROLE_MEMBER,
      },
    });

    await tx.app.updateMany({
      where: { developerId: developer.id },
      data: { organizationId: invitation.organizationId },
    });

    return tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "accepted",
        acceptedAt: now,
      },
    });
  });

  return NextResponse.json(invitationOut(accepted));
}
