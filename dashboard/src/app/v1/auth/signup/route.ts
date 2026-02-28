import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { attachDashboardSessionCookie, createAccessToken } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import {
  normalizeEmail,
  organizationPublicIdFromName,
  randomOrganizationPublicId,
  validateOrganizationPublicId,
} from "@/lib/server/organization";
import { passwordRequirementFailures } from "@/lib/server/password";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type SignupIntent = "create_org" | "join_org";

type SignupPayload = {
  email?: string;
  name?: string;
  password?: string;
  signup_intent?: SignupIntent;
  organization_name?: string | null;
  organization_public_id?: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request) {
  const body = await readJson<SignupPayload>(request);
  if (!body || typeof body.email !== "string" || typeof body.name !== "string" || typeof body.password !== "string") {
    return detail(422, "Invalid signup payload");
  }

  const email = normalizeEmail(body.email);
  const name = body.name.trim();
  const signupIntent: SignupIntent = body.signup_intent ?? "create_org";
  const organizationName = typeof body.organization_name === "string" ? body.organization_name.trim() : "";

  if (signupIntent === "join_org") {
    return detail(403, "Direct organization join is disabled. Ask an organization admin for an invitation.");
  }
  if (!organizationName) {
    return detail(422, "Organization name is required");
  }

  const passwordFailures = passwordRequirementFailures(body.password);
  if (passwordFailures.length > 0) {
    return detail(422, `Password does not meet requirements: ${passwordFailures.join("; ")}`);
  }

  const existingByEmail = await prisma.developerAccount.findUnique({ where: { email }, select: { id: true } });
  if (existingByEmail) {
    return detail(409, "Email already registered");
  }

  let requestedPublicId: string;
  try {
    requestedPublicId = body.organization_public_id
      ? validateOrganizationPublicId(body.organization_public_id)
      : organizationPublicIdFromName(organizationName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid organization ID";
    return detail(422, message);
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { publicId: requestedPublicId },
    select: { id: true },
  });
  if (existingOrg) {
    if (body.organization_public_id) {
      return detail(409, "Organization ID already in use");
    }
    requestedPublicId = randomOrganizationPublicId(organizationName);
    const fallbackExists = await prisma.organization.findUnique({
      where: { publicId: requestedPublicId },
      select: { id: true },
    });
    if (fallbackExists) {
      return detail(409, "Could not generate unique organization ID");
    }
  }

  const hashedPassword = await bcrypt.hash(body.password, 12);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          id: crypto.randomUUID(),
          name: organizationName,
          publicId: requestedPublicId,
        },
      });
      const developer = await tx.developerAccount.create({
        data: {
          id: crypto.randomUUID(),
          email,
          name,
          hashedPassword,
          role: "owner",
          organizationId: organization.id,
        },
      });
      return { organization, developer };
    });

    const accessToken = await createAccessToken(created.developer.id);
    const response = NextResponse.json(
      { access_token: accessToken, token_type: "bearer" },
      { status: 201 },
    );
    attachDashboardSessionCookie(response, accessToken);
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return detail(409, "Organization ID already in use");
    }
    throw error;
  }
}
