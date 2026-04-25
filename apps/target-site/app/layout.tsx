import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PopUpMart | Agent Passport Target Demo",
  description: "Mock human-only website with an Agent Passport verification lane.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
