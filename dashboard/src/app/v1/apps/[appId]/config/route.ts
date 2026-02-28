import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "config"]);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "config"]);
}
