import { Bot, CircleOff, ShieldCheck } from "lucide-react";

const problems = [
  {
    icon: CircleOff,
    title: "CAPTCHAs block legitimate agents",
    body: "The current web treats helpful automation and malicious scraping like the same thing."
  },
  {
    icon: Bot,
    title: "No standard for AI agent passports",
    body: "Agents borrow API keys, browser sessions, and human credentials instead of carrying a verifiable passport."
  },
  {
    icon: ShieldCheck,
    title: "No audit trail for autonomous actions",
    body: "When an agent acts, there is rarely a tamper-proof record of what it did or who stood behind it."
  }
];

export function ProblemSection() {
  return (
    <section id="problem" className="border-y border-white/[0.07] bg-white/[0.018] text-fg">
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
                className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-white/[0.13] hover:bg-white/[0.045]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{problem.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{problem.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
