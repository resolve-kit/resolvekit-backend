import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { attachDashboardSessionCookie, createAccessToken } from "@/lib/server/auth";
import { detail, readJson } from "@/lib/server/http";
import { normalizeEmail } from "@/lib/server/organization";
import { prisma } from "@/lib/server/prisma";
import { getClientIp, isRateLimited } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = await readJson<LoginPayload>(request);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return detail(422, "Invalid login payload");
  }

  const ip = getClientIp(request);
  if (isRateLimited({ bucket: "auth-login-ip", key: ip, limit: 40, windowMs: 15 * 60 * 1000 })) {
    return detail(429, "Too many login attempts. Try again later.");
  }

  const email = normalizeEmail(body.email);
  if (isRateLimited({ bucket: "auth-login-email", key: email, limit: 12, windowMs: 15 * 60 * 1000 })) {
    return detail(429, "Too many login attempts. Try again later.");
  }

  const developer = await prisma.developerAccount.findUnique({
    where: { email },
  });
  if (!developer) return detail(401, "Invalid credentials");

  const passwordMatches = await bcrypt.compare(body.password, developer.hashedPassword);
  if (!passwordMatches) return detail(401, "Invalid credentials");

  const accessToken = await createAccessToken(developer.id);
  const response = NextResponse.json({
    access_token: accessToken,
    token_type: "bearer",
  });
  attachDashboardSessionCookie(response, accessToken);
  return response;
}
