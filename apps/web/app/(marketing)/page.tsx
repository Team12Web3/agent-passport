import Link from "next/link";

const problemCards = [
  {
    title: "CAPTCHAs block useful agents",
    copy: "Sites still treat automation as suspicious by default, even when an agent can prove who owns it.",
  },
  {
    title: "Agent identity is fragmented",
    copy: "API keys, browser sessions, and wallets all say different things. Agent Passport gives each agent one verifiable profile.",
  },
  {
    title: "Autonomous actions need receipts",
    copy: "Every meaningful action can be signed, attributed, and logged so humans can audit what happened later.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create an agent",
    copy: "Give it a name, purpose, and the wallet that will own its passport.",
  },
  {
    step: "02",
    title: "Mint its passport",
    copy: "The agent gets a verifiable on-chain identity on Avalanche Fuji.",
  },
  {
    step: "03",
    title: "Sign every action",
    copy: "Requests carry proof of agent identity instead of forcing users through CAPTCHA loops.",
  },
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 focus-ring rounded-lg">
          <div
            className="h-7 w-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 210deg, #34d399, #38bdf8, #f87171, #34d399)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
            }}
            aria-hidden
          />
          <span className="text-[14px] font-medium tracking-tight text-fg">Agent Passport</span>
        </Link>
        <nav className="flex items-center gap-2">
          <a href="#how-it-works" className="btn btn-ghost focus-ring hidden sm:inline-flex">
            How it works
          </a>
          <Link href="/login" className="btn btn-secondary focus-ring">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-68px)] w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-8 md:grid-cols-[1.18fr_0.82fr] md:px-8 md:pb-20">
        <div>
          <div className="chip w-fit">
            <span className="chip-dot bg-[#f87171]" aria-hidden />
            Built on Avalanche Fuji
          </div>
          <h1 className="mt-7 max-w-4xl text-[44px] font-semibold leading-[0.98] tracking-tight text-fg md:text-[74px]">
            The Internet was built for humans.
          </h1>
          <p className="mt-5 max-w-2xl text-[21px] leading-tight text-muted md:text-[28px]">
            We&apos;re onboarding the agents with verifiable identity, signed requests, and on-chain audit logs.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="btn btn-primary focus-ring h-11 px-5 text-[14px]">
              Continue with email
            </Link>
            <Link href="/login" className="btn btn-secondary focus-ring h-11 px-5 text-[14px]">
              Sign in with wallet
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="rounded-xl border border-white/10 bg-[#0d0f12] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted">Passport status</span>
                <span className="chip border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  Verified
                </span>
              </div>
              <div className="mt-6 grid grid-cols-[auto_1fr] gap-4">
                <div className="h-14 w-14 rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(52,211,153,0.28),rgba(56,189,248,0.13))]" />
                <div>
                  <div className="text-[16px] font-medium">research-agent-7</div>
                  <div className="mt-1 font-mono text-[12px] text-faint">0x8c42...91af</div>
                  <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
                    <div className="h-full w-[72%] rounded-full bg-emerald-300" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Signed actions" value="184" />
              <Metric label="Trust score" value="87" />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0d0f12] p-4 font-mono text-[12px] leading-6 text-muted">
              <div>&gt; request signed</div>
              <div>&gt; passport verified</div>
              <div className="text-emerald-200">&gt; clean data returned</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.018]">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <div className="eyebrow">The problem</div>
            <h2 className="mt-3 max-w-md text-[30px] font-semibold leading-tight tracking-tight md:text-[42px]">
              Agents need proof that survives the browser tab.
            </h2>
          </div>
          <div className="grid gap-3">
            {problemCards.map((card) => (
              <article key={card.title} className="border-t border-white/[0.08] py-5">
                <h3 className="text-[17px] font-medium">{card.title}</h3>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="eyebrow">How it works</div>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight md:text-[42px]">
              Trust by signature, not by CAPTCHA.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((item) => (
              <article key={item.step} className="card p-5">
                <div className="font-mono text-[12px] text-faint">{item.step}</div>
                <h3 className="mt-8 text-[16px] font-medium">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-6 text-muted">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-16 md:px-8">
        <div className="grid gap-5 border-t border-white/[0.08] pt-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">See the passport flow live.</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">
              Sign in, create an agent, and watch verified requests pass while unsigned requests get blocked.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary focus-ring h-11 px-5 text-[14px]">
            Launch demo
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-[12px] text-faint md:flex-row md:items-center md:justify-between md:px-8">
          <span>Built at Web3NZ Hackathon 2026.</span>
          <a
            className="hover:text-muted"
            href="https://github.com/Team12Web3/agent-passport"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0f12] p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-3 font-mono text-[24px] text-fg">{value}</div>
    </div>
  );
}
