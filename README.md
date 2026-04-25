# Agent Passport

> **Trust by signature, not by CAPTCHA.**
> A platform where AI agents get verifiable on-chain identities, their own crypto wallets, and tamper-proof audit trails.

Built for **Web3NZ Hackathon** — 26 hours, 5 people, three prize tracks.

---

## Quick links

- 📖 [**Start here → /docs**](./docs/README.md)
- 🎯 [Product vision](./docs/00-vision.md)
- 🏗️ [Architecture](./docs/01-architecture.md)
- 🧑‍💻 [Per-person task cards](./docs/tasks)
- 📜 [API contracts](./docs/03-api-contracts.md)
- ⛓️ [Smart contracts](./docs/04-onchain-contracts.md)
- 🎬 [Demo script](./docs/07-demo-script.md)

---

## Trust protocol

Our protocol is built around four trust signals that a website can verify in lightweight middleware:

- `X-Agent-Passport-ID`: points to an EAS (Ethereum Attestation Service) credential so the site can resolve attributes such as developer, model platform, and labels like `non-crawler`.
- `X-Agent-Signature` + `X-Agent-Timestamp`: proves identity and agreement to the current Terms of Service, and gives the site signed evidence it can use for a staking/slashing flow if abuse happens.
- `X-Agent-Session-Proof`: proves the request is being made by a session key that the owner's main wallet authorized on-chain.
- Extended `X-Agent-Intent-Hash`: commits to the user's original instruction and can carry a ZK proof that the current action is derived from that intent.

## Repo layout

```
agent-passport/
├── apps/
│   └── web/              # Next.js 14 app (frontend + API routes)
├── packages/
│   └── contracts/        # Foundry project (Solidity)
└── docs/                 # All planning, specs, and task cards
```

## Run locally

```bash
pnpm install
cp .env.example .env.local        # fill in keys (see docs/05-environment-setup.md)
pnpm dev                           # apps/web on http://localhost:3000
```

Contracts:

```bash
cd packages/contracts
forge install
forge test
forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --broadcast
```

## Production checklist (hackathon MVP)

> Scoped to "demo-ready", not "enterprise-ready". See [docs/05-environment-setup.md](./docs/05-environment-setup.md) and [docs/07-demo-script.md](./docs/07-demo-script.md).

**Secrets & env**
- [ ] `.env.local` populated from `.env.example`; no secrets committed (`git grep -n "sk-\|0x[a-fA-F0-9]\{64\}"` is clean)
- [ ] Vercel env vars set for `production` and `preview` (Anthropic, Thirdweb, Supabase, Firecrawl, Fuji RPC)
- [ ] Server-only keys are **not** prefixed with `NEXT_PUBLIC_`

**Smart contracts**
- [ ] `forge test` green
- [ ] Deployed to Avalanche Fuji; addresses pinned in `apps/web/lib/contracts/addresses.ts` (or equivalent)
- [ ] Deployer wallet funded with enough Fuji AVAX for the demo flow + 2 retries

**Web app**
- [ ] `pnpm build` succeeds with no type errors
- [ ] Wallet connect → passport mint → signed request happy path works end-to-end on a fresh browser profile
- [ ] 404 / wallet-disconnected / wrong-chain states render something other than a stack trace

**Demo readiness**
- [ ] One pre-seeded passport + agent wallet exists so the demo doesn't depend on live mint timing
- [ ] Backup recording of the full flow in case Fuji RPC or Anthropic flakes mid-pitch
- [ ] <!-- TODO(team): list the 2–3 demo-specific items that would actually sink the pitch if they broke (e.g. "EAS schema UID matches what the verifier middleware expects") -->

**Known limitations (intentional, not bugs)**
- [ ] <!-- TODO(team): list what's deliberately out of scope so judges know it's a choice — e.g. "no rate limiting on /api/agent/*", "session keys don't auto-expire", "slashing flow is stubbed", "single-region Supabase" -->

---

## Stack

Next.js 14 · Tailwind · shadcn/ui · Thirdweb · Vercel AI SDK · Anthropic Claude · Firecrawl · Supabase · Foundry · Avalanche Fuji · Vercel.

## Team

| # | Role                                | Owner |
|---|-------------------------------------|-------|
| 1 | Backend & Contracts                 |       |
| 2 | Auth & Agent Wallets                |       |
| 3 | Agent Execution UI                  |       |
| 4 | Dashboard & Agent Management        |       |
| 5 | Frontend Shell, Polish, Demo Prep   |       |

---

Built at Web3NZ Hackathon 2026.
