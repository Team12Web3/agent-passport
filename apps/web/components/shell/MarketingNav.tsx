import Link from "next/link";
import { Shield } from "lucide-react";
import { AuthCta } from "@/components/shell/AuthCta";
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
          <a href="#problem" className="transition hover:text-white">
            Problem
          </a>
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
          <Link
            href={siteConfig.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            GitHub
          </Link>
          <AuthCta
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[#052e1f] transition hover:bg-[#6ee7b7]"
            loggedOutLabel="Sign in"
            loggedInLabel="Dashboard"
            iconClassName="h-4 w-4"
          />
        </nav>
      </div>
    </header>
  );
}
