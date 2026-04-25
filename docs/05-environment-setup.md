# 05 — Environment Setup

Do this in **hour 0**. One person owns the shared `.env` file in 1Password / pinned in Discord.

## Accounts to create

| Service       | What to do                                              | Owner      |
|---------------|---------------------------------------------------------|------------|
| GitHub        | Create org or use one teammate's; invite all 5          | Person 1   |
| Vercel        | Connect to GitHub repo; add team                        | Person 1   |
| Anthropic     | API key with credits ($5 is plenty)                     | Person 1   |
| Firecrawl     | Free tier (500 pages/mo) — sign up, copy API key        | Person 1   |
| Thirdweb      | Create project; copy `NEXT_PUBLIC_TW_CLIENT_ID`         | Person 2   |
| Supabase      | New project; copy URL + anon key + service role key     | Person 1   |
| Avalanche Fuji faucet wallet | Generate fresh wallet; faucet 5 AVAX; this is the platform/faucet wallet | Person 2 |

## Avalanche Fuji setup

- Network name: `Avalanche Fuji C-Chain`
- RPC URL: `https://api.avax-test.network/ext/bc/C/rpc`
- Chain ID: `43113`
- Currency: `AVAX`
- Block explorer: `https://testnet.snowtrace.io`

**Test AVAX faucet:** https://core.app/tools/testnet-faucet/?subnet=c&token=c (1 AVAX every 24h per address; tweet faucet also available)

**Test USDC on Fuji:** `0x5425890298aed601595a70AB815c96711a31Bc65`
Get test USDC from https://core.app/tools/testnet-faucet/?subnet=c&token=usdc

The faucet wallet (Person 2) should hold ≥3 AVAX and ≥50 USDC at the start of the hackathon.

## Generate the agent encryption secret

```bash
openssl rand -hex 32
```

Copy into `AGENT_KEY_SECRET` in `.env.local`. **Same value** must be in production env vars on Vercel.

## Local dev

```bash
git clone <repo-url>
cd agent-passport
pnpm install
cp .env.example .env.local            # fill in all values
pnpm dev                              # http://localhost:3000
```

For contracts:

```bash
cd packages/contracts
forge install                         # first time
forge build
forge test
```

To deploy contracts to Fuji (Person 1, hour 2–4):

```bash
forge script script/Deploy.s.sol --rpc-url $NEXT_PUBLIC_FUJI_RPC --broadcast -vvv
```

Then paste the deployed addresses into `.env.local` and `deployments.json`.

## Vercel deploy

1. Person 1 connects the GitHub repo to Vercel.
2. Set framework: Next.js. Root: `apps/web`. Build command: `pnpm --filter web build`.
3. Add **all** env vars from `.env.local` to Vercel. Mark `NEXT_PUBLIC_*` as plain; the rest as Sensitive.
4. First deploy should succeed even on hour zero (just shows the marketing page).
5. Bookmark the preview URL — every PR gets one. Test on the preview, not just localhost.

## Supabase migration

In hour 0–2, Person 1 runs the SQL from `01-architecture.md` in the Supabase SQL editor:

```sql
-- (copy from docs/01-architecture.md)
create table users (...);
create table agents (...);
create table action_runs (...);
```

Enable Row Level Security on all tables but write permissive policies for the hackathon (we use the service role key server-side, so RLS is essentially disabled by design).

## Health check

Run this at hour 4. All five must pass.

```
✅ pnpm dev runs locally
✅ Vercel preview shows landing page
✅ forge test passes
✅ AgentPassport + ActionLog deployed to Fuji (visible on Snowtrace)
✅ deployments.json populated and committed
✅ Faucet wallet has >3 AVAX and >50 USDC
✅ Email login round-trips on Vercel preview (Person 2)
```

If any of these fail at hour 4, all-hands on the failure for 30 minutes. Don't keep building on a broken foundation.
