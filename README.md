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
