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
  {
    url: `${siteUrl}/use-cases/in-app-customer-support`,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  },
  {
    url: `${siteUrl}/use-cases/ai-support-with-approvals`,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  },
  {
    url: `${siteUrl}/use-cases/reduce-support-tickets-in-app`,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return marketingRoutes.map((route) => ({
    ...route,
    lastModified,
  }));
}
