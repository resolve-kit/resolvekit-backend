import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  return forwardToAgent(request, ["organizations", "embedding-profiles", profileId]);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  return forwardToAgent(request, ["organizations", "embedding-profiles", profileId]);
}
