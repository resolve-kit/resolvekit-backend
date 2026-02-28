import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  return forwardToAgent(request, ["organizations", "invitations", invitationId, "accept"]);
}
