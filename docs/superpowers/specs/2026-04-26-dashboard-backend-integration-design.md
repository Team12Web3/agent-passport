# Dashboard ↔ Backend Integration Design

**Date:** 2026-04-26
**Status:** Approved (brainstorm phase)
**Owners:** Person 1 (backend) + Person 4 (dashboard)

## Problem

Two parallel passport-mint flows exist in the app:

- `app/(app)/dashboard/page.tsx` — client-side: thirdweb mints from the user's wallet, agent EOAs are generated and stored in `localStorage` via `lib/agentKeys.ts`, agents are read from chain via `fetchPassportsOf`. **Never calls** `/api/agents/*`.
- `app/(app)/agents/[id]/run/page.tsx` — server-backed: calls `/api/agents/[id]` (Supabase) and streams `/api/run`. Expects Supabase UUIDs.

Result: agents created on the dashboard cannot be opened in the run page. The run page has no entry point. Cards on the dashboard show meaningless data (`deterministicPercent`) because the client has no concept of `actionCount`, `purpose`, or `tools`.

The backend (Person 1) is complete and works:
- `POST /api/agents/create` — provisions wallet, funds (AVAX + USDC), platform-signs `mintPassport`, persists Supabase row.
- `GET /api/agents/list` — list user's agents with `actionCount`.
- `GET /api/agents/[id]` — agent + recent runs.
- `POST /api/run` — SSE stream of agent execution.
- `POST /api/log/submit`, `GET /api/trust/demo-site` — already wired in run page.

## Goal

Dashboard becomes a thin client over the backend. One source of truth for agents (Supabase). Agent IDs across the UI are Supabase UUIDs, so navigation between dashboard and run page works without translation. Cards show real backend data.

## Non-goals

- No automated test additions (matches repo convention).
- No SWR / React Query introduction.
- No migration of existing `localStorage` agents — those are demo cruft from an earlier flow and are dropped (decision A in brainstorm).
- No changes to backend API shape, contracts, runtime, or auth implementation.
- No changes to the `/agents/[id]/run` page beyond what becomes free when its inbound IDs are now real Supabase UUIDs.

## Architecture

```
┌────────────────────┐     fetch       ┌───────────────────────┐
│ Dashboard (client) │ ──────────────▶ │ /api/agents/list      │ ──▶ Supabase
│                    │ ◀────────────── │ /api/agents/create    │ ──▶ wallet→fund→mint
│  Monitor tab       │                 │ /api/agents/[id]      │ ──▶ Supabase
│  Create form       │                 └───────────────────────┘
│  Profile tab       │                                ▲
│                    │     SIWE cookie                │
│  useAuth gate ─────┼────────────────────────────────┘
└────────────────────┘
        │
        │ router.push(`/agents/${uuid}/run`)
        ▼
┌────────────────────────┐
│ Agent run page         │ ──▶ /api/run (SSE), /api/agents/[id]
└────────────────────────┘
```

- Dashboard: no chain reads from the browser, no `useSendTransaction` for mint, no `localStorage` agent keys.
- Auth: gated on SIWE session via `/api/auth/status`. Wallet hooks remain only for Profile-tab display and the Disconnect button.
- Agent IDs across the app: Supabase UUIDs.

### thirdweb hooks: kept vs dropped

Kept (Profile tab + header + Disconnect):
- `useActiveAccount` — wallet address, avatar seed.
- `useActiveWallet` + `useDisconnect` — Disconnect button.
- `useActiveWalletChain` — chain name + ID display, Fuji indicator.
- `useProfiles` — linked email.
- `useWalletBalance` — balance display.

Dropped (no longer relevant after backend mint takes over):
- `useSendTransaction` — was used for client-side mint.
- `useSwitchActiveWalletChain` — was used to force Fuji before the user-signed mint; not needed when the platform key signs server-side. Profile tab can still surface "wrong network" passively.

The Disconnect handler keeps its current shape: `POST /api/auth/logout` (clears the SIWE cookie), then `disconnect(wallet)`, then `router.replace("/login")`.

## Components

### New: `apps/web/lib/api/agents.ts`

Single thin wrapper over `/api/agents/*`. Owns request shape, credentials, and error translation.

