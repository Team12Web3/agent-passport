import "./globals.css";

export const metadata = {
  title: "Agent Passport Dashboard",
  description: "Monitor AI agents, reputation, and task activity"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

