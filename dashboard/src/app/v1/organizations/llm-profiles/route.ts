import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { encryptWithFernet } from "@/lib/server/fernet";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { llmProfileOut } from "@/lib/server/serializers";
import { testProviderConnection, validateProviderApiBase } from "@/lib/server/provider";

export const dynamic = "force-dynamic";

type LlmProfileCreatePayload = {
  name?: string;
  provider?: string;
  api_key?: string;
  api_base?: string | null;
};

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const profiles = await prisma.organizationLlmProviderProfile.findMany({
    where: { organizationId: developer.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(profiles.map(llmProfileOut));
}

export async function POST(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<LlmProfileCreatePayload>(request);
  if (!body || typeof body.name !== "string" || typeof body.provider !== "string" || typeof body.api_key !== "string") {
    return detail(422, "Invalid LLM profile payload");
  }

  const provider = body.provider.trim().toLowerCase();
  const apiKey = body.api_key.trim();
  if (!apiKey) return detail(400, "API key required");
  const requestedApiBase = typeof body.api_base === "string" && body.api_base.trim() ? body.api_base.trim() : null;
  const apiBaseValidation = validateProviderApiBase(provider, requestedApiBase);
  if (!apiBaseValidation.ok) return detail(400, apiBaseValidation.error ?? "Invalid provider API base URL");
  const apiBase = apiBaseValidation.normalized;

  const check = await testProviderConnection(provider, apiKey, apiBase);
  if (!check.ok) {
    return detail(400, check.error ?? "Invalid provider API key");
  }

  try {
    const created = await prisma.organizationLlmProviderProfile.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: developer.organizationId,
        name: body.name.trim(),
        provider,
        model: "default",
        apiKeyEncrypted: encryptWithFernet(apiKey),
        apiBase,
      },
    });

    return NextResponse.json(llmProfileOut(created), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return detail(409, "LLM profile name already exists");
    }
    throw error;
  }
}
