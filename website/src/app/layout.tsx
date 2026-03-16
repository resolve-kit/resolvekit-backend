import type { Metadata } from "next";

import "./globals.css";
import { siteName, siteOrigin, siteUrl } from "@/lib/site";

const defaultTitle = `${siteName} | Resolve Product Issues Before They Hit Support`;
const defaultDescription =
  "ResolveKit embeds a product-aware support agent in your app so users can fix issues before they become support tickets, with approvals, audit trails, and centralized control.";

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
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
