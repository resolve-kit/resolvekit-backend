import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dashboard and API run separate Next dev processes from the same source tree.
  // Allow overriding distDir so they do not contend on a shared .next cache.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
