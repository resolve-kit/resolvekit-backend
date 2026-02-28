import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

const AGENT_API_BASE_URL = (process.env.AGENT_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const DASHBOARD_INTERNAL_TOKEN = process.env.DASHBOARD_INTERNAL_TOKEN ?? "";
const AUTH_PATHS = new Set(["auth/login", "auth/signup"]);

function copyForwardHeaders(input: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of input.entries()) {
    const lowered = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowered) || lowered === "host") {
      continue;
    }
    out.set(key, value);
  }
  return out;
}

function withCookieAuth(req: NextRequest, headers: Headers): void {
  if (!headers.has("Authorization")) {
    const sessionToken = req.cookies.get("dashboard_token")?.value;
    if (sessionToken) {
      headers.set("Authorization", `Bearer ${sessionToken}`);
    }
  }
}

function withInternalBoundary(headers: Headers): void {
  if (DASHBOARD_INTERNAL_TOKEN) {
    headers.set("X-Internal-Dashboard-Token", DASHBOARD_INTERNAL_TOKEN);
  }
}

function buildTargetUrl(req: NextRequest, path: string[]): URL {
  const safePath = path.map((segment) => encodeURIComponent(segment)).join("/");
  return new URL(`${AGENT_API_BASE_URL}/v1/${safePath}${req.nextUrl.search}`);
}

function buildResponse(proxyResponse: Response): NextResponse {
  const response = new NextResponse(proxyResponse.body, { status: proxyResponse.status });
  for (const [key, value] of proxyResponse.headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      response.headers.set(key, value);
    }
  }
  return response;
}

async function maybeAttachSessionCookie(
  req: NextRequest,
  path: string[],
  proxyResponse: Response,
): Promise<NextResponse> {
  const routePath = path.join("/");
  if (!AUTH_PATHS.has(routePath)) {
    return buildResponse(proxyResponse);
  }

  const contentType = proxyResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return buildResponse(proxyResponse);
  }

  const payload = await proxyResponse.clone().json().catch(() => null) as { access_token?: string } | null;
  const accessToken = payload?.access_token;
  const response = buildResponse(proxyResponse);
  if (!accessToken || typeof accessToken !== "string") {
    return response;
  }

  response.cookies.set("dashboard_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const headers = copyForwardHeaders(req.headers);
  withCookieAuth(req, headers);
  withInternalBoundary(headers);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const proxyResponse = await fetch(buildTargetUrl(req, path), {
    method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  if (proxyResponse.status === 401) {
    const response = buildResponse(proxyResponse);
    response.cookies.delete("dashboard_token");
    return response;
  }
  return maybeAttachSessionCookie(req, path, proxyResponse);
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}
