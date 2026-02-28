import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { resolveOnboardingState } from "@/lib/server/onboarding";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  try {
    const payload = await resolveOnboardingState(developer);
    return NextResponse.json(payload);
  } catch (error) {
    return detail(404, error instanceof Error ? error.message : "Organization not found");
  }
}
