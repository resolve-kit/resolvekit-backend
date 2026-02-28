import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ kbId: string; documentId: string }> },
) {
  const { kbId, documentId } = await context.params;
  return forwardToAgent(request, ["knowledge-bases", kbId, "documents", documentId]);
}
