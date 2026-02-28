import { NextRequest } from "next/server";

import { forwardToAgent } from "@/lib/server/agent-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return forwardToAgent(request, ["organizations", "embedding-models"]);
}
