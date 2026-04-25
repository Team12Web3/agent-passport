import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Passport",
  description: "Verifiable identity for autonomous agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
