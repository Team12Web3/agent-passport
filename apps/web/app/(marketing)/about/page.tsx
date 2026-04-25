import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Database, ShieldCheck, Wallet } from "lucide-react";
import { siteConfig } from "@/lib/site";

const layers = [
  {
    icon: ShieldCheck,
    title: "What lives on-chain",
    body: "Agent passports, ownership links, wallet identities, and tamper-proof action receipts sit on Avalanche so third parties can verify them without trusting our backend."
  },
  {
    icon: Database,
    title: "What stays off-chain",
    body: "Prompt text, agent metadata, run state, and UI workflow data live in the app database where we can iterate quickly and keep transaction costs sane."
  },
  {
    icon: Wallet,
    title: "Why the split matters",
    body: "We keep the accountability primitive public and portable, while the product surface stays fast enough for a live demo and eventual real users."
  }
];

export default function AboutPage() {
  return (
    <main className="bg-[#f8f8f7] text-slate-950">
      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            How It Works
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">
            A thin app layer around a verifiable agent identity protocol.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Agent Passport gives each agent a wallet, binds it to an owner, and logs the work it
            performs. The app handles the onboarding and task experience, while Avalanche holds the
            proof that the agent is real and accountable.
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-[32px] border border-black/5 bg-white p-4 shadow-sm sm:p-6">
          <Image
            src="/architecture-diagram.png"
            alt="Architecture diagram showing the user, the Agent Passport app, and Avalanche working together."
            width={1600}
            height={900}
            className="w-full rounded-[24px]"
            priority
          />
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {layers.map((layer) => {
            const Icon = layer.icon;

            return (
              <article key={layer.title} className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(232,65,66,0.12)] text-[var(--accent)]">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{layer.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{layer.body}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-10 rounded-[28px] bg-slate-950 p-8 text-white">
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            The goal is not to push everything on-chain. The goal is to put the trust boundary
            there. That way a website, an auditor, or a judge can verify the agent&apos;s passport
            and action log even if our app disappears tomorrow.
          </p>
          <Link
            href={siteConfig.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-[var(--accent)]"
          >
            View the GitHub repository
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
