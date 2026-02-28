import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES, ORG_ROLE_ADMIN, ORG_ROLE_OWNER } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { memberOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type MemberRolePayload = {
  role?: "owner" | "admin" | "member";
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<MemberRolePayload>(request);
  if (!body || (body.role !== "owner" && body.role !== "admin" && body.role !== "member")) {
    return detail(422, "Invalid member role payload");
  }

  const { memberId } = await context.params;
  const target = await prisma.developerAccount.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== developer.organizationId) return detail(404, "Member not found");

  if (developer.role === ORG_ROLE_ADMIN && (target.role === ORG_ROLE_OWNER || body.role === ORG_ROLE_OWNER)) {
    return detail(403, "Admins cannot modify owner roles");
  }

  if (target.role === ORG_ROLE_OWNER && body.role !== ORG_ROLE_OWNER) {
    const ownerCount = await prisma.developerAccount.count({
      where: {
        organizationId: developer.organizationId,
        role: ORG_ROLE_OWNER,
      },
    });
    if (ownerCount <= 1) {
      return detail(400, "At least one owner must remain in the organization");
    }
  }

  const updated = await prisma.developerAccount.update({
    where: { id: target.id },
    data: { role: body.role },
  });

  return NextResponse.json(memberOut(updated));
}
