import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08111d]/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3 font-semibold text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Shield className="h-5 w-5 text-[var(--accent)]" />
          </span>
          Agent Passport
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <Link href="/about" className="transition hover:text-white">
            About
          </Link>
          <Link href="/#how-it-works" className="transition hover:text-white">
            How it works
          </Link>
          <Link
            href={siteConfig.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            GitHub
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[#d63435]"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
