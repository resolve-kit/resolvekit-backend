import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const { invitationId } = await context.params;
  const invitation = await prisma.organizationInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.organizationId !== developer.organizationId) {
    return detail(404, "Invitation not found");
  }

  if (invitation.status !== "pending") {
    return detail(409, "Invitation is not pending");
  }

  const canCancel = developer.id === invitation.inviterDeveloperId || ORG_ADMIN_ROLES.has(developer.role);
  if (!canCancel) {
    return detail(403, "Insufficient organization permissions");
  }

  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: { status: "canceled" },
  });

  return new NextResponse(null, { status: 204 });
}
