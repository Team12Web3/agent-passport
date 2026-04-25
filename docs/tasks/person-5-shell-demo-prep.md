# Person 5 — Frontend Shell, Polish & Demo Prep

> **You ship the edges and you save the demo.** Newbie does not mean low-impact — being the person who has rehearsed the demo five times is the highest-leverage role at hour 25.

## Mission

Build the marketing pages, the app shell, the README. Then in the final 4 hours, take over demo prep entirely: rehearse, record a backup video, and make sure the team's hard work doesn't get sunk by a wifi glitch on stage.

## Files you own

```
apps/web/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx               ← marketing-specific layout (no auth required)
│   │   ├── page.tsx                 ← landing page  (THE FIRST THING JUDGES SEE)
│   │   └── about/
│   │       └── page.tsx             ← "How it works"
│   ├── login/
│   │   └── page.tsx                 ← wraps Person 2's <LoginButton />
│   ├── (app)/layout.tsx             ← authenticated app shell
│   └── layout.tsx                   ← root layout
├── components/shell/
│   ├── TopNav.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   ├── MarketingNav.tsx             ← simpler nav for marketing pages
│   └── HowItWorks.tsx               ← 3-step explainer with icons
└── public/
    └── architecture-diagram.png     ← screenshot of a hand-drawn or excalidraw diagram

README.md                            ← root, you maintain
docs/07-demo-script.md               ← you take ownership at hour 20
```

## What you depend on

- **Person 2's** `<LoginButton />` — drop into `/login` page
- **Person 4's** dashboard route — your app shell wraps it
- Everyone else's pages — your shell is the chrome around them

You are blocked by very little. Most of your work is independent.

## Acceptance criteria

### Marketing landing page (`/`)

- [ ] Hero with headline, subhead, two CTAs (email + wallet)
- [ ] Avalanche badge ("Built on Avalanche C-Chain")
- [ ] "Problem" section with 3 cards
- [ ] "How it works" 3-step explainer
- [ ] Footer with GitHub link + hackathon credit
- [ ] Mobile-responsive (single-column collapse)
- [ ] Looks polished — judges might browse it during pitch

### About page (`/about`)

- [ ] Architecture diagram (image — hand-drawn / excalidraw / Figma is fine)
- [ ] Short prose explaining: what's on-chain, what's off-chain, why
- [ ] Link to GitHub repo

### Login page (`/login`)

- [ ] Centered, minimalist
- [ ] Wraps Person 2's `<LoginButton />`
- [ ] Has a "← back to home" link
- [ ] Shows a small Avalanche logo + "Powered by Avalanche Fuji"

### App shell (the layout other pages slot into)

- [ ] Top nav with logo, nav links, user avatar (when logged in)
- [ ] Optional sidebar (or just a simple top nav for hackathon — your call, simpler is better)
- [ ] Footer
- [ ] Wraps `(app)/layout.tsx` so all authenticated pages get the shell

### README.md (root)

- [ ] What this project is (1 paragraph)
- [ ] Quick links to /docs
- [ ] How to run locally (3 commands)
- [ ] Stack list
- [ ] Hackathon credit
- [ ] Demo URL once it's deployed

### Demo prep (hours 22–26)

- [ ] Rehearsed full 90-second demo at least 5 times on the deployed preview
- [ ] Recorded a backup video (phone or screen recording, mp4)
- [ ] Backup video uploaded as YouTube unlisted AND saved to a USB stick
- [ ] Pre-created 3 funded demo agents in DB as fallbacks
- [ ] Demo Google account created and signed in (for OTP)
- [ ] Demo URL in browser bookmarks, multiple tabs ready
- [ ] Slide deck (or none — your call) printed AND on USB
- [ ] Phone hotspot tested

## Hour-by-hour

| Hour    | Task |
|---------|------|
| 0–4     | Generate marketing landing page in v0.dev; paste in; wire CTAs |
| 4–6     | About page with architecture diagram |
| 6–10    | App shell layout (nav + footer); plug in Person 4's dashboard |
| 10–14   | Polish: copy review across the app, empty states, hover states |
| 14–18   | Login page; iterate on landing page based on team feedback |
| 18–20   | Write the README; capture preview screenshots |
| 20–22   | Take ownership of `docs/07-demo-script.md`; write final speaking version |
| 22–26   | Demo rehearsals × 5+; record backup video; final dry run |

## Vibe-coding prompts

### Hour 0–4: Landing page (v0.dev)

```
Design a landing page for "Agent Passport" — a Web3 platform that gives
AI agents verifiable digital identity, their own crypto wallets, and on-chain
audit logs. Built on Avalanche.

Sections, top to bottom:

 1) Top nav: logo (shield icon) + "Agent Passport" left; "How it works"
    and "GitHub" links right; "Sign in" primary button far right.

 2) Hero (full viewport on desktop):
    - Massive headline (5xl): "The Internet was built for humans."
    - Sub-headline (3xl): "We're onboarding the agents."
    - Body: "Give every AI agent a passport. Verifiable identity,
      on-chain audit logs, and a wallet of its own."
    - CTAs: "Continue with email" (primary, large) + "Sign in with wallet" (ghost)
    - Subtle "Built on Avalanche C-Chain" badge below the buttons (small, with
      Avalanche logo)
    - Background: dark gradient with subtle animated grid lines

 3) "The Problem" section, 3 cards on white bg:
    - 🚫 "CAPTCHAs block legitimate agents"
    - 👤 "No standard for AI agent identity"
    - 📋 "No audit trail for autonomous actions"

 4) "How it works" — 3 numbered steps with icons:
    1. Create an agent — give it a name, purpose, and tools.
    2. It gets a wallet + an on-chain passport on Avalanche.
    3. Every action is signed and logged on-chain.

 5) "Trust by signature, not by CAPTCHA" — single bold pull-quote in big italic.

 6) "See it live →" — large CTA card linking to /login.

 7) Footer: "Built at Web3NZ Hackathon 2026" + GitHub icon link.

Style: Tailwind, modern, large typography, generous whitespace. Dark hero
into white sections. Avalanche red (#E84142) as accent. Lucide icons.
NO clip art. NO stock photos.

Export as a single page component, plus reusable Hero, ProblemSection,
HowItWorks, Footer components.
```