```ts
export type DashboardAgent = {
  agentId: string;          // Supabase UUID — what /agents/[id]/run expects
  name: string;
  purpose: string;
  tools: ("scraper" | "summarizer" | "logger")[];
  passportId: string;       // on-chain id, stringified bigint
  walletAddress: `0x${string}`;
  actionCount: number;
  createdAt: string;        // ISO
};

export type CreateAgentInput = {
  name: string;
  purpose: string;
  tools: DashboardAgent["tools"];
};

export type CreateAgentResult = {
  agentId: string;
  passportId: string;
  walletAddress: `0x${string}`;
  fundingTxHash: `0x${string}`;
  mintTxHash: `0x${string}`;
};

export class UnauthorizedError extends Error {}
export class ApiError extends Error {
  status: number;
  details?: unknown;
}

export async function listAgents(): Promise<DashboardAgent[]>;
export async function createAgent(input: CreateAgentInput): Promise<CreateAgentResult>;
```

Behavior:
- All requests use `credentials: "include"`.
- 401 → throw `UnauthorizedError`. Dashboard catches once at the top level and `router.replace("/login")`.
- 4xx with body `{ error, details? }` → throw `ApiError(status, message, details)`. The Create form surfaces field-level Zod errors from `details`.
- 502 with body `{ error: "provisioning_failed", step }` → `ApiError(502, ...)` with `step` carried through; Create form maps step→message.
- No retry, no caching. Successful create triggers a `listAgents()` re-fetch.

### Modified: `apps/web/components/agents/AgentCard.tsx`

Today: takes `Passport` shape + `progressPercent` + `sourceLabel` + `trusted` + `agentId`. Click target is `Link href={\`/agents/${encodeURIComponent(agentId)}/run\`}` — already correct in shape, but `agentId` was a synthetic `passport-${id}` string.

New props (replaces all current props):

```ts
type AgentCardProps = {
  agent: DashboardAgent;
};
```

Display:
- Header: `agent.name` + truncated `agent.walletAddress`.
- Subtitle: `agent.purpose`, line-clamped to 2.
- Chips: one per `agent.tools[]` value.
- Footer: `#${agent.passportId} · ${agent.actionCount} action${s}` + "→" affordance.
- Click target: `Link` to `/agents/${agent.agentId}/run` (Supabase UUID, no encoding gymnastics needed).

Removed concepts: `progressPercent`, `deterministicPercent`, `sourceLabel`, the activity bar, the `trusted`/`Building`/`Revoked` tri-state. `actionCount` is the meaningful activity signal now. Trust-score display is dropped from the card; if needed later, the run page already surfaces it in the sticky `PassportStatusBar`.

### Modified: `apps/web/app/(app)/dashboard/page.tsx`

Major rewrite (~900 → ~400 lines). The `DashboardShell` becomes:

```ts
function DashboardShell() {
  const router = useRouter();
  const { isLoading, isAuthenticated, address } = useAuth();      // updated, see below
  const [agents, setAgents]   = useState<DashboardAgent[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab]         = useState<"monitor" | "create" | "profile">("monitor");

  // Single auth gate
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  // Initial + on-demand list fetch
  const refresh = useCallback(async () => {
    try { setAgents(await listAgents()); setLoadErr(null); }
    catch (e) {
      if (e instanceof UnauthorizedError) { router.replace("/login"); return; }
      setLoadErr(e instanceof Error ? e.message : "Failed to load agents.");
    }
  }, [router]);

  useEffect(() => { if (isAuthenticated) refresh(); }, [isAuthenticated, refresh]);

  // ... Monitor / Create / Profile tabs ...
}
```

**Monitor tab.** Renders `agents.map(a => <AgentCard agent={a} />)` in the existing grid. Empty state: "Create your first agent" CTA → switches to Create tab. Error chip in the tab bar surfaces `loadErr`.

**Create tab.** Form:
- `Name` — required input, 1–40.
- `Advanced ▸` disclosure (closed by default). When open:
  - `Purpose` — textarea, 1–200, default `"General-purpose agent"`.
  - `Tools` — three checkboxes (`scraper`, `summarizer`, `logger`), all checked by default. At least one must remain checked (client-side guard).

Submit handler:

```ts
async function handleSubmit(e) {
  e.preventDefault();
  setCreate({ loading: true });
  try {
    const result = await createAgent({ name, purpose, tools });
    await refresh();
    setCreate({ loading: false, ok: true, lastCreated: result });
    setTab("monitor");
  } catch (e) {
    if (e instanceof UnauthorizedError) { router.replace("/login"); return; }
    if (e instanceof ApiError && e.status === 400 && e.details) {
      setCreate({ loading: false, ok: false, fieldErrors: parseZodDetails(e.details) });
    } else if (e instanceof ApiError && e.status === 502) {
      const step = (e.details as { step?: string })?.step ?? "unknown";
      setCreate({ loading: false, ok: false, message: PROVISION_MESSAGES[step] ?? e.message });
    } else {
      setCreate({ loading: false, ok: false, message: "Couldn't create agent. Try again." });
    }
  }
}
```

