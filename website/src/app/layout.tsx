import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ResolveKit | Resolve Product Issues Before They Hit Support",
  description:
    "ResolveKit embeds a product-aware support agent in your app so users can fix issues before they become support tickets, with approvals, audit trails, and centralized control.",
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
