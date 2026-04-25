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

## Deployed contracts (Avalanche Fuji · chainId 43113)

| Contract | Address | Snowtrace |
|---|---|---|
| `AgentPassport` | `0x8b4f6f0bf3f28135c179e3Ed303a94554b2fB70c` | [view ↗](https://testnet.snowtrace.io/address/0x8b4f6f0bf3f28135c179e3Ed303a94554b2fB70c) |
| `ActionLog`     | `0x34E74C0b367476ee95528709663A5297cd9aaa7C` | [view ↗](https://testnet.snowtrace.io/address/0x34E74C0b367476ee95528709663A5297cd9aaa7C) |
| `USDC` (Circle testnet) | `0x5425890298aed601595a70AB815c96711a31Bc65` | [view ↗](https://testnet.snowtrace.io/address/0x5425890298aed601595a70AB815c96711a31Bc65) |

ABIs and addresses are pinned in [`packages/contracts/deployments.json`](./packages/contracts/deployments.json) — the single source of truth consumed by `apps/web/lib/chain/contracts.ts`.

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

## Prerequisites

Install these once on your machine before cloning:

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org or `nvm install 20` |
| pnpm | 9.x | `npm i -g pnpm@9` (or `corepack enable`) |
| Foundry (`forge`, `cast`, `anvil`) | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| `psql` (Postgres client, for Supabase migrations) | 14+ | macOS: `brew install libpq && brew link --force libpq` |
| Git | any | https://git-scm.com |

You'll also need accounts / keys for: **Supabase**, **Thirdweb** (client ID), **OpenAI** (or Anthropic, depending on your branch), **Firecrawl**, and a small amount of **Fuji AVAX** in the auto-generated platform wallet (free from https://faucet.avax.network/, pick *Fuji C-Chain*).

---

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/Team12Web3/agent-passport.git
cd agent-passport
pnpm setup           # installs deps, generates env files, installs + builds contracts
```

`pnpm setup` runs `apps/web/scripts/genenv.mjs`, which:

- Generates a fresh **platform wallet** (private key + address) and a random **AGENT_KEY_SECRET**.
- Writes `apps/web/.env.local` and `packages/contracts/.env` (both `chmod 600`).
- Refuses to overwrite existing files — if you already have envs, delete them first or skip this step.

The script will print the generated `PLATFORM_ADDRESS` — **copy it**, you'll need to fund it in step 3.

### 2. Fill in third-party keys

Open `apps/web/.env.local` and fill in the blanks:

```bash
NEXT_PUBLIC_TW_CLIENT_ID=        # https://thirdweb.com/dashboard → Settings → API Keys
SUPABASE_URL=                    # Supabase → Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=       # Supabase → Project Settings → API (service_role, NOT anon)
SUPABASE_DB_URL=                 # Supabase → Project Settings → Database → Connection string (URI)
OPENAI_API_KEY=                  # https://platform.openai.com/api-keys
FIRECRAWL_API_KEY=               # https://www.firecrawl.dev/app
SNOWTRACE_API_KEY=               # optional, for contract verification
```

> `SUPABASE_DB_URL` is **not** seeded by `genenv.mjs` — the migration script will fail without it.

### 3. Fund the platform wallet

The address printed by step 1 needs Fuji AVAX before contracts can deploy:

1. Go to https://faucet.avax.network/, choose **Fuji C-Chain**, paste the address.
2. Confirm with: `cast balance <PLATFORM_ADDRESS> --rpc-url https://api.avax-test.network/ext/bc/C/rpc`

### 4. Deploy contracts

```bash
pnpm contracts:test          # sanity check — should be green
pnpm contracts:deploy        # deploys AgentPassport + ActionLog to Fuji
pnpm contracts:sync          # writes addresses into apps/web (run automatically by deploy)
```

### 5. Run database migrations

```bash
pnpm db:migrate              # applies all SQL in supabase/migrations/ via psql
```

### 6. Start the Next.js app

```bash
pnpm dev                     # http://localhost:3000
```

### One-shot backend redeploy

If you change a contract or migration:

```bash
pnpm deploy:backend          # = contracts:test + contracts:deploy + db:migrate
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
- [ ] `packages/contracts/deployments.json` addresses match what the web app actually reads (single source of truth — drift here = silent failure on stage)
- [ ] 3 pre-funded backup agents exist in the demo Supabase row (fallback if live mint fails — called out in `docs/06-integration-plan.md`)
- [ ] `/api/trust/demo-site` round-trip rehearsed: same browser, same passport, returns 403 without headers and clean JSON with them
- [ ] Snowtrace tab is bookmarked at our deployed `AgentPassport` address and the most recent `ActionLogged` event is visible (the 1:00 narration depends on it)
- [ ] Demo URL (Wikipedia / books.toscrape) re-tested within the last 2h — Firecrawl + Jina fallback both succeed
- [ ] Thirdweb OTP routes to a phone someone on stage is holding

**Known limitations (intentional, not bugs)**
- Agent wallets are plain server-managed EOAs, not ERC-4337 smart accounts (deferred — see architecture doc)
- Agent private keys are AES-256-GCM encrypted in Supabase, not in a KMS/HSM
- `X-Agent-Intent-Hash` is committed but the ZK proof is interface-only — no real proving circuit yet
- Slashing / dispute flow exists as a contract path; no UI for appeals
- No rate limiting or auth on `/api/run` and `/api/trust/demo-site` (single-tenant demo)
- Trust-protocol verifier is our own reference middleware at `/api/trust/demo-site`, not a third-party site
- Single-region Supabase, no backups; no observability beyond Vercel logs
- Session keys don't auto-expire; revocation is manual via `setActive(id, false)`

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
