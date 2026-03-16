import type { Metadata } from "next";

import "./globals.css";
import { siteName, siteOrigin, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title: {
    default: `${siteName} | Resolve Product Issues Before They Hit Support`,
    template: `%s | ${siteName}`,
  },
  description:
    "ResolveKit embeds a product-aware support agent in your app so users can fix issues before they become support tickets, with approvals, audit trails, and centralized control.",
  applicationName: siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: `${siteName} | Resolve Product Issues Before They Hit Support`,
    description:
      "ResolveKit embeds a product-aware support agent in your app so users can fix issues before they become support tickets, with approvals, audit trails, and centralized control.",
  },
  twitter: {
    card: "summary",
    title: `${siteName} | Resolve Product Issues Before They Hit Support`,
    description:
      "ResolveKit embeds a product-aware support agent in your app so users can fix issues before they become support tickets, with approvals, audit trails, and centralized control.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
