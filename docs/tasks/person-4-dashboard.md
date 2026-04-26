# Person 4 — Dashboard & Agent Management

> **You build the product surface around the demo.** Solid, unsexy, essential. Lots of v0.dev leverage; lots of forms.

## Mission

Build the dashboard, the Create Agent wizard, the agent detail page, and the action history view. Everything the user sees outside of the run page is yours.

## Files you own

```
apps/web/
├── app/(app)/
│   ├── dashboard/
│   │   └── page.tsx                 ← you write
│   └── agents/[id]/
│       └── page.tsx                 ← you write (detail page; run/ subroute is Person 3)
├── components/agents/
│   ├── AgentCard.tsx                ← you write
│   ├── AgentList.tsx                ← you write
│   ├── EmptyState.tsx               ← you write
│   ├── CreateAgentDialog.tsx        ← you write
│   ├── CreateAgentProgress.tsx      ← you write (the multi-step status)
│   ├── ActionHistoryTable.tsx       ← you write
│   └── OnChainLogTable.tsx          ← you write (reads ActionLogged events)
└── hooks/
    ├── useAgents.ts                 ← you write (SWR around /api/agents)
    ├── useAgentBalances.ts          ← you write (live AVAX + USDC)
    └── useOnChainLog.ts             ← you write (read events from chain)
```

## What you depend on

- **Person 1's** `/api/agents/create`, `/api/agents/list`, `/api/agents/[id]` endpoints
- **Person 1's** `deployments.json` for contract address + ABI to read events
- **Person 2's** `<AgentWalletPanel />` (drops into agent detail page)
- **Person 5's** app shell layout (your pages slot inside it)

You can mock the API responses for the first 6 hours.

## Acceptance criteria

### Dashboard

- [ ] Lists all user agents in a responsive grid (3 columns desktop, 1 mobile)
- [ ] Auto-refreshes via SWR every 30s
- [ ] Shows skeleton loaders while loading first time
- [ ] Empty state when no agents: dashed-border CTA card, primary button opens Create dialog
- [ ] **+ New Agent** button in top nav opens Create dialog
- [ ] When `?onboard=1` is in the URL, Create dialog auto-opens

### Agent card

- [ ] Shows: emoji avatar (deterministic from agent id), name, purpose (truncated), wallet address (click to copy), AVAX balance, USDC balance, action count, **Run task →** button
- [ ] Wallet address has a Snowtrace external-link icon
- [ ] Balances refresh every 10s
- [ ] **Run task →** routes to `/agents/[id]/run`
- [ ] Card itself (excluding buttons) routes to `/agents/[id]`
- [ ] Hover state: subtle lift + border color change

### Create Agent dialog

- [ ] shadcn/ui Dialog + Form
- [ ] Fields: name (required, ≤40), purpose (required, ≤200), tools (multi-checkbox, all 3 default-checked, at least 1 required)
- [ ] Inline validation with error messages
- [ ] On submit: shows inline progress with 3 steps:
  1. Generating wallet (instant)
  2. Funding wallet (~3s, shows tx hash when ready)
  3. Minting passport on Avalanche (~3s, shows tx hash)
- [ ] On success: closes dialog, success toast with link to the new agent
- [ ] On failure: stays open, shows error toast, keeps user input

### Agent detail page

