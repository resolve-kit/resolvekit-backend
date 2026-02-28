import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playbook Dashboard",
  description: "Playbook control plane",
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
