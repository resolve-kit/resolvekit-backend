import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ appId: string; functionId: string }> },
) {
  const { appId, functionId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "functions", functionId]);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string; functionId: string }> },
) {
  const { appId, functionId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "functions", functionId]);
}
