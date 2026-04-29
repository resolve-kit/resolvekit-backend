import type { NextConfig } from "next";

const allowedDevOrigins = Array.from(
  new Set(
    [
      process.env.CADDY_PRIMARY_HOST,
      process.env.CADDY_WWW_HOST,
      process.env.CADDY_DASH_HOST,
      process.env.CADDY_API_HOST,
      process.env.RESOLVEKIT_PUBLIC_HOST,
      process.env.RESOLVEKIT_CONSOLE_HOST,
      process.env.RESOLVEKIT_API_HOST,
      process.env.RESOLVEKIT_AGENT_HOST,
      process.env.NEXT_ALLOWED_DEV_ORIGINS,
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Dashboard and API run separate Next dev processes from the same source tree.
  // Allow overriding distDir so they do not contend on a shared .next cache.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