Success notice: shows `passportId`, links `mintTxHash` to Snowtrace.

**Profile tab.** Keeps:
- Connected wallet address + avatar.
- Linked email (from `useProfiles`).
- Active chain name + ID.
- Wallet balance.

Drops:
- "Passport contract" field (it was env/localStorage-sourced; backend now owns this).

Adds:
- "Total actions" — `agents.reduce((n, a) => n + a.actionCount, 0)`.

### Modified: `apps/web/hooks/useAuth.ts`

Today the hook is wallet-only (`useActiveAccount` / `useActiveWallet`). It must round-trip `/api/auth/status` so the dashboard knows whether the SIWE cookie is valid, not just whether a wallet is plugged in.

```ts
export function useAuth() {
  const account = useActiveAccount();
  const [serverState, setServerState] = useState<"loading" | "ok" | "anon">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { authenticated: false })
      .then((j) => { if (!cancelled) setServerState(j.authenticated ? "ok" : "anon"); })
      .catch(() => { if (!cancelled) setServerState("anon"); });
    return () => { cancelled = true; };
  }, []);

  return {
    address: account?.address as `0x${string}` | undefined,
    isLoading: serverState === "loading",
    isAuthenticated: serverState === "ok",
  };
}
```

This change is local to `useAuth`. The login page already gates on `/api/auth/status` per commit `7ed7f52`, so no callers need updating beyond the dashboard.

## Files to delete

After verifying no remaining imports:

- `apps/web/lib/agentKeys.ts`
- `apps/web/lib/AgentPassport.artifact.json`
- `apps/web/lib/agentPassport.ts` — only if `AgentCard` no longer imports `Passport` and no other call site uses `fetchPassportsOf` / `fetchPassportById` / `parsePassportMintedFromLogs` / `toDisplayPassport`. If any survive, leave the module alone.

## Error handling

Three classes:

1. **Unauthorized (401)** — single top-level catch via `UnauthorizedError`; `router.replace("/login")` once. No retry.
2. **Validation (400 + `details`)** — `parseZodDetails` flattens `details` into `{ name?, purpose?, tools? }`; rendered inline under each field.
3. **Provisioning (502 + `step`)** — `PROVISION_MESSAGES` map:
   - `wallet` → "Couldn't generate a fresh agent wallet. Try again."
   - `funding` → "Couldn't fund the agent wallet — platform may be out of test AVAX. Try again shortly."
   - `mint` → "Mint transaction failed on-chain. Try again."
   With a Retry button that resubmits the same form values.

## Testing

Manual smoke list (no automated tests):

1. Logged out → dashboard redirects to `/login`.
2. Logged in, zero agents → empty state, "Create your first agent" CTA.
3. Create with name only → success notice with passport id + Snowtrace link, agent appears on Monitor with default purpose ("General-purpose agent") and all three tool chips.
4. Create with Advanced fields → custom purpose and selected tools reflected on card.
5. Click card → lands on `/agents/[id]/run`, name and wallet match.
6. Run an agent end-to-end → SSE streams, `ActionLog` tx visible on Snowtrace.
7. Validation: submit with empty name → inline error, no network call (Zod client-side mirror) or 400 from server with inline error.
8. Provisioning failure path: temporarily point `PLATFORM_PRIVATE_KEY` at an unfunded address → submit → user sees "platform may be out of test AVAX" message.

## Build sequence

1. `lib/api/agents.ts` — types + functions + error classes. No call sites yet.
2. `hooks/useAuth.ts` upgrade — `/api/auth/status` round trip.
3. `components/agents/AgentCard.tsx` widening — new props.
4. `app/(app)/dashboard/page.tsx` rewrite — Monitor wired, Create wired, Profile trimmed.
5. Delete dead files (`lib/agentKeys.ts`, artifact JSON, `lib/agentPassport.ts` if unused).
6. Manual smoke test of the 8 cases above.

Each step compiles and runs on its own (the dashboard rewrite is the only step that flips the UX; everything before it is additive).
