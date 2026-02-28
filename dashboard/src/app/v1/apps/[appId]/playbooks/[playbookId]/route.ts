import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const { appId, playbookId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "playbooks", playbookId]);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const { appId, playbookId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "playbooks", playbookId]);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const { appId, playbookId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "playbooks", playbookId]);
}
