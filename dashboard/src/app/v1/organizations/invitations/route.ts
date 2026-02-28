import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { ORG_ADMIN_ROLES } from "@/lib/server/authorization";
import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { invitationOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

const INVITATION_TTL_DAYS = 7;

type InvitationCreatePayload = {
  email?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");
  if (!ORG_ADMIN_ROLES.has(developer.role)) return detail(403, "Insufficient organization permissions");

  const body = await readJson<InvitationCreatePayload>(request);
  if (!body || typeof body.email !== "string") return detail(422, "Email is required");

  const inviteeEmail = normalizeEmail(body.email);
  const invitee = await prisma.developerAccount.findUnique({ where: { email: inviteeEmail } });
  if (!invitee) return detail(404, "Invitation target must be a registered user");
  if (invitee.id === developer.id) return detail(400, "Cannot invite yourself");
  if (invitee.organizationId === developer.organizationId) return detail(409, "User is already in your organization");

  const now = new Date();
  const pending = await prisma.organizationInvitation.findFirst({
    where: {
      organizationId: developer.organizationId,
      inviteeDeveloperId: invitee.id,
      status: "pending",
      expiresAt: { gt: now },
    },
  });
  if (pending) return detail(409, "Pending invitation already exists");

  const invitation = await prisma.organizationInvitation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: developer.organizationId,
      inviterDeveloperId: developer.id,
      inviteeDeveloperId: invitee.id,
      inviteeEmail,
      status: "pending",
      expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json(invitationOut(invitation), { status: 201 });
}
