# Agent Passport

A minimal Next.js dashboard that mints an on-chain identity (a "passport") for
each AI agent on Avalanche Fuji. Each passport binds the user's connected wallet
(owner) to a fresh agent EOA generated in the browser, plus a small trust score
that can grow over time.

```
[ MetaMask / email wallet ]    owner
            │
            │  mintPassport(agentWallet, metadataURI)
            ▼
[ AgentPassport contract on Fuji ]
            │
            │  PassportMinted(id, owner, agentWallet, metadataURI)
            ▼
   ┌────────────────────────────┐
   │ #1  research-agent         │
   │ owner   0xabcd…1234        │
   │ agent   0xefgh…5678        │
   │ trust   50                 │
   └────────────────────────────┘
```

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 3
- thirdweb v5 for wallet connect (email + MetaMask), tx signing, and contract deploy
- ethers v6 for read-only RPC + log parsing
- viem for in-browser keypair generation
- solc 0.8.30 for compiling `contracts/AgentPassport.sol` to a shipped artifact
- Avalanche Fuji testnet (chain id 43113)

## Getting started

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_THIRDWEB_CLIENT_ID
npm install
npm run dev
```

Then open <http://localhost:3000>:

1. **Sign in** at `/auth` with email or MetaMask.
2. Go to **Create**, click **Deploy contract** (one-time, ~1¢ in test AVAX).
3. Click **Create & mint** — a fresh agent wallet is generated in your browser
   and bound to your wallet on chain.
4. Switch to **Monitor** to see the new passport card with its trust score.

Need test AVAX? <https://core.app/tools/testnet-faucet/?subnet=c&token=c>

## Project layout

```
app/
  auth/page.tsx             — connect screen
  dashboard/page.tsx        — header + tabs + monitor / create / profile
  layout.tsx, providers.tsx — thirdweb provider
  globals.css               — design tokens + utility classes
components/
  AgentCard.tsx             — agent card UI
contracts/
  AgentPassport.sol         — self-mint passport contract
lib/
  agentPassport.ts          — ABI + on-chain reads + log parsing
  agentKeys.ts              — keypair gen, localStorage, backup download
  avatar.ts                 — deterministic gradient/monogram from address
  mockAgents.ts             — deterministic demo data
  thirdwebClient.ts         — cached thirdweb client
  utils.ts                  — shortenAddress / clamp
  AgentPassport.artifact.json — compiled ABI + bytecode (generated)
scripts/
  compile-passport.mjs      — recompile the contract
```

## Smart contract

`contracts/AgentPassport.sol` is a self-mint variant — anyone can call
`mintPassport(agentWallet, metadataURI)` and `msg.sender` becomes the owner.
Functions: `mintPassport`, `setActive`, `bumpTrust`, `getPassport`,
`passportsOf`, `verifyAgent`. Event: `PassportMinted(id, owner, agentWallet, metadataURI)`.

To recompile after changing the .sol:

```bash
npm run compile:contract
```

This regenerates `lib/AgentPassport.artifact.json` (~3 KB bytecode) which the
browser uses for the one-click deploy button.

## Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | yes | wallet connect + tx signing |
| `NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS` | no | pin a deployed contract; if unset the UI deploys on demand and remembers the address in `localStorage` |

## Scripts

```bash
npm run dev               # local dev server
npm run build             # production build
npm run start             # run the production build
npm run compile:contract  # recompile contracts/AgentPassport.sol
```
