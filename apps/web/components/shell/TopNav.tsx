"use client";

import Link from "next/link";
import { Plus, Shield, UserCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function TopNav() {
  const { address, isLoggedIn } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold text-slate-950">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Shield className="h-5 w-5 text-[var(--accent)]" />
          </span>
          Agent Passport
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard?onboard=1"
            className="hidden items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            New Agent
          </Link>
          <Link
            href="/about"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 md:inline-flex"
          >
            Protocol
          </Link>
          {isLoggedIn && (
            <div className="flex items-center gap-2 rounded-full border border-black/5 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <UserCircle2 className="h-4 w-4" />
              <span className="font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
