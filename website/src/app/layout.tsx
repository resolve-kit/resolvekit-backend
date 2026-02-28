import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Playbook | LLM Agent Support Command Center",
  description:
    "Embed SDK chat support in your mobile or web app and power it with an LLM agent that understands your product and can execute approved device functions.",
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
