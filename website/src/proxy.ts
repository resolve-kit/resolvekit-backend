import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  PRESENTATION_ACCESS_COOKIE_NAME,
  PRESENTATION_ENTRY_PATH,
  getInternalPresentationTarget,
  getPublicPresentationTargetFromInternal,
  hasValidPresentationAccessCookie,
  isInternalPresentationPath,
  isPresentationAccessConfigured,
  isPublicPresentationPath,
} from "@/lib/presentation-access";

function buildEntryRedirect(request: NextRequest, nextPath: string, error?: string): NextResponse {
  const redirectUrl = new URL(PRESENTATION_ENTRY_PATH, request.url);
  redirectUrl.searchParams.set("next", nextPath);
  if (error) {
    redirectUrl.searchParams.set("error", error);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const isPublicPresentationRequest = isPublicPresentationPath(pathname);
  const isInternalPresentationRequest = isInternalPresentationPath(pathname);
  if (!isPublicPresentationRequest && !isInternalPresentationRequest) {
    return NextResponse.next();
  }

  if (!isPresentationAccessConfigured()) {
    const nextPath = isPublicPresentationRequest
      ? `${pathname}${search}`
      : getPublicPresentationTargetFromInternal(pathname);
    return buildEntryRedirect(request, nextPath, "config");
  }

  const cookieValue = request.cookies.get(PRESENTATION_ACCESS_COOKIE_NAME)?.value;
  const hasAccess = await hasValidPresentationAccessCookie(cookieValue);

  if (!hasAccess) {
    const nextPath = isPublicPresentationRequest
      ? `${pathname}${search}`
      : `${getPublicPresentationTargetFromInternal(pathname)}${search}`;
    return buildEntryRedirect(request, nextPath);
  }

  if (isInternalPresentationRequest) {
    const redirectUrl = new URL(getPublicPresentationTargetFromInternal(pathname), request.url);
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = getInternalPresentationTarget(pathname);
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
