import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Wallet } from "lucide-react";

const cards = [
  {
    title: "Researcher",
    purpose: "Summarizes trusted web pages and records the proof on Avalanche.",
    wallet: "0xA91E...2F4D",
    avax: "0.0500",
    usdc: "5.00"
  },
  {
    title: "Verifier",
    purpose: "Checks identity headers and decides whether an agent gets the green channel.",
    wallet: "0xB244...99C1",
    avax: "0.0312",
    usdc: "4.00"
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Your agents are ready for the demo.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              This is a temporary shell route so Person 4&apos;s pages have a polished home to slot
              into. The layout, nav, footer, and card treatment are all in place now.
            </p>
          </div>
          <Link
            href="/dashboard?onboard=1"
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Sparkles className="h-4 w-4" />
            New Agent
          </Link>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.purpose}</p>
              </div>
              <span className="rounded-full bg-[rgba(232,65,66,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                demo ready
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Wallet className="h-4 w-4" />
                  Wallet
                </div>
                <p className="mt-3 font-mono text-sm text-slate-900">{card.wallet}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  Balances
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {card.avax} AVAX / {card.usdc} USDC
                </p>
              </div>
            </div>
            <Link
              href="/agents/demo/run"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-[var(--accent)]"
            >
              Run task
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
