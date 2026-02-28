import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import {
  defaultOrganizationName,
  randomOrganizationPublicId,
} from "@/lib/server/organization";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type CreateAppPayload = {
  name?: string;
  bundle_id?: string | null;
};

function appOut(app: {
  id: string;
  developerId: string;
  organizationId: string;
  name: string;
  bundleId: string | null;
  integrationEnabled: boolean;
  createdAt: Date;
}) {
  return {
    id: app.id,
    developer_id: app.developerId,
    organization_id: app.organizationId,
    name: app.name,
    bundle_id: app.bundleId,
    integration_enabled: app.integrationEnabled,
    created_at: app.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return NextResponse.json([]);

  const apps = await prisma.app.findMany({
    where: { organizationId: developer.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(apps.map(appOut));
}

async function ensureDeveloperOrganization(developerId: string, developerName: string, organizationId: string | null) {
  if (organizationId) return organizationId;
  const org = await prisma.organization.create({
    data: {
      id: crypto.randomUUID(),
      name: defaultOrganizationName(developerName),
      publicId: randomOrganizationPublicId(developerName),
    },
  });
  await prisma.developerAccount.update({
    where: { id: developerId },
    data: {
      organizationId: org.id,
      role: "owner",
    },
  });
  return org.id;
}

export async function POST(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const body = await readJson<CreateAppPayload>(request);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return detail(422, "App name is required");
  }

  const orgId = await ensureDeveloperOrganization(
    developer.id,
    developer.name,
    developer.organizationId ?? null,
  );

  try {
    const app = await prisma.app.create({
      data: {
        id: crypto.randomUUID(),
        developerId: developer.id,
        organizationId: orgId,
        name: body.name.trim(),
        bundleId: typeof body.bundle_id === "string" ? body.bundle_id : null,
      },
    });
    return NextResponse.json(appOut(app), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return detail(409, "App name already exists");
    }
    throw error;
  }
}
