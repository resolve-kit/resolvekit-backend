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

// Lazily resolved so `resolveJwtSecret()` runs at request time, not at
// module evaluation (which would break `next build` where runtime secrets
// are unavailable).
let _jwtSecret: string | null = null;
function getJwtSecret(): string {
  if (_jwtSecret === null) _jwtSecret = resolveJwtSecret();
  return _jwtSecret;
}

const ALLOWED_JWT_ALGORITHMS = new Set(["HS256", "HS384", "HS512"]);

function resolveJwtAlgorithm(): string {
  const raw = (process.env.IAA_JWT_ALGORITHM ?? "").trim();
  // Fall back to HS256 when the env var is absent or empty (e.g. during build).
  if (!raw) return "HS256";
  if (!ALLOWED_JWT_ALGORITHMS.has(raw)) {
    throw new Error(
      `IAA_JWT_ALGORITHM must be one of: ${[...ALLOWED_JWT_ALGORITHMS].join(", ")}. Got: "${raw}"`,
    );
  }
  return raw;
}

const JWT_ALGORITHM = resolveJwtAlgorithm();
const JWT_EXPIRE_MINUTES = Number(process.env.IAA_JWT_EXPIRE_MINUTES ?? "1440");

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
    .sign(new TextEncoder().encode(getJwtSecret()));
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
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getJwtSecret()), {
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
