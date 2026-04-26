# Design: First-Time Onboarding + Framer Motion Animations

**Date:** 2026-04-26
**Status:** Approved (pending implementation plan)

## Summary

Two coordinated additions to `apps/web`:

1. **First-time user onboarding** — a 3-step wizard (username → balance gate → first agent mint) that runs once when a user logs in and `users.onboarded_at` is null. The wizard's mint step is unified with the dashboard's existing Create flow (shared hook).
2. **Framer Motion animation layer** — entrance, hover, page-transition, and modal-step animations on high-impact surfaces. Honours `prefers-reduced-motion`.

## Goals & Non-Goals

**Goals**
- Detect first-time users reliably (not by inference).
- Get a new user from "wallet connected" to "first agent minted" with as few decisions as possible — username, fund (if needed), mint.
- Make the existing Create flow and onboarding's mint step share a single implementation.
- Add motion to the high-impact UI surfaces with a consistent, restrained vocabulary.

**Non-goals**
- Animating every static element (gradients, dividers).
- Replacing or restyling existing flows beyond what onboarding requires.
- Building a re-usable wizard framework — this is one wizard.
- Multi-tenant / org concepts. Onboarding is per-user only.

## Schema Migration

New file: `supabase/migrations/0003_user_onboarding.sql`

```sql
alter table users
  add column if not exists username     text unique,
  add column if not exists onboarded_at timestamptz;

create index if not exists users_username_idx on users (username);
```

- `username` — unique, set when onboarding completes. Validation: regex `^[a-z0-9_]{3,20}$`, lower-cased before insert. Nullable so the existing `/api/auth/sync` upsert keeps working for users who have not finished onboarding yet.
- `onboarded_at` — null for users still in onboarding; timestamp once they complete Step 3 successfully. Single source of truth for first-time detection.

## First-Time Detection & Routing

- `/api/auth/sync` (modified) returns `{ user, needsOnboarding: !user.onboarded_at }` instead of just `{ user }`. Clients ignore the new field for now; routing reads it server-side.
- New `/api/onboarding/complete` endpoint — writes `username` + `onboarded_at = now()` in a single transaction. Called only after a successful mint.
- New `/api/onboarding/username-available?u=<value>` — debounced availability check from Step 1. Returns `{ available: boolean, reason?: 'invalid' | 'taken' }`.
- **Routing rule**: `apps/web/app/(app)/layout.tsx` fetches the current session's user row server-side. If `onboarded_at` is null, the layout renders `<OnboardingOverlay />` on top of `children` (overlay traps focus). The dashboard URL stays `/dashboard` — no `/onboarding` route, no flicker on navigation.

## Wizard — 3 Steps

**Step 1 — Welcome + username**
- Brand hero, single input (username), live availability check (debounced 300ms).
- Validation feedback inline: format error vs taken vs available.
- "Continue" enables on valid + available.

**Step 2 — Balance gate**
- Reads `useWalletBalance` for the connected account on Avalanche Fuji.
- **Balance ≥ 0.1 AVAX** → "You're funded" panel + "Continue" button.
- **Balance < 0.1 AVAX** → fund panel:
  - Connected wallet address with copy button.
  - QR code of the address (small, optional — implementation may use a simple `qrcode` package or skip QR if it adds significant bundle weight).
  - Faucet link (`https://core.app/tools/testnet-faucet/?subnet=c&token=c`).
  - Polls `useWalletBalance` every 5s; auto-advances on threshold cross.
  - Manual "Check now" button as fallback.

**Step 3 — Create first agent (real mint)**
- Single input: agent name (default `${username}-agent-1`).
- Uses `useMintPassport` hook (shared with dashboard Create tab).
- If contract is not yet deployed for this user's session, deploy is bundled silently inside this step before the mint (one combined progress UI).
- Phase states: `idle → generating → deploying? → minting → confirming → done | error`.
- On success:
  1. Save agent record locally (existing `saveAgent`).
  2. POST `/api/onboarding/complete` with username.
  3. Dismiss overlay; the dashboard underneath already shows the new agent.

User cannot skip steps. Disconnecting the wallet exits onboarding and routes to `/login`; on reconnect, the wizard restarts from Step 1.

## Mint Refactor

The dashboard's `handleCreateAgent` (~70 LoC of mint logic) is extracted to:

`apps/web/hooks/useMintPassport.ts`

```ts
export type MintPhase =
  | 'idle' | 'generating' | 'deploying' | 'minting' | 'confirming' | 'done' | 'error';

export function useMintPassport(): {
  mint: (label: string) => Promise<AgentRecord>;
  state: { phase: MintPhase; message: string | null; lastCreated?: AgentRecord };
  reset: () => void;
};
```

Internally the hook owns:
- contract-address resolution (env > localStorage)
- chain-switch enforcement
- deploy-if-missing
- key generation, mint call, receipt wait
- local record persistence

Both consumers (Dashboard `CreateTab`, Onboarding `StepMint`) call `mint(label)` and render based on `state.phase`. Single source of truth.

## Animation Strategy

Install `framer-motion@^11` in `apps/web` only.

**Shared module:** `apps/web/lib/motion.ts`

