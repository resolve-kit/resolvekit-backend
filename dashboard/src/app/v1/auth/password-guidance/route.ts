import { NextResponse } from "next/server";

import { PASSWORD_MINIMUM_LENGTH, PASSWORD_REQUIREMENT_GUIDANCE } from "@/lib/server/password";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    minimum_length: PASSWORD_MINIMUM_LENGTH,
    requirements: PASSWORD_REQUIREMENT_GUIDANCE,
  });
}
