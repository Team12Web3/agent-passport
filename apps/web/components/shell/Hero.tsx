import Link from "next/link";
import { ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { siteConfig } from "@/lib/site";

const outcomes = [
  "Agent gets a wallet and on-chain passport in one flow",
  "Every action becomes an auditable Avalanche event",
  "Trusted sites can welcome agents without CAPTCHA"
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(232,65,66,0.2),transparent_35%)]" />
      <div className="grid-hero absolute inset-0 animate-gridPulse opacity-40" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-4xl animate-fadeRise">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Wallet className="h-4 w-4 text-[var(--accent)]" />
            {siteConfig.avalancheLabel}
          </div>
          <h1 className="mt-8 text-balance text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            The Internet was built for humans.
          </h1>
          <p className="mt-4 max-w-3xl text-balance text-2xl font-medium text-slate-200 sm:text-4xl">
            We&apos;re onboarding the agents.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Give every AI agent a passport. Verifiable identity, on-chain audit logs, and a wallet
            of its own.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <LoginButton className="h-14 px-8 text-base" label="Continue with email" />
            <LoginButton
              variant="ghost"
              className="h-14 px-8 text-base"
              label="Sign in with wallet"
            />
          </div>
          <p className="mt-6 max-w-md text-sm text-slate-400">
            Judges can verify the agent wallet, the passport mint, and the action log directly on
            Avalanche Fuji.
          </p>
        </div>
        <div className="mt-16 grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-halo backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Trust Protocol
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {["Passport ID", "Signature", "Timestamp"].map((label) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-[#111c2c] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  <p className="mt-6 font-mono text-sm text-slate-100">verified</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-[#0f1728] p-6 shadow-halo">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Demo Outcomes
            </p>
            <ul className="mt-5 space-y-3 text-sm text-slate-200">
              {outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 rounded-[36px] border border-white/10 bg-white/[0.03] p-6 text-slate-200 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                See it live
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                Launch the app shell and create a demo agent.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-300">
                Email sign-in for the polished path. Wallet sign-in for the judges who want to kick
                the tires.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d63435]"
            >
              Continue to login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
