import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { resolveOnboardingState } from "@/lib/server/onboarding";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const organization = await prisma.organization.findUnique({ where: { id: developer.organizationId } });
  if (!organization) return detail(404, "Organization not found");

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      onboardingCompletedAt: null,
      onboardingTargetAppId: null,
      onboardingResetCount: (organization.onboardingResetCount ?? 0) + 1,
    },
  });

  const payload = await resolveOnboardingState(developer);
  return NextResponse.json(payload);
}
