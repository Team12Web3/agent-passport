import { BadgeCheck, ShieldCheck, WalletCards } from "lucide-react";

const steps = [
  {
    icon: BadgeCheck,
    title: "Create an agent",
    body: "Give it a name, purpose, and tool set so the work is explicit before it starts moving."
  },
  {
    icon: WalletCards,
    title: "Get a wallet and passport",
    body: "The platform provisions an agent wallet and binds it to an on-chain passport on Avalanche Fuji."
  },
  {
    icon: ShieldCheck,
    title: "Sign and audit every action",
    body: "Each task creates a tamper-proof trail that websites verify independently."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          How It Works
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-fg sm:text-5xl">
          Give agents passports, funding, and accountability in three steps.
        </h2>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-white/[0.13] hover:bg-white/[0.045]"
              >
                <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold text-subtle">Step {index + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-fg">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