### Hour 4–6: Architecture diagram

You don't need to be a designer. Three options ranked by speed:

1. **Fastest:** Open https://excalidraw.com, sketch boxes for User, App, Avalanche, with arrows. Export as PNG. Drop into `public/architecture-diagram.png`. 15 minutes.
2. **Slightly slower:** Use the ASCII diagram in `docs/01-architecture.md` and screenshot it from VSCode (with a nice theme). 20 minutes.
3. **Slower:** Open Figma or Tldraw. 45 minutes.

Pick option 1.

### Hour 6–10: App shell

```
Create app/(app)/layout.tsx:

import { TopNav } from "@/components/shell/TopNav";
import { Footer } from "@/components/shell/Footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}

Create components/shell/TopNav.tsx:

"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export function TopNav() {
  const { isLoggedIn, address } = useAuth();
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
          <span>🛡️</span> Agent Passport
        </Link>
        <div className="flex items-center gap-4">
          {isLoggedIn && (
            <span className="text-sm text-gray-600 font-mono">
              {address?.slice(0,6)}…{address?.slice(-4)}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

Create a similar but simpler MarketingNav for the (marketing) layout.

Footer: just the hackathon credit + a link to /docs/README.md on GitHub.
```

### Hour 18–20: README

```
Update root README.md to be a polished landing for visitors:

# Agent Passport
> Trust by signature, not by CAPTCHA.

A platform where AI agents get verifiable on-chain identities, their own crypto
wallets, and tamper-proof audit trails. Built at Web3NZ Hackathon 2026 in 26 hours.

## 🚀 [Try it live](https://your-vercel-preview.vercel.app)

## What it does

[1-paragraph explanation pulled from docs/00-vision.md]

## Built on

- Next.js 14, Tailwind, shadcn/ui
- Anthropic Claude (via Vercel AI SDK)
- Avalanche Fuji (Solidity + Foundry)
- Thirdweb (auth + wallets)
- Supabase, Firecrawl, Vercel

## Repo layout

[from docs/01-architecture.md]

## Run locally

```bash
pnpm install
cp .env.example .env.local       # fill in keys
pnpm dev
```

See [docs/05-environment-setup.md](./docs/05-environment-setup.md) for full setup.

## How it works

[Insert the architecture diagram screenshot]

## Smart contracts

Deployed on Avalanche Fuji:
- AgentPassport: [link to Snowtrace]
- ActionLog: [link to Snowtrace]

## Team

[5 team members, GitHub handles]

## License

MIT.
```

### Hour 20–22: Final demo script

Open `docs/07-demo-script.md`. Read it cover-to-cover. Then:

- Add the **exact preview URL** at the top.
- Replace any `<placeholder>` text with the real values.
- Pick the **demo URL** (Wikipedia article URL) and the **demo prompt** (paste the exact text).
- Pick the **safe fallback URL** in case Wikipedia hates you.
- Pick which team member is doing the **narration** vs the **clicking** vs the **camera**.
- Print the script. Bring it on stage on paper. Do NOT rely on the laptop showing it.

### Hour 22–26: Rehearsal protocol

Rehearsals 1–3 (90 seconds each, 30-min cycle):

- Run on the actual demo laptop on the actual venue wifi (or simulate slowness)
- Time it on a phone stopwatch
- Note any glitch (a tx that took 5s, a click that didn't register)
- Fix or work around the glitch BEFORE rehearsal #4

Rehearsal 4: **Recorded** — phone on tripod, full audio, full video. This is your **backup tape**.

Rehearsal 5: live in front of a teammate playing "judge". They ask one of the [anticipated questions](../07-demo-script.md#handling-questions). You answer.

If anything in rehearsal 5 fails, fix it and run rehearsal 6.

## Common pitfalls

- **Marketing page over-engineering.** It's the first thing judges see, but they'll see it for 5 seconds. Don't spend 8 hours on it.
- **Architecture diagram perfectionism.** Hand-drawn boxes with arrows is fine. Stop polishing.
- **The "About" page no one will read.** Write it once, move on.
- **README sprawl.** Link out to /docs; don't restate everything inline.
- **Demo rehearsing only on localhost.** Always rehearse on the actual deployed preview URL, on the actual demo laptop, on the actual demo wifi if you can.
- **Forgetting the OTP problem.** If demo email is `team@example.com` and OTP goes to a phone you forgot, you cannot sign in on stage. Use a phone you brought with you.
- **Recording the backup video too early.** Re-record it AFTER all features are stable (hour 24+). An old video showing a buggy feature is worse than no video.

## Done definition

You're done when:
1. The landing page makes a stranger want to click "Continue with email."
2. The README answers "what is this and how do I run it?" in under 60 seconds of reading.
3. You can run the demo flawlessly 5 times in a row on the deployed preview.
4. A backup video exists in three places (laptop, USB, YouTube unlisted).
5. The team is calm at hour 26 because *you* are calm at hour 26.
