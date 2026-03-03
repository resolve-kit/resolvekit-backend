import { NextResponse } from "next/server";

import { clearDashboardSessionCookie } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearDashboardSessionCookie(response);
  return response;
}
