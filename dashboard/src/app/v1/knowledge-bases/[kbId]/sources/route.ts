import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kbId: string }> },
) {
  const { kbId } = await context.params;
  return forwardToAgent(request, ["knowledge-bases", kbId, "sources"]);
}
