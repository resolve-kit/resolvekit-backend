import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";
const DEFAULT_ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DASHBOARD_SHELL_PATHS = ["/login", "/apps", "/knowledge-bases", "/organization"] as const;

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const allowedOrigins = parseAllowedOrigins(process.env.IAA_CORS_ALLOWED_ORIGINS);
  if (allowedOrigins.has(origin)) {
    return origin;
  }

  try {
    const originUrl = new URL(origin);
    if (originUrl.hostname === request.nextUrl.hostname && originUrl.protocol === request.nextUrl.protocol) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const allowedOrigin = resolveAllowedOrigin(request);
  if (!allowedOrigin) return response;

  const requestedHeaders = request.headers.get("access-control-request-headers");
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", requestedHeaders || DEFAULT_ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin, Access-Control-Request-Headers");
  return response;
}

function normalizedApiPath(pathname: string): string | null {
  if (pathname === "/api/v1") return "/v1";
  if (pathname.startsWith("/api/v1/")) return `/v1/${pathname.slice("/api/v1/".length)}`;
  if (pathname === "/v1/v1") return "/v1";
  if (pathname.startsWith("/v1/v1/")) return `/v1/${pathname.slice("/v1/v1/".length)}`;
  return null;
}

function needsDashboardShellRewrite(pathname: string): boolean {
  return DASHBOARD_SHELL_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest): NextResponse {
  if (request.method === "OPTIONS") {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  const rewrittenPath = normalizedApiPath(request.nextUrl.pathname);
  if (rewrittenPath) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = rewrittenPath;
    return applyCorsHeaders(request, NextResponse.rewrite(rewriteUrl));
  }

  if (request.method === "GET" && needsDashboardShellRewrite(request.nextUrl.pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/";
    return NextResponse.rewrite(rewriteUrl);
  }

  return applyCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: ["/v1/:path*", "/api/v1/:path*", "/login", "/apps/:path*", "/knowledge-bases/:path*", "/organization/:path*"],
};
