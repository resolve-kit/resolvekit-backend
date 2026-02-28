import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) {
    return detail(401, "Invalid token");
  }
  return NextResponse.json({
    id: developer.id,
    email: developer.email,
    name: developer.name,
    role: developer.role,
    organization_id: developer.organizationId,
    created_at: developer.createdAt,
  });
}
