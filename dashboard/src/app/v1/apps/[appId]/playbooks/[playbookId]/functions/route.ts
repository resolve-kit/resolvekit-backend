import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ appId: string; playbookId: string }> },
) {
  const { appId, playbookId } = await context.params;
  return forwardToAgent(request, ["apps", appId, "playbooks", playbookId, "functions"]);
}
