import Link from "next/link";
import { ArrowLeft, Mountain, Wallet } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(232,65,66,0.14),transparent_28%),linear-gradient(180deg,#0a1220_0%,#111827_100%)] px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-halo backdrop-blur">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          back to home
        </Link>
        <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
          <Mountain className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Sign in to your control plane</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Start with the smooth demo flow now. This page is intentionally minimal so Person 2 can
          swap in the real Thirdweb button without changing the surrounding experience.
        </p>
        <div className="mt-8">
          <LoginButton className="flex w-full justify-center" label="Continue with email" />
        </div>
        <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85">
          <Wallet className="h-4 w-4" />
          Sign in with wallet
        </div>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
          <Mountain className="h-3.5 w-3.5 text-[var(--accent)]" />
          Powered by Avalanche Fuji
        </div>
      </div>
    </main>
  );
}
