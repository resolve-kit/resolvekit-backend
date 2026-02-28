import { NextRequest, NextResponse } from "next/server";

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

export async function forwardToAgent(req: NextRequest, path: string[]): Promise<NextResponse> {
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

  const response = buildResponse(proxyResponse);
  if (proxyResponse.status === 401) {
    response.cookies.delete("dashboard_token");
  }
  return response;
}
