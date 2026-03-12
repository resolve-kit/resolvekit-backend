const INTERNAL_PRESENTATION_PREFIX = "/presentation";
const ENTRY_PATH = "/enter";
const COOKIE_NAME = "resolvekit_presentation_access";
const SLUG_PATTERN = /^[a-z0-9-]{8,128}$/;

function normalizeSlug(rawSlug: string | undefined): string | null {
  const trimmed = rawSlug?.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || !SLUG_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export const PRESENTATION_ACCESS_COOKIE_NAME = COOKIE_NAME;
export const PRESENTATION_ENTRY_PATH = ENTRY_PATH;
export const PRESENTATION_INTERNAL_PATH = INTERNAL_PRESENTATION_PREFIX;

export function getPresentationSlug(): string | null {
  return normalizeSlug(process.env.PRESENTATION_SLUG);
}

export function getPresentationPassword(): string | null {
  const password = process.env.PRESENTATION_PASSWORD?.trim();
  return password ? password : null;
}

export function isPresentationAccessConfigured(): boolean {
  return Boolean(getPresentationSlug() && getPresentationPassword());
}

export function getPublicPresentationPath(): string | null {
  const slug = getPresentationSlug();
  return slug ? `/${slug}` : null;
}

export function isInternalPresentationPath(pathname: string): boolean {
  return pathname === INTERNAL_PRESENTATION_PREFIX || pathname.startsWith(`${INTERNAL_PRESENTATION_PREFIX}/`);
}

export function isPublicPresentationPath(pathname: string): boolean {
  const publicPath = getPublicPresentationPath();
  return Boolean(publicPath && (pathname === publicPath || pathname.startsWith(`${publicPath}/`)));
}

export function getInternalPresentationTarget(pathname: string): string {
  const publicPath = getPublicPresentationPath();
  if (!publicPath) {
    return pathname;
  }

  if (pathname === publicPath) {
    return INTERNAL_PRESENTATION_PREFIX;
  }

  return `${INTERNAL_PRESENTATION_PREFIX}${pathname.slice(publicPath.length)}`;
}

export function getPublicPresentationTargetFromInternal(pathname: string): string {
  const publicPath = getPublicPresentationPath();
  if (!publicPath) {
    return ENTRY_PATH;
  }

  if (pathname === INTERNAL_PRESENTATION_PREFIX) {
    return publicPath;
  }

  return `${publicPath}${pathname.slice(INTERNAL_PRESENTATION_PREFIX.length)}`;
}

export function sanitizePresentationReturnPath(candidate?: string | null): string {
  const fallback = getPublicPresentationPath() ?? ENTRY_PATH;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return isPublicPresentationPath(candidate) ? candidate : fallback;
}

export function getPresentationMediaPath(fileName: string): string {
  const basePath = getPublicPresentationPath() ?? INTERNAL_PRESENTATION_PREFIX;
  return `${basePath}/${encodeURIComponent(fileName)}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", encoded));
}

export async function getPresentationAccessCookieValue(): Promise<string | null> {
  const slug = getPresentationSlug();
  const password = getPresentationPassword();
  if (!slug || !password) {
    return null;
  }

  return sha256Hex(`resolvekit-presentation-access:${slug}:${password}`);
}

export async function hasValidPresentationAccessCookie(value?: string | null): Promise<boolean> {
  const expected = await getPresentationAccessCookieValue();
  return Boolean(value && expected && value === expected);
}
