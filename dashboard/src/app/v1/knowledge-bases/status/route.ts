import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { getKbIntegrationStatus } from "@/lib/server/kb-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const status = await getKbIntegrationStatus();
  return NextResponse.json(status);
}
