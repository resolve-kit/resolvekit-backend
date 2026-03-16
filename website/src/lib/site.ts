function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL ??
  "https://resolvekit.app";

export const siteName = "ResolveKit";
export const siteUrl = trimTrailingSlash(rawSiteUrl);
export const siteOrigin = new URL(siteUrl);
