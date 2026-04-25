import Link from "next/link";
import { Github } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white/75">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Built at Web3NZ Hackathon 2026. Trust by signature, not by CAPTCHA.</p>
        <Link
          href={siteConfig.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-medium text-slate-900 transition hover:text-[var(--accent)]"
        >
          <Github className="h-4 w-4" />
          GitHub
        </Link>
      </div>
    </footer>
  );
}
