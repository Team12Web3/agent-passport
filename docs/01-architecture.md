# 01 — Architecture

## System diagram

```
                           ┌──────────────────────────┐
                           │    User (browser)         │
                           │  email/wallet sign-in     │
                           └─────────────┬────────────┘
                                         │
                                         ▼
              ┌──────────────────────────────────────────────────┐
              │           Next.js app (Vercel)                    │
              │                                                   │
              │   ┌─────────────┐    ┌──────────────────────┐    │
              │   │  Frontend   │    │   API routes         │    │
              │   │  (App Rtr)  │◄──►│   /agents            │    │
              │   │  Tailwind   │    │   /run (SSE)         │    │
              │   │  shadcn/ui  │    │   /log/submit        │    │
              │   └─────────────┘    │   /trust/demo-site   │    │
              │                      └──────────┬───────────┘    │
              │                                 │                 │
              └─────────────────────────────────┼─────────────────┘
                                                │
                ┌──────────────────┬────────────┼────────────┬──────────────┐
                ▼                  ▼            ▼            ▼              ▼
        ┌──────────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │  Supabase    │  │  Anthropic   │ │ Firecrawl│ │ Thirdweb │ │ Avalanche    │
        │  (Postgres)  │  │  (Claude)    │ │  + Jina  │ │  (auth)  │ │ Fuji RPC     │
        │              │  │              │ │          │ │          │ │              │
        │ users        │  │ agent reason │ │ url→md   │ │ user     │ │ AgentPassport│
        │ agents       │  │              │ │          │ │ wallets  │ │ ActionLog    │
        │ wallets enc. │  │              │ │          │ │          │ │ test USDC    │
        └──────────────┘  └──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## Stack decisions and why

| Layer              | Choice                                | Why                                                                 |
|--------------------|---------------------------------------|---------------------------------------------------------------------|
| Frontend           | Next.js 14 App Router                 | Single repo, server components, vibe-coding friendly, v0.dev exports drop straight in |
| Styling            | Tailwind + shadcn/ui                  | Fast, beautiful defaults, no CSS bikeshedding                       |
| Backend            | Next.js API routes                    | No separate server = no separate deploy = no separate bug surface   |
| Auth               | Thirdweb                              | Email + wallet login + embedded wallet, one SDK                     |
| User wallet        | Thirdweb embedded wallet              | Provisioned silently, user never sees seed phrases                  |
| Agent wallets      | Plain EOAs (server-managed)           | ERC-4337 is 1–2 days of integration we don't have                  |
| LLM                | Vercel AI SDK + Anthropic Claude      | Streaming, tool calls, simpler than LangChain                       |
| Scraping           | Firecrawl primary, Jina Reader fallback | Returns clean Markdown, handles JS, free tiers sufficient         |
| Realtime           | Server-Sent Events                    | Native fetch streams, no socket setup                               |
| Persistence        | Supabase (Postgres)                   | Free, instant, easy auth-table joins                                |
| Smart contracts    | Solidity 0.8.20 + Foundry             | Modern tooling, fast tests, scriptable deploys                      |
| Chain              | Avalanche Fuji                        | Required for prize; ~2s block times                                 |
| Hosting            | Vercel                                | Native Next.js, free tier, instant preview URLs                     |

## Repo layout

```
agent-passport/
├── apps/
│   └── web/                        # Next.js app
│       ├── app/
│       │   ├── (marketing)/        # /, /about — Person 5
│       │   ├── (app)/              # /dashboard, /agents/[id], /agents/[id]/run
│       │   │   ├── layout.tsx      # App shell — Person 5
│       │   │   ├── dashboard/      # Person 4
│       │   │   └── agents/[id]/
│       │   │       ├── page.tsx    # Detail — Person 4
│       │   │       └── run/        # Run page — Person 3
│       │   ├── api/                # Person 1
│       │   │   ├── agents/
│       │   │   ├── run/
│       │   │   ├── log/
│       │   │   └── trust/demo-site/
│       │   ├── login/              # Person 5 wires Person 2's button
│       │   └── layout.tsx          # Root layout
│       ├── components/
│       │   ├── auth/               # Person 2
│       │   ├── agents/             # Person 4
│       │   ├── run/                # Person 3
│       │   ├── shell/              # Person 5
│       │   └── ui/                 # shadcn/ui primitives
│       ├── hooks/
│       │   ├── useAuth.ts          # Person 2
│       │   ├── useAgentBalances.ts # Person 4
│       │   └── useAgentRun.ts      # Person 3
│       ├── lib/
│       │   ├── agent/              # Person 1 + Person 2
│       │   │   ├── runtime.ts      # Person 1: scrape→reason→log loop
│       │   │   ├── wallet.ts       # Person 2: provisioning + encryption
│       │   │   ├── sign.ts         # Person 2: trust-header signing
│       │   │   └── verify.ts       # Person 2: header verification
│       │   ├── chain/              # Person 1
│       │   │   ├── client.ts       # viem clients
│       │   │   └── contracts.ts    # ABIs + addresses (from deployments.json)
│       │   ├── db/                 # Person 1
│       │   │   └── supabase.ts
│       │   └── thirdweb/           # Person 2
│       │       └── client.ts
│       ├── public/
│       └── package.json
├── packages/
│   └── contracts/                  # Foundry — Person 1
│       ├── src/
│       │   ├── AgentPassport.sol
│       │   └── ActionLog.sol
│       ├── test/
│       │   ├── AgentPassport.t.sol
│       │   └── ActionLog.t.sol
│       ├── script/
│       │   └── Deploy.s.sol
│       ├── deployments.json        # ← single source of truth for addresses + ABIs
│       └── foundry.toml
└── docs/                           # this folder
```

## Data model (Supabase)

```sql
-- Created by Thirdweb on first login
create table users (
  id uuid primary key default gen_random_uuid(),
  thirdweb_id text unique not null,         -- thirdweb user id
  email text,
  wallet_address text,
  created_at timestamptz default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  purpose text not null,
  tools jsonb not null default '[]'::jsonb,        -- ["scraper","summarizer","logger"]
  passport_id text,                                -- bigint as string (from on-chain)
  agent_wallet_address text not null,
  encrypted_private_key text not null,             -- AES-256-GCM
  mint_tx_hash text,
  created_at timestamptz default now()
);

