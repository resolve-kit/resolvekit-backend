import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

const marketingRoutes = [
  {
    url: siteUrl,
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    url: `${siteUrl}/pricing`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return marketingRoutes.map((route) => ({
    ...route,
    lastModified,
  }));
}
