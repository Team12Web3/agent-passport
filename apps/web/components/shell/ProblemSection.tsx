import { Bot, CircleOff, ShieldCheck } from "lucide-react";

const problems = [
  {
    icon: CircleOff,
    title: "CAPTCHAs block legitimate agents",
    body: "The current web treats helpful automation and malicious scraping like the same thing."
  },
  {
    icon: Bot,
    title: "No standard for AI agent identity",
    body: "Agents borrow API keys, browser sessions, and human credentials instead of owning real identity."
  },
  {
    icon: ShieldCheck,
    title: "No audit trail for autonomous actions",
    body: "When an agent acts, there is rarely a tamper-proof record of what it did or who stood behind it."
  }
];

export function ProblemSection() {
  return (
    <section className="bg-[#f8f8f7] text-slate-950">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            The Problem
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">
            Agents need something stronger than “please prove you are human.”
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {problems.map((problem) => {
            const Icon = problem.icon;

            return (
              <article
                key={problem.title}
                className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[rgba(232,65,66,0.22)] hover:shadow-xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(232,65,66,0.12)] text-[var(--accent)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{problem.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{problem.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