create table action_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  url text not null,
  prompt text not null,
  result jsonb,
  actions jsonb,                                   -- full step list
  actions_root text,                               -- keccak hash
  log_tx_hash text,
  fee_amount text,                                 -- USDC, 6-decimal string
  status text default 'pending',                   -- pending|done|error
  created_at timestamptz default now()
);

create index on agents (user_id);
create index on action_runs (agent_id, created_at desc);
```

Person 1 owns the migration. Run it once during hour 0–2.

## On-chain components

Two contracts on Avalanche Fuji. Both kept deliberately minimal.

**`AgentPassport.sol`** — append-only registry
- `mintPassport(owner, agentWallet, metadataURI)` — onlyPlatform, returns `passportId`
- `setActive(id, bool)` — onlyPlatform
- `getPassport(id)` — view, returns full struct
- Emits `PassportMinted`, `PassportStatusChanged`

**`ActionLog.sol`** — append-only audit log
- `logAction(passportId, taskHash, actionsRoot, feeAmount, beneficiary)`
- Verifies `msg.sender == AgentPassport.getPassport(passportId).agentWallet`
- Pulls `feeAmount` test USDC from caller, forwards to `beneficiary`
- Emits `ActionLogged`

Full specs in [04-onchain-contracts.md](./04-onchain-contracts.md).

## Trust protocol

Ten headers matter on every outbound agent request:

```
X-Agent-Passport-ID:    42
X-Agent-Signature:      0xabc123...
X-Agent-Timestamp:      1729980000
X-Agent-Session-Grant:  eyJ0eXBlIjoiYWdlbnQtcGFzc3BvcnQvc2Vzc2lvbi1ncmFudCIsLi4ufQ
X-Agent-Session-Proof:  0xownersignature...
X-Agent-Claims:         eyJAY29udGV4dCI6Imh0dHBzOi8vYWdlbnRwYXNzcG9ydC5kZXYvY2xhaW1zL3YxIiwuLi59
X-Agent-Claims-Signature: 0xdevelopersignature...
X-Agent-Intent-Hash:    0xintenthash...
X-Agent-Action-Hash:    0xactionhash...
X-Agent-Intent-Proof:   0xintentproof...
```

**Verification (any website can implement in ~30 lines):**

1. All required headers present? Else 403.
2. Timestamp within ±60 seconds of now? Else 403 stale.
3. Resolve `X-Agent-Passport-ID` to the on-chain passport record and its EAS-compatible credential pointer (or a cache of that credential).
4. Read the signed JSON-LD claims packet: developer, platform/model, labels such as `non-crawler`, and trust score.
5. Recover signer from `X-Agent-Signature` over `keccak256(passportId || url || timestamp || termsHash || intentHash)`.
6. Verify `X-Agent-Session-Grant` plus `X-Agent-Session-Proof` as an owner-authorized, time-limited, permission-restricted session key.
7. Enforce the session scope: allowed origins, allowed actions, and maximum amount.
8. Verify the request is tied to the current Terms of Service.
9. If the `StakeVault` companion contract is deployed, require the passport to maintain the minimum active stake before returning high-value data.
10. Verify that `X-Agent-Action-Hash` matches the current action being approved.
11. Verify that `X-Agent-Intent-Proof` was signed by the same trusted session signer over `(passportId, timestamp, intentHash, actionHash)`.

If a site later detects obvious abuse, the same signed payload can be submitted as evidence to a staking/slashing flow tied to that passport ID. The demo companion contract is `StakeVault`, and the website-side helper route is `/api/trust/report-abuse`.

For the hackathon, the proof-of-execution layer is simulated with ECDSA signatures rather than a full zkVM backend, and the session-key layer simulates ERC-4337 semantics with owner-signed delegated grants rather than a full smart-account module. Our reference implementation lives at `/api/trust/demo-site`, and the visual explainer lives at `/trust-lab`.

## Why we cut things

| Cut                                  | Why                                                      |
|--------------------------------------|----------------------------------------------------------|
| Full ERC-4337 smart-account modules  | Keep the session-key flow, but simulate AA semantics with owner-signed delegated session grants |
| Production-grade ZK circuits         | Keep the intent-proof interface; simulate the proof flow with ECDSA for the demo |
| Full dispute-resolution UI for slashing | The smart-contract path matters more than appeals UX for the demo |
| Per-action on-chain transactions     | 8 actions × 2s confirms = 16s of dead air on stage       |
| Real-world scrape target             | Anti-bot, JS-heavy, geo-gated → fails on stage            |
| "Real" website adoption              | Cannot demo in 26h → ship our own reference site instead  |
| CAPTCHA-bypass via human outsourcing | Side quest; not core story                               |
