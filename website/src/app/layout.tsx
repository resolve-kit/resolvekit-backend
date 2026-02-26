import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Playbook Website",
  description: "Marketing website for Playbook.",
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
