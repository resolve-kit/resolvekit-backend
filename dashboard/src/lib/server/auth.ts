import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "./prisma";

function resolveJwtSecret(): string {
  const value = (process.env.IAA_JWT_SECRET ?? "").trim();
  const insecureValues = new Set(["", "change-me-in-production"]);
  if (insecureValues.has(value)) {
    if (process.env.NODE_ENV === "test") {
      return "test-only-dashboard-jwt-secret";
    }
    throw new Error("IAA_JWT_SECRET must be set to a secure non-default value");
  }
  return value;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_ALGORITHM = process.env.IAA_JWT_ALGORITHM ?? "HS256";
const JWT_EXPIRE_MINUTES = Number(process.env.IAA_JWT_EXPIRE_MINUTES ?? "1440");
const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET);

export type AuthDeveloper = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  createdAt: Date;
};

export async function createAccessToken(developerId: string): Promise<string> {
  const expSeconds = Math.floor(Date.now() / 1000) + JWT_EXPIRE_MINUTES * 60;
  return new SignJWT({})
    .setSubject(developerId)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setExpirationTime(expSeconds)
    .sign(JWT_SECRET_BYTES);
}

export function attachDashboardSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set("dashboard_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: JWT_EXPIRE_MINUTES * 60,
  });
}

export function clearDashboardSessionCookie(response: NextResponse): void {
  response.cookies.delete("dashboard_token");
}

function tokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return request.cookies.get("dashboard_token")?.value ?? null;
}

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES, {
      algorithms: [JWT_ALGORITHM],
    });
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export async function getDeveloperFromRequest(request: NextRequest): Promise<AuthDeveloper | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const developerId = await verifyToken(token);
  if (!developerId) return null;
  const developer = await prisma.developerAccount.findUnique({
    where: { id: developerId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      createdAt: true,
    },
  });
  if (!developer) return null;
  return developer;
}

export async function getDeveloperFromCookieStore(): Promise<AuthDeveloper | null> {
  const store = await cookies();
  const token = store.get("dashboard_token")?.value;
  if (!token) return null;
  const developerId = await verifyToken(token);
  if (!developerId) return null;
  const developer = await prisma.developerAccount.findUnique({
    where: { id: developerId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      createdAt: true,
    },
  });
  if (!developer) return null;
  return developer;
}
