import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { decryptWithFernet, encryptWithFernet } from "@/lib/server/fernet";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { llmProfileOut } from "@/lib/server/serializers";
import { testProviderConnection, validateProviderApiBase } from "@/lib/server/provider";

export const dynamic = "force-dynamic";

type LlmProfileUpdatePayload = {
  name?: string;
  provider?: string;
  api_key?: string;
  api_base?: string | null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const { profileId } = await context.params;
  const profile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.organizationId !== developer.organizationId) {
    return detail(404, "LLM profile not found");
  }

  const body = await readJson<LlmProfileUpdatePayload>(request);
  if (!body) return detail(422, "Invalid LLM profile update payload");

  const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : profile.provider;
  const requestedApiBase = Object.prototype.hasOwnProperty.call(body, "api_base")
    ? (typeof body.api_base === "string" && body.api_base.trim() ? body.api_base.trim() : null)
    : profile.apiBase;
  const apiBaseValidation = validateProviderApiBase(provider, requestedApiBase);
  if (!apiBaseValidation.ok) {
    return detail(400, apiBaseValidation.error ?? "Invalid provider API base URL");
  }
  const apiBase = apiBaseValidation.normalized;

  const nextApiKey = Object.prototype.hasOwnProperty.call(body, "api_key")
    ? (typeof body.api_key === "string" ? body.api_key.trim() : "")
    : decryptWithFernet(profile.apiKeyEncrypted);

  if (Object.prototype.hasOwnProperty.call(body, "api_key") && !nextApiKey) {
    return detail(400, "API key required");
  }

  const needsConnectionCheck = (
    Object.prototype.hasOwnProperty.call(body, "provider")
    || Object.prototype.hasOwnProperty.call(body, "api_base")
    || Object.prototype.hasOwnProperty.call(body, "api_key")
  );

  if (needsConnectionCheck) {
    const check = await testProviderConnection(provider, nextApiKey, apiBase);
    if (!check.ok) {
      return detail(400, check.error ?? "Invalid provider API key");
    }
  }

  try {
    const updated = await prisma.organizationLlmProviderProfile.update({
      where: { id: profile.id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        provider,
        apiBase,
        ...(Object.prototype.hasOwnProperty.call(body, "api_key") ? { apiKeyEncrypted: encryptWithFernet(nextApiKey) } : {}),
      },
    });
    return NextResponse.json(llmProfileOut(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return detail(409, "LLM profile name already exists");
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const { profileId } = await context.params;
  const profile = await prisma.organizationLlmProviderProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.organizationId !== developer.organizationId) {
    return detail(404, "LLM profile not found");
  }

  const inUse = await prisma.agentConfig.findFirst({
    where: { llmProfileId: profile.id },
    select: { id: true },
  });
  if (inUse) {
    return detail(409, "Profile is assigned to one or more apps");
  }

  await prisma.organizationLlmProviderProfile.delete({ where: { id: profile.id } });
  return new NextResponse(null, { status: 204 });
}