```ts
export const MOTION = {
  duration: { fast: 0.18, base: 0.24, slow: 0.36 },
  ease: [0.22, 1, 0.36, 1] as const, // ease-out-expo-ish
};

export const fadeUp     = { /* opacity 0→1, y 8→0   */ };
export const fadeIn     = { /* opacity 0→1            */ };
export const scaleIn    = { /* opacity 0→1, scale 0.96→1 */ };
export const stagger    = { /* parent variant, stagger 0.04 */ };
export const slideX     = { /* x ±24 → 0, opacity 0→1 — for wizard step changes */ };
```

A `useMotion()` helper wraps `useReducedMotion()` from framer-motion and flattens all motion variants to opacity-only when reduced motion is on.

**Surfaces animated:**
- `AgentCard` — `fadeUp` entrance with parent `stagger`, hover `y: -2` + subtle scale.
- Dashboard tabs — content swap inside `<AnimatePresence mode="wait">` keyed on `activeTab`.
- `Notice` (toast-style) — `AnimatePresence` slide+fade.
- Page transitions — `apps/web/app/(app)/template.tsx` wraps `children` in `motion.div` with `fadeIn`.
- Onboarding overlay — backdrop `fadeIn`, panel `scaleIn`. Step changes via `<AnimatePresence mode="wait">` with `slideX`.
- `LatestPassport` reveal — `scaleIn`.
- Run page (`agents/[id]/run`) timeline entries — `fadeUp` with stagger.
- Header chips and primary buttons — subtle `whileHover` and `whileTap` (no entrance animation).

Out of scope: animated background gradients, divider shimmer, animated logo, animated typing.

## Files Touched

**New**
- `supabase/migrations/0003_user_onboarding.sql`
- `apps/web/app/api/onboarding/complete/route.ts`
- `apps/web/app/api/onboarding/username-available/route.ts`
- `apps/web/components/onboarding/OnboardingOverlay.tsx`
- `apps/web/components/onboarding/StepUsername.tsx`
- `apps/web/components/onboarding/StepBalance.tsx`
- `apps/web/components/onboarding/StepMint.tsx`
- `apps/web/hooks/useMintPassport.ts`
- `apps/web/lib/motion.ts`
- `apps/web/app/(app)/template.tsx`

**Modified**
- `apps/web/app/(app)/layout.tsx` — server-side fetch of session + onboarding state; render overlay if needed.
- `apps/web/app/api/auth/sync/route.ts` — include `needsOnboarding` in response.
- `apps/web/app/(app)/dashboard/page.tsx` — replace inline mint code with `useMintPassport`; animate cards / tabs / notices.
- `apps/web/components/agents/AgentCard.tsx` — wrap with `motion.div`, hover variants.
- `apps/web/app/(app)/agents/[id]/run/page.tsx` — page-template wrapper picks up the fade; animate timeline entries.
- `apps/web/package.json` — add `framer-motion`.

## Error Handling

| Failure | Behaviour |
|---|---|
| Username taken | 409 from `/api/onboarding/complete` *or* live availability check shows "taken". Inline message in Step 1. No state change. |
| Username invalid format | Inline message in Step 1. Continue stays disabled. |
| Balance fetch fails | Silent retry; user can still manually advance via "Check now" once funded. |
| Contract deploy rejected | Stay on Step 3, show error, "Retry" button. |
| Mint rejected / fails | Stay on Step 3, show error, "Retry". `onboarded_at` is **not** written, so the user re-enters onboarding on next login. |
| `/api/onboarding/complete` 5xx after successful mint | Show inline error with "Try again". Mint already happened on chain — retry only writes the row. The local agent record persists; the dashboard underneath would already show the agent. |
| Wallet disconnect mid-flow | Overlay tears down; redirect to `/login`. Re-entry restarts Step 1 (username state is component-local, costs one re-type). |
| Reduced motion | All variants flatten to opacity-only via `useMotion()`. |

## Testing

- **Unit (vitest)**
  - `useMintPassport` phase machine — happy path, deploy-missing path, mint rejection, contract address resolution.
  - Username validation regex.
  - `motion.ts` — variants flatten correctly under reduced motion.
- **Integration (vitest)**
  - `/api/onboarding/complete` — auth gate, username collision (409), success writes both fields, idempotency on retry.
  - `/api/onboarding/username-available` — invalid format, taken, available.
- **Manual checklist** (real chain; required because the wizard ends in a real mint)
  - First-time login → wizard appears.
  - Username live validation: too short, invalid chars, taken, available.
  - Balance < 0.1: fund panel renders, polling auto-advances after faucet drop.
  - Balance ≥ 0.1: skip fund panel, advance directly.
  - Mint succeeds → overlay dismisses → agent visible on dashboard.
  - Mint rejected → stay on Step 3, retry works.
  - Re-login as same user → no wizard.
  - Reduced-motion OS setting → animations flatten.
- **Dev-mode bypass** — `NEXT_PUBLIC_ONBOARDING_SKIP_MINT=1` skips Step 3's real mint and writes `onboarded_at` directly. For testing username/balance flow without burning Fuji AVAX. Documented in README dev section.

## Open Questions / Risks

- **QR code library** — adds ~10 kB. Acceptable; if rejected during impl, fall back to address-only.
- **Server-side onboarding check in layout** — requires reading the user row on every dashboard render. Mitigation: cache via React's `cache()` for the request scope. Acceptable cost (< 50ms typical).
- **Contract deploy from Step 3** — for users without a configured contract address, this triggers a deploy *during* the wizard. UX acceptable (single combined progress), but sequence is: deploy → mint → onboarding-complete, all atomically from the user's perspective.