- [ ] Header: name, purpose, "Edit" pencil icon (stub for hackathon — disabled or "Coming soon" toast)
- [ ] `<AgentWalletPanel />` (Person 2's component)
- [ ] Tabs: **Tasks**, **On-chain log**
- [ ] **Tasks** tab: table of `action_runs` with columns: time, prompt (truncated), URL, status badge, fee, Snowtrace link
- [ ] **On-chain log** tab: reads `ActionLogged` events from `ActionLog` contract for this passport
- [ ] **Run new task** button at top → routes to `/agents/[id]/run`

### Live balances hook

- [ ] `useAgentBalances(address)` returns `{ avax, usdc, loading, error }`
- [ ] Refreshes every 10s
- [ ] Formats AVAX to 4 decimals, USDC to 2 decimals
- [ ] Returns `"—"` strings while loading

### On-chain log hook

- [ ] `useOnChainLog(passportId)` reads past `ActionLogged` events
- [ ] Filters by `passportId`
- [ ] Returns `{ events, loading, error }`
- [ ] Re-fetches on mount; no polling needed

## Hour-by-hour

| Hour    | Task |
|---------|------|
| 0–2     | Lock API spec with Person 1; build local fixtures for `/api/agents/list` |
| 2–6     | v0.dev for dashboard layout + agent card; paste components |
| 6–8     | Wire `useAgents` + render real cards (against fixture or real API) |
| 8–10    | Create Agent dialog + validation |
| 10–12   | Wire Create dialog to `/api/agents/create`, multi-step progress |
| 12–14   | Live balances via viem; auto-refresh |
| 14–16   | Agent detail page: header, tabs scaffolding |
| 16–18   | Action history table from `/api/agents/[id]` |
| 18–20   | On-chain log table reading `ActionLogged` events |
| 20–22   | Empty states, loading skeletons, error toasts |
| 22–26   | Polish, copy, demo prep |

## Vibe-coding prompts

### Hour 2–6: Dashboard scaffold (v0.dev)

Paste this:

```
Design a dashboard for an AI agent platform called "Agent Passport".

Top nav (sticky):
  - Logo "Agent Passport" with a small shield icon, left.
  - Right: agent count badge ("3 agents"), "+ New Agent" primary button,
    user avatar dropdown.

Page header:
  - Title: "Your Agents"
  - Subtitle: "Each agent has its own wallet and on-chain identity on Avalanche."

Agent grid: 3 columns on desktop, 2 on tablet, 1 on mobile. Each card has:
  - A colored circular avatar with an emoji (deterministic per agent)
  - Agent name (large, bold) + purpose (one line, muted)
  - Wallet address row: truncated (0xAB12…CD34), copy icon, Snowtrace icon
  - Two stat blocks side-by-side:
      [AVAX] 0.0432 AVAX
      [USDC] 4.50 USDC
  - "Actions: 12" pill, top-right of card
  - "Run task →" primary button at the bottom right

Empty state (when no agents): one large dashed-border card centered, with
icon + "Create your first agent" + primary button.

Loading state: 3 skeleton cards with shimmer.

Style: light mode default, subtle gradient bg (gray-50 to white), Tailwind,
shadcn/ui Card/Button/Badge, Lucide icons. Avalanche red as accent (#E84142).

Export the AgentCard, EmptyState, AgentGrid, and DashboardPage as separate components.
```

### Hour 8–10: Create Agent dialog

```
Create components/agents/CreateAgentDialog.tsx.

Use shadcn/ui Dialog. State machine:
  type Step = "form" | "creating-wallet" | "funding" | "minting" | "done" | "error";

Form (Step "form"):
  - name (required, max 40)
  - purpose (required, max 200, textarea)
  - tools (CheckboxGroup with 3 options, all default checked, min 1):
      "scraper"    → label "Web Scraper" + Globe icon
      "summarizer" → label "Summarizer" + FileText icon
      "logger"     → label "On-chain Logger" + Box icon
  - Cancel button + "Create Agent" submit button

On submit, call POST /api/agents/create with the body. Use a transition:

  setStep("creating-wallet");
  // The API returns the entire result in one response, but we want to show
  // the user a sequence. Parse the response for { fundingTxHash, mintTxHash }
  // and animate through the three steps even though the work happened server-side.

Progress display (Steps "creating-wallet" | "funding" | "minting"):
  Three rows, each with: spinner | check | (greyed) status icon
  Row 1: "Generating wallet"        (always 500ms)
  Row 2: "Funding with AVAX"   (show fundingTxHash truncated when done)
  Row 3: "Minting passport on Avalanche" (show mintTxHash when done)

  Use framer-motion AnimatePresence. Each step takes 1-2s of artificial delay
  between the API response and the UI advancing — gives the user feedback that
  real on-chain things happened.

Step "done":
  Confetti or pulse, "Researcher is ready", primary "View agent →" button
  routes to /agents/[id], close dialog.

Step "error":
  Show error message, "Try again" button → back to form, "Cancel" closes.
```

### Hour 12–14: Balances hook

```
Create hooks/useAgentBalances.ts.

"use client";
import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits, formatEther, erc20Abi } from "viem";
import { avalancheFuji } from "viem/chains";

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
});
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

export function useAgentBalances(address?: `0x${string}`) {
  const [avax, setAvax] = useState<string>("—");
  const [usdc, setUsdc] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    async function fetchAll() {
      try {
        const [avaxBal, usdcBal] = await Promise.all([
          client.getBalance({ address }),
          client.readContract({
            address: USDC, abi: erc20Abi,
            functionName: "balanceOf", args: [address],
          }) as Promise<bigint>,
        ]);
        if (cancelled) return;
        setAvax(parseFloat(formatEther(avaxBal)).toFixed(4));
        setUsdc(parseFloat(formatUnits(usdcBal, 6)).toFixed(2));
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    const t = setInterval(fetchAll, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [address]);

  return { avax, usdc, loading };
}
```

### Hour 18–20: On-chain log hook

```
Create hooks/useOnChainLog.ts.

"use client";
import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { avalancheFuji } from "viem/chains";
import deployments from "@/../packages/contracts/deployments.json";

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
});

const event = parseAbiItem(
  "event ActionLogged(uint256 indexed passportId, address indexed agentWallet, bytes32 taskHash, bytes32 actionsRoot, uint256 feeAmount, address beneficiary, uint256 blockTimestamp)"
);

export function useOnChainLog(passportId?: string) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!passportId) return;
    let cancelled = false;
    async function fetchAll() {
      try {
        const events = await client.getLogs({
          address: deployments.ActionLog.address as `0x${string}`,
          event,
          args: { passportId: BigInt(passportId) },
          fromBlock: "earliest",
        });
        if (cancelled) return;
        setLogs(events.map(e => ({
          ...e.args,
          txHash: e.transactionHash,
          blockNumber: e.blockNumber,
        })));
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [passportId]);

  return { logs, loading };
}
```

### Snowtrace links

Anywhere you display a tx hash or address, link out:

```ts
const SNOWTRACE = "https://testnet.snowtrace.io";
const txUrl = (hash: string) => `${SNOWTRACE}/tx/${hash}`;
const addrUrl = (addr: string) => `${SNOWTRACE}/address/${addr}`;
```

## Common pitfalls

- **`bigint` rendering.** React can't render bigints. Always `.toString()` first or `Number()` for small values.
- **Stale balance after agent creation.** Wait 1 confirmation before navigating to dashboard so the first balance read shows funded amounts.
- **SWR caching across users.** If a user logs out and another logs in, invalidate the cache. Use `mutate()` from SWR on logout.
- **Empty state vs loading state.** Don't show empty state while still loading — show skeletons. Empty only after fetch succeeds with `[]`.
- **Tailwind purging.** Don't construct class names dynamically (`bg-${color}-500` won't work). Use a switch / lookup map.
- **Avatar emoji determinism.** Use a hash of agent ID to pick from a fixed array of emojis, so the same agent always has the same avatar.

## Done definition

You're done when a logged-in user can see their agents on the dashboard, create a new one through the wizard with visible progress, click into agent detail and see live balances + tx history + on-chain events, all without console errors and on the deployed Vercel preview.
