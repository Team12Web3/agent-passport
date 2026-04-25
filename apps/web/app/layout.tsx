import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Passport",
  description:
    "Trust by signature, not by CAPTCHA. Verifiable AI agent identity, agent wallets, and on-chain audit trails built on Avalanche."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
