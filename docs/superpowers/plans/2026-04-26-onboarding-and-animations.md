# Onboarding + Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a frictionless first-time onboarding wizard (username → balance gate → first agent mint) gated on `users.onboarded_at`, and add a restrained Framer Motion animation layer across the high-impact UI surfaces.

**Architecture:** Onboarding overlay is rendered by the `(app)` layout when the server-side session's user row has `onboarded_at = null`. The wizard's mint step shares logic with the dashboard's Create tab via a new `useMintPassport` hook. Animation primitives live in a single `lib/motion.ts` module so all surfaces use the same vocabulary (durations, easings, variants) and respect `prefers-reduced-motion`.

**Tech Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Supabase (service-role) · Thirdweb (SIWE auth + on-chain mint) · Framer Motion 11 · vitest

**Spec:** `docs/superpowers/specs/2026-04-26-onboarding-and-animations-design.md`

---

## File Structure

**Created**
- `supabase/migrations/0003_user_onboarding.sql` — adds `username` + `onboarded_at`.
- `apps/web/app/api/onboarding/complete/route.ts` — writes username + onboarded_at.
- `apps/web/app/api/onboarding/username-available/route.ts` — debounced availability check.
- `apps/web/components/onboarding/OnboardingOverlay.tsx` — wizard shell + step routing.
- `apps/web/components/onboarding/StepUsername.tsx` — Step 1.
- `apps/web/components/onboarding/StepBalance.tsx` — Step 2.
- `apps/web/components/onboarding/StepMint.tsx` — Step 3.
- `apps/web/hooks/useMintPassport.ts` — shared mint state machine.
- `apps/web/lib/motion.ts` — animation variants, durations, reduced-motion helper.
- `apps/web/app/(app)/template.tsx` — fade page transitions on route changes.
- `apps/web/app/(app)/onboarding-state.ts` — server helper to read onboarding state.

**Modified**
- `apps/web/app/(app)/layout.tsx` — render `OnboardingOverlay` when needed.
- `apps/web/app/api/auth/sync/route.ts` — return `needsOnboarding`.
- `apps/web/app/(app)/dashboard/page.tsx` — replace inline mint code with `useMintPassport`; animate cards/tabs/notices.
- `apps/web/components/agents/AgentCard.tsx` — wrap in `motion.div`.
- `apps/web/app/(app)/agents/[id]/run/page.tsx` — animate timeline entries.
- `apps/web/lib/db/supabase.ts` — extend `UserRow` type.
- `apps/web/package.json` — add `framer-motion`, `qrcode.react`.

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/0003_user_onboarding.sql`
- Modify: `apps/web/lib/db/supabase.ts:55-61` (extend `UserRow`)

- [ ] **Step 1: Write migration**

Create `supabase/migrations/0003_user_onboarding.sql`:

```sql
-- 0003_user_onboarding.sql — adds onboarding fields to users.
-- Both columns are nullable: existing rows are treated as "not onboarded".
-- The username unique index is partial so multiple nulls don't collide.

alter table users
  add column if not exists username     text,
  add column if not exists onboarded_at timestamptz;

create unique index if not exists users_username_unique_idx
  on users (lower(username))
  where username is not null;
```

- [ ] **Step 2: Extend `UserRow` type**

In `apps/web/lib/db/supabase.ts`, replace the existing `UserRow` export with:

```ts
export type UserRow = {
  id: string;
  thirdweb_id: string;
  email: string | null;
  wallet_address: string | null;
  username: string | null;
  onboarded_at: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Run migration locally**

Run: `pnpm db:migrate`
Expected: migration `0003_user_onboarding.sql` applies cleanly. Re-running is idempotent (uses `if not exists`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_user_onboarding.sql apps/web/lib/db/supabase.ts
git commit -m "Add username and onboarded_at to users"
```

---

## Task 2: Install Framer Motion + add motion module

**Files:**
- Create: `apps/web/lib/motion.ts`
- Modify: `apps/web/package.json`
- Test: `apps/web/lib/motion.test.ts`

- [ ] **Step 1: Install framer-motion and qrcode.react**

Run: `pnpm --filter web add framer-motion@^11 qrcode.react@^4`
Expected: both packages added under `dependencies` in `apps/web/package.json`.

- [ ] **Step 2: Write failing test for motion module**

Create `apps/web/lib/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MOTION, fadeUp, fadeIn, scaleIn, slideX, stagger, flatten } from "./motion";

describe("motion variants", () => {
  it("exposes a single source of truth for durations and easings", () => {
    expect(MOTION.duration.fast).toBeCloseTo(0.18);
    expect(MOTION.duration.base).toBeCloseTo(0.24);
    expect(Array.isArray(MOTION.ease)).toBe(true);
  });

  it("fadeUp animates opacity and y", () => {
    expect(fadeUp.initial).toEqual({ opacity: 0, y: 8 });
    expect(fadeUp.animate.opacity).toBe(1);
    expect(fadeUp.animate.y).toBe(0);
  });

  it("scaleIn animates opacity and scale", () => {
    expect(scaleIn.initial).toEqual({ opacity: 0, scale: 0.96 });
    expect(scaleIn.animate.opacity).toBe(1);
    expect(scaleIn.animate.scale).toBe(1);
  });

  it("slideX has direction-aware initial state", () => {
    expect(slideX.initial.x).toBe(24);
    expect(slideX.exit.x).toBe(-24);
  });

  it("stagger orchestrates children", () => {
    expect(stagger.animate.transition.staggerChildren).toBeGreaterThan(0);
  });

  it("flatten() collapses motion variants to opacity-only", () => {
    const flat = flatten(fadeUp);
    expect(flat.initial).toEqual({ opacity: 0 });
    expect(flat.animate.opacity).toBe(1);
    // y must not be present in the flattened variant
    expect((flat.animate as Record<string, unknown>).y).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- motion.test`
Expected: FAIL — module `./motion` cannot be resolved.

- [ ] **Step 4: Implement `lib/motion.ts`**

Create `apps/web/lib/motion.ts`:

```ts
import { useReducedMotion, type Variants } from "framer-motion";

export const MOTION = {
  duration: { fast: 0.18, base: 0.24, slow: 0.36 },
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

const baseTransition = { duration: MOTION.duration.base, ease: MOTION.ease };

export type MotionVariant = {
  initial: Record<string, number>;
  animate: Record<string, number> & { transition?: Record<string, unknown> };
  exit?: Record<string, number> & { transition?: Record<string, unknown> };
};

export const fadeIn: MotionVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const fadeUp: MotionVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, y: -4, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const scaleIn: MotionVariant = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: baseTransition },
  exit: { opacity: 0, scale: 0.98, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const slideX: MotionVariant = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: baseTransition },
  exit: { opacity: 0, x: -24, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
} as const satisfies Variants;

export function flatten(v: MotionVariant): MotionVariant {
  const keep = (s: Record<string, unknown>) => ({ opacity: s.opacity ?? 1 });
  return {
    initial: { opacity: v.initial.opacity ?? 0 },
    animate: { ...keep(v.animate), transition: v.animate.transition },
    exit: v.exit ? { ...keep(v.exit), transition: v.exit.transition } : undefined,
  } as MotionVariant;
}

export function useMotionVariant(v: MotionVariant): MotionVariant {
  const reduce = useReducedMotion();
  return reduce ? flatten(v) : v;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test -- motion.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/lib/motion.ts apps/web/lib/motion.test.ts pnpm-lock.yaml
git commit -m "Add framer-motion + shared motion variants"
```

---

## Task 3: Update /api/auth/sync to return needsOnboarding

**Files:**
- Modify: `apps/web/app/api/auth/sync/route.ts`

- [ ] **Step 1: Edit the route**

Replace the body of `apps/web/app/api/auth/sync/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

type SyncRequestBody = {
  email?: string | null;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SyncRequestBody;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        thirdweb_id: session.thirdwebId,
        wallet_address: session.address,
        email: body.email ?? null,
      },
      { onConflict: "thirdweb_id" },
    )
    .select("id, thirdweb_id, email, wallet_address, username, onboarded_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: data,
    needsOnboarding: !data.onboarded_at,
  });
}
```

- [ ] **Step 2: Verify by hand**

Run: `pnpm --filter web dev` and log in with a fresh wallet.
Expected: network tab shows `/api/auth/sync` returning `{ user, needsOnboarding: true }`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/auth/sync/route.ts
git commit -m "Return needsOnboarding from /api/auth/sync"
```

---

## Task 4: /api/onboarding/username-available

**Files:**
- Create: `apps/web/app/api/onboarding/username-available/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/app/api/onboarding/username-available/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function GET(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const u = (req.nextUrl.searchParams.get("u") ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .ilike("username", u)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
```

- [ ] **Step 2: Manual smoke test**

Run dev server, hit `/api/onboarding/username-available?u=ab` (logged in).
Expected: `{ available: false, reason: "invalid" }` (too short).

Hit `?u=hackerone` after logging in once.
Expected: `{ available: true }`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/onboarding/username-available/route.ts
git commit -m "Add /api/onboarding/username-available"
```

---

## Task 5: /api/onboarding/complete

**Files:**
- Create: `apps/web/app/api/onboarding/complete/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/app/api/onboarding/complete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Body = { username?: string };

export async function POST(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { username } = (await req.json()) as Body;
  const u = (username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Pre-check uniqueness so we can return a clean 409 (the unique index
  // would otherwise surface a generic 23505).
  const { data: existing } = await supabase
    .from("users")
    .select("id, thirdweb_id")
    .ilike("username", u)
    .maybeSingle();

  if (existing && existing.thirdweb_id !== session.thirdwebId) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ username: u, onboarded_at: new Date().toISOString() })
    .eq("thirdweb_id", session.thirdwebId)
    .select("id, thirdweb_id, username, onboarded_at")
    .single();

  if (error) {
    // Race: another concurrent insert took the username between our pre-check
    // and the update — surface the conflict cleanly.
    if (error.code === "23505") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
```

- [ ] **Step 2: Manual smoke test**

While logged in, run from devtools:
```js
await fetch("/api/onboarding/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "hackerone" })
}).then(r => r.json());
```
Expected: `{ user: { ..., username: "hackerone", onboarded_at: "<iso>" } }`. A second call with a different already-taken username from another wallet should return `{ error: "username_taken" }` with 409.

- [ ] **Step 3: Reset for further development**

In Supabase studio, run `update users set username = null, onboarded_at = null where thirdweb_id = '<your wallet>'` so subsequent tasks can re-run the wizard.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/onboarding/complete/route.ts
git commit -m "Add /api/onboarding/complete"
```

---

## Task 6: useMintPassport hook (extracted from dashboard)

**Files:**
- Create: `apps/web/hooks/useMintPassport.ts`

- [ ] **Step 1: Write the hook**

Create `apps/web/hooks/useMintPassport.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getContract, prepareContractCall, waitForReceipt, type ThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import { deployContract } from "thirdweb/deploys";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSendTransaction,
  useSwitchActiveWalletChain,
} from "thirdweb/react";

import {
  AGENT_PASSPORT_ABI,
  AGENT_PASSPORT_BYTECODE,
  parsePassportMintedFromLogs,
} from "@/lib/agentPassport";
import {
  generateAgent,
  getStoredContractAddress,
  saveAgent,
  setStoredContractAddress,
  type AgentRecord,
} from "@/lib/agentKeys";

export type MintPhase =
  | "idle"
  | "generating"
  | "deploying"
  | "minting"
  | "confirming"
  | "done"
  | "error";

export type MintState = {
  phase: MintPhase;
  message: string | null;
  lastCreated?: AgentRecord;
};

const ENV_CONTRACT = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function useMintPassport(client: ThirdwebClient) {
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });

  const [storedContract, setStoredContract] = useState<string | null>(null);
  useEffect(() => {
    setStoredContract(getStoredContractAddress());
  }, []);

  const contractAddress = useMemo(() => {
    if (isValidAddress(ENV_CONTRACT)) return ENV_CONTRACT;
    if (isValidAddress(storedContract)) return storedContract;
    return "";
  }, [storedContract]);

  const [state, setState] = useState<MintState>({ phase: "idle", message: null });

  const reset = useCallback(() => setState({ phase: "idle", message: null }), []);

  const ensureFuji = useCallback(async () => {
    if (chain?.id === avalancheFuji.id) return;
    try {
      await switchChain(avalancheFuji);
    } catch {
      throw new Error("Switch your wallet network to Avalanche Fuji (43113) and try again.");
    }
  }, [chain?.id, switchChain]);

  const ensureContract = useCallback(async (): Promise<string> => {
    if (isValidAddress(contractAddress)) return contractAddress;
    if (!account) throw new Error("Connect a wallet first.");
    setState({ phase: "deploying", message: "Confirm the deploy in your wallet…" });
    await ensureFuji();
    const address = await deployContract({
      client,
      chain: avalancheFuji,
      account,
      abi: AGENT_PASSPORT_ABI as never,
      bytecode: AGENT_PASSPORT_BYTECODE as `0x${string}`,
      constructorParams: {},
    });
    setStoredContractAddress(address);
    setStoredContract(address);
    return address;
  }, [account, client, contractAddress, ensureFuji]);

  const mint = useCallback(
    async (rawLabel: string): Promise<AgentRecord> => {
      if (!account) {
        const err = "Connect a wallet first.";
        setState({ phase: "error", message: err });
        throw new Error(err);
      }
      const label = rawLabel.trim() || `agent-${Date.now().toString(36)}`;
      try {
        setState({ phase: "generating", message: "Generating agent keypair…" });
        const generated = generateAgent();

        const address = await ensureContract();

        await ensureFuji();

        setState({ phase: "minting", message: "Confirm the mint in your wallet…" });

        const contract = getContract({ address, chain: avalancheFuji, client });
        const tx = prepareContractCall({
          contract,
          method:
            "function mintPassport(address agentWallet, string metadataURI) returns (uint256)",
          params: [
            generated.address,
            JSON.stringify({ label, createdAt: new Date().toISOString() }),
          ],
        });

        const sent = await sendTx(tx);

        setState({ phase: "confirming", message: "Waiting for Fuji confirmation…" });
        const receipt = await waitForReceipt({
          client,
          chain: avalancheFuji,
          transactionHash: sent.transactionHash,
        });

        const minted = parsePassportMintedFromLogs(receipt.logs ?? [], address);
        if (!minted) throw new Error("Mint succeeded but PassportMinted event was missing.");

        const record = saveAgent({
          passportId: minted.id.toString(),
          agentAddress: generated.address,
          privateKey: generated.privateKey,
          ownerAddress: account.address,
          label,
          mintTxHash: receipt.transactionHash,
        });

        setState({
          phase: "done",
          message: `Passport #${record.passportId} minted for ${label}.`,
          lastCreated: record,
        });
        return record;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Mint failed, was rejected, or you may need Fuji AVAX for gas.";
        setState({ phase: "error", message });
        throw e instanceof Error ? e : new Error(message);
      }
    },
    [account, client, ensureContract, ensureFuji, sendTx],
  );

  return { mint, reset, state, contractAddress };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/useMintPassport.ts
git commit -m "Extract mint flow into useMintPassport hook"
```

---

## Task 7: Refactor dashboard CreateTab to use the hook

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace inline mint state with the hook**

In `apps/web/app/(app)/dashboard/page.tsx`, inside `DashboardShell`:

1. Remove the local `createState`, `deployState`, and the `handleCreateAgent` / `handleDeployContract` functions.
2. Add at the top of `DashboardShell`:

```tsx
const mintHook = useMintPassport(client);
```

3. Replace `handleCreateAgent` with:

```tsx
async function handleCreateAgent(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  try {
    await mintHook.mint(agentLabel);
    setAgentLabel("");
    setActiveTab("monitor");
    await hydrateOnChainAgents();
  } catch {
    // mintHook.state already carries the error message
  }
}
```

4. Replace `handleDeployContract` with a no-op stub or remove entirely; the hook handles deploy implicitly. Update the `CreateTab` JSX to remove the deploy panel — instead, when the user has no contract, the hook will deploy as part of `mint()` automatically. Replace:

```tsx
hasContract={isValidAddress(contractAddress)}
```

with:

```tsx
hasContract={true}
```

(both call sites). Remove `showDeployBox`, `storedContractAddress`, `onDeploy`, `deployState` props and their UI.

5. Replace `createState` references with `mintHook.state` — map phases to UI:

```tsx
const isWorking = mintHook.state.phase !== "idle"
  && mintHook.state.phase !== "done"
  && mintHook.state.phase !== "error";
const showSuccess = mintHook.state.phase === "done";
const showError   = mintHook.state.phase === "error";
```

6. The `<Notice>` block becomes:

```tsx
{mintHook.state.message && (
  <Notice tone={showError ? "error" : "success"} className="mt-5">
    {mintHook.state.message}
  </Notice>
)}
{mintHook.state.lastCreated && (
  <LatestPassport
    record={mintHook.state.lastCreated}
    contractAddress={mintHook.contractAddress}
  />
)}
```

7. The submit button uses `disabled={isWorking}` and shows the spinner during all working phases.

8. Add the import at the top:

```tsx
import { useMintPassport } from "@/hooks/useMintPassport";
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Start dev server, log in with a wallet that already has Fuji AVAX, switch to **Create** tab, mint an agent. Confirm it appears in **Monitor**.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(app)/dashboard/page.tsx
git commit -m "Use useMintPassport in dashboard Create tab"
```

---

## Task 8: Onboarding state helper + layout gating

**Files:**
- Create: `apps/web/app/(app)/onboarding-state.ts`
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Write the server-side onboarding helper**

Create `apps/web/app/(app)/onboarding-state.ts`:

```ts
import "server-only";
import { cache } from "react";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export type OnboardingState =
  | { signedIn: false }
  | { signedIn: true; needsOnboarding: boolean; username: string | null };

// Cached per request so layout + page reads share one query.
export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getCurrentThirdwebSession();
  if (!session) return { signedIn: false };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("username, onboarded_at")
    .eq("thirdweb_id", session.thirdwebId)
    .maybeSingle();

  // No row yet (first visit between login and sync) — treat as needing onboarding.
  if (!data) return { signedIn: true, needsOnboarding: true, username: null };

  return {
    signedIn: true,
    needsOnboarding: !data.onboarded_at,
    username: data.username,
  };
});
```

- [ ] **Step 2: Update `(app)/layout.tsx` to render the overlay when needed**

Replace the contents of `apps/web/app/(app)/layout.tsx` with:

```tsx
import type { ReactNode } from "react";

import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { getOnboardingState } from "./onboarding-state";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const state = await getOnboardingState();
  const showOnboarding = state.signedIn && state.needsOnboarding;
  return (
    <>
      {children}
      {showOnboarding && <OnboardingOverlay />}
    </>
  );
}
```

(Note: the overlay component will be added in Task 9. Until then, `pnpm typecheck` will fail. Commit only after Task 9.)

- [ ] **Step 3: Defer commit**

Wait until Task 9 lands; commit them together.

---

## Task 9: OnboardingOverlay shell + step routing

**Files:**
- Create: `apps/web/components/onboarding/OnboardingOverlay.tsx`
- Create: `apps/web/components/onboarding/StepUsername.tsx` (stub for now)
- Create: `apps/web/components/onboarding/StepBalance.tsx` (stub)
- Create: `apps/web/components/onboarding/StepMint.tsx` (stub)

- [ ] **Step 1: Stub the three steps so the shell compiles**

Create each as a placeholder. `apps/web/components/onboarding/StepUsername.tsx`:

```tsx
"use client";
export function StepUsername({ onNext }: { onNext: (username: string) => void }) {
  return <div className="p-6 text-fg">Step 1 — username (TODO)</div>;
}
```

`StepBalance.tsx`:

```tsx
"use client";
export function StepBalance({ onNext }: { onNext: () => void }) {
  return <div className="p-6 text-fg">Step 2 — balance (TODO)</div>;
}
```

`StepMint.tsx`:

```tsx
"use client";
export function StepMint({
  username,
  onComplete,
}: {
  username: string;
  onComplete: () => void;
}) {
  return <div className="p-6 text-fg">Step 3 — mint (TODO)</div>;
}
```

- [ ] **Step 2: Implement the overlay shell**

Create `apps/web/components/onboarding/OnboardingOverlay.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { fadeIn, scaleIn, slideX, useMotionVariant } from "@/lib/motion";
import { StepUsername } from "./StepUsername";
import { StepBalance } from "./StepBalance";
import { StepMint } from "./StepMint";

type Step = "username" | "balance" | "mint";

export function OnboardingOverlay() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState<string>("");

  const backdrop = useMotionVariant(fadeIn);
  const panel = useMotionVariant(scaleIn);
  const slide = useMotionVariant(slideX);

  const onComplete = useCallback(() => {
    // Force the layout's server-side state to refresh. After this refetch
    // onboarded_at is set and the overlay won't render again.
    router.refresh();
  }, [router]);

  return (
    <motion.div
      initial={backdrop.initial}
      animate={backdrop.animate}
      exit={backdrop.exit}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="First-time onboarding"
    >
      <motion.div
        initial={panel.initial}
        animate={panel.animate}
        className="card relative w-full max-w-md overflow-hidden"
      >
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="eyebrow">Welcome</div>
          <div className="mt-1 text-[13px] text-muted">
            Three quick steps · {step === "username" ? "1" : step === "balance" ? "2" : "3"} of 3
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "username" && (
            <motion.div
              key="username"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepUsername
                onNext={(u) => {
                  setUsername(u);
                  setStep("balance");
                }}
              />
            </motion.div>
          )}
          {step === "balance" && (
            <motion.div
              key="balance"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepBalance onNext={() => setStep("mint")} />
            </motion.div>
          )}
          {step === "mint" && (
            <motion.div
              key="mint"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepMint username={username} onComplete={onComplete} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Verify in browser**

Reset your user (`update users set onboarded_at = null where ...`), reload `/dashboard`. Confirm overlay renders with Step 1 stub visible and animated entrance.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/onboarding apps/web/app/\(app\)/onboarding-state.ts apps/web/app/\(app\)/layout.tsx
git commit -m "Render OnboardingOverlay for first-time users"
```

---

## Task 10: StepUsername (full implementation)

**Files:**
- Modify: `apps/web/components/onboarding/StepUsername.tsx`

- [ ] **Step 1: Implement Step 1**

Replace `apps/web/components/onboarding/StepUsername.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function StepUsername({ onNext }: { onNext: (username: string) => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const u = value.trim().toLowerCase();
    if (u.length === 0) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/onboarding/username-available?u=${encodeURIComponent(u)}`,
          { cache: "no-store" },
        );
        const data = (await r.json()) as { available: boolean; reason?: string };
        if (!r.ok) {
          setStatus("invalid");
          return;
        }
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("invalid");
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const canContinue = status === "available";

  return (
    <form
      className="p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onNext(value.trim().toLowerCase());
      }}
    >
      <h2 className="text-[18px] font-semibold tracking-tight">Pick a username</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        3–20 characters · lowercase, numbers, underscore. Public-facing.
      </p>

      <label htmlFor="username" className="mt-5 block text-[12px] text-subtle">
        Username
      </label>
      <input
        id="username"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s+/g, ""))}
        placeholder="alice_42"
        className="input focus-ring mt-1.5"
      />

      <div className="mt-2 h-4 text-[11.5px]">
        {status === "checking" && <span className="text-faint">Checking…</span>}
        {status === "invalid" && (
          <span className="text-rose-300">3–20 chars · a-z, 0-9, underscore</span>
        )}
        {status === "taken" && <span className="text-rose-300">That username is taken</span>}
        {status === "available" && <span className="text-emerald-300">Available</span>}
      </div>

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={!canContinue} className="btn btn-primary focus-ring">
          Continue
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Manual verification**

Reset user, reload, type usernames. Confirm: too-short shows red, valid+free shows green and enables Continue, valid+taken (use a username you already used in Task 5 testing) shows red.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/StepUsername.tsx
git commit -m "Implement onboarding Step 1 (username)"
```

---

## Task 11: StepBalance with polling

**Files:**
- Modify: `apps/web/components/onboarding/StepBalance.tsx`

- [ ] **Step 1: Implement Step 2**

Replace `apps/web/components/onboarding/StepBalance.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { avalancheFuji } from "thirdweb/chains";
import { useActiveAccount, useWalletBalance } from "thirdweb/react";

import { getThirdwebClient } from "@/lib/thirdwebClient";

const MIN_AVAX = 0.1;
const FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

export function StepBalance({ onNext }: { onNext: () => void }) {
  const account = useActiveAccount();
  const client = getThirdwebClient();
  const balanceQuery = useWalletBalance({
    client: client!,
    address: account?.address,
    chain: avalancheFuji,
  });

  const balanceFloat = useMemo(() => {
    if (!balanceQuery.data) return null;
    const v = parseFloat(balanceQuery.data.displayValue);
    return Number.isFinite(v) ? v : null;
  }, [balanceQuery.data]);

  const isFunded = balanceFloat !== null && balanceFloat >= MIN_AVAX;

  // Auto-advance once funded.
  useEffect(() => {
    if (isFunded) {
      const t = setTimeout(onNext, 600); // small breath so the user sees the tick
      return () => clearTimeout(t);
    }
  }, [isFunded, onNext]);

  // Poll while underfunded.
  useEffect(() => {
    if (isFunded || !account?.address) return;
    const id = setInterval(() => {
      balanceQuery.refetch();
    }, 5000);
    return () => clearInterval(id);
  }, [isFunded, account?.address, balanceQuery]);

  const [copied, setCopied] = useState(false);
  function copy() {
    if (!account?.address) return;
    navigator.clipboard.writeText(account.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  if (!account?.address) {
    return <div className="p-6 text-[13px] text-muted">Reconnect your wallet to continue.</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-[18px] font-semibold tracking-tight">
        {isFunded ? "Wallet funded" : "Fund your wallet"}
      </h2>
      <p className="mt-1 text-[12.5px] text-muted">
        {isFunded
          ? "You have enough Fuji AVAX to mint. Continuing in a moment…"
          : `You need at least ${MIN_AVAX} AVAX on Fuji to mint your first agent.`}
      </p>

      {!isFunded && (
        <>
          <div className="mt-5 flex items-center justify-center rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <QRCodeSVG
              value={account.address}
              size={140}
              bgColor="transparent"
              fgColor="#e5e7eb"
              level="M"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3 py-2">
            <span className="truncate font-mono text-[11.5px] text-muted">{account.address}</span>
            <button onClick={copy} className="ml-auto btn btn-secondary text-[11px] py-1 px-2">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[12px]">
            <span className="text-faint">
              Balance:{" "}
              <span className="font-mono text-muted">
                {balanceQuery.data
                  ? `${balanceQuery.data.displayValue} ${balanceQuery.data.symbol}`
                  : "—"}
              </span>
            </span>
            <button
              onClick={() => balanceQuery.refetch()}
              className="btn btn-secondary text-[11px] py-1 px-2"
            >
              Check now
            </button>
          </div>

          <p className="mt-4 text-[11.5px] text-faint">
            Need test AVAX?{" "}
            <a
              className="underline decoration-dotted underline-offset-2 hover:text-muted"
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
            >
              Avalanche Fuji faucet
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Reset onboarding, log in with an empty wallet. Step 2 should show QR + address + 5s polling. Send Fuji AVAX from another wallet/faucet; the step should auto-advance once balance ≥ 0.1.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/StepBalance.tsx
git commit -m "Implement onboarding Step 2 (balance gate)"
```

---

## Task 12: StepMint (real mint + complete API call)

**Files:**
- Modify: `apps/web/components/onboarding/StepMint.tsx`

- [ ] **Step 1: Implement Step 3**

Replace `apps/web/components/onboarding/StepMint.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useMintPassport } from "@/hooks/useMintPassport";
import { getThirdwebClient } from "@/lib/thirdwebClient";

export function StepMint({
  username,
  onComplete,
}: {
  username: string;
  onComplete: () => void;
}) {
  const client = getThirdwebClient();
  const defaultLabel = `${username}-agent-1`;
  const [label, setLabel] = useState(defaultLabel);
  const [persistError, setPersistError] = useState<string | null>(null);

  const mintHook = useMintPassport(client!);
  const { phase, message } = mintHook.state;

  const isWorking =
    phase === "generating" || phase === "deploying" || phase === "minting" || phase === "confirming";

  const phaseLabel: Record<typeof phase, string> = {
    idle: "Mint passport",
    generating: "Generating keypair…",
    deploying: "Deploying contract…",
    minting: "Minting passport…",
    confirming: "Awaiting confirmation…",
    done: "Saving…",
    error: "Mint passport",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPersistError(null);
    try {
      await mintHook.mint(label.trim() || defaultLabel);
      const r = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "complete_failed");
      }
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not finish onboarding. Please try again.";
      setPersistError(msg);
    }
  }

  return (
    <form className="p-6" onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-semibold tracking-tight">Create your first agent</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Generates a fresh agent EOA in your browser, then mints a passport on Avalanche Fuji.
      </p>

      <label htmlFor="label" className="mt-5 block text-[12px] text-subtle">
        Agent name
      </label>
      <input
        id="label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="input focus-ring mt-1.5"
        disabled={isWorking}
      />

      <div className="mt-2 h-4 text-[11.5px] text-muted">
        {message ? message : "Single-tap mint. Costs a fraction of a cent in test AVAX."}
      </div>

      {(phase === "error" || persistError) && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
          {persistError ?? message}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button type="submit" disabled={isWorking} className="btn btn-primary focus-ring">
          {isWorking ? phaseLabel[phase] : phase === "error" ? "Retry" : "Mint passport"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Manual verification**

End-to-end: reset user, fund wallet, complete the wizard. Confirm the dashboard shows the new agent and the overlay does not re-render after refresh.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/StepMint.tsx
git commit -m "Implement onboarding Step 3 (mint + complete)"
```

---

## Task 13: Page transition template

**Files:**
- Create: `apps/web/app/(app)/template.tsx`

- [ ] **Step 1: Create the template**

Create `apps/web/app/(app)/template.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { fadeIn, useMotionVariant } from "@/lib/motion";

export default function AppTemplate({ children }: { children: ReactNode }) {
  const v = useMotionVariant(fadeIn);
  return (
    <motion.div initial={v.initial} animate={v.animate}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate between `/dashboard` and an agent run page; observe a subtle fade.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/template.tsx
git commit -m "Fade page transitions inside (app) group"
```

---

## Task 14: Animate AgentCard

**Files:**
- Modify: `apps/web/components/agents/AgentCard.tsx`
- Modify: `apps/web/app/(app)/dashboard/page.tsx` (the grid that renders cards)

- [ ] **Step 1: Wrap AgentCard in motion.div**

In `apps/web/components/agents/AgentCard.tsx`, change the outermost container:

```tsx
// imports
import { motion } from "framer-motion";
import { fadeUp, useMotionVariant } from "@/lib/motion";
```

Change:

```tsx
return (
  <div className="card card-hover group w-full min-w-0 max-w-full overflow-hidden p-4">
```

to:

```tsx
const cardVariant = useMotionVariant(fadeUp);
return (
  <motion.div
    variants={cardVariant}
    whileHover={{ y: -2, scale: 1.01 }}
    transition={{ type: "spring", stiffness: 280, damping: 24 }}
    className="card card-hover group w-full min-w-0 max-w-full overflow-hidden p-4"
  >
```

Close with `</motion.div>` instead of `</div>`.

- [ ] **Step 2: Stagger from the parent grid**

In `apps/web/app/(app)/dashboard/page.tsx`, replace the `MonitorTab` cards grid:

```tsx
<div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
  {onChainRows.map((row) => (
    <AgentCard ... />
  ))}
</div>
```

with:

```tsx
<motion.div
  initial="initial"
  animate="animate"
  variants={stagger}
  className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]"
>
  {onChainRows.map((row) => (
    <AgentCard ... />
  ))}
</motion.div>
```

Add at the top of the file:

```tsx
import { motion } from "framer-motion";
import { stagger } from "@/lib/motion";
```

- [ ] **Step 3: Manual verification**

Reload `/dashboard`. Cards stagger in; hovering lifts each one a couple of pixels.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/agents/AgentCard.tsx apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "Animate AgentCard entrance and hover"
```

---

## Task 15: Animate dashboard tab swaps + Notice

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Wrap tab content in `AnimatePresence`**

In `apps/web/app/(app)/dashboard/page.tsx`, replace the `{activeTab === "monitor" && ...} {activeTab === "create" && ...} {activeTab === "profile" && ...}` block with:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={tabVariant.initial}
    animate={tabVariant.animate}
    exit={tabVariant.exit}
  >
    {activeTab === "monitor" && (
      <MonitorTab
        onChainRows={onChainRows}
        walletAddress={walletAddress}
        onCreate={() => setActiveTab("create")}
        hasContract={true}
      />
    )}
    {activeTab === "create" && (
      <CreateTab
        walletAddress={walletAddress}
        agentLabel={agentLabel}
        setAgentLabel={setAgentLabel}
        onSubmit={handleCreateAgent}
        createState={mintHook.state}
        hasContract={true}
        createdAgents={createdAgents}
        contractAddress={mintHook.contractAddress}
      />
    )}
    {activeTab === "profile" && (
      <ProfileTab ... />
    )}
  </motion.div>
</AnimatePresence>
```

Add at the top:

```tsx
import { AnimatePresence } from "framer-motion";
import { fadeUp, useMotionVariant } from "@/lib/motion";
// inside DashboardShell:
const tabVariant = useMotionVariant(fadeUp);
```

- [ ] **Step 2: Animate `Notice`**

Wrap the existing `<Notice>` rendering in `CreateTab` with `<AnimatePresence>`:

```tsx
<AnimatePresence>
  {mintHook.state.message && (
    <motion.div
      key={mintHook.state.message}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <Notice tone={showError ? "error" : "success"} className="mt-5">
        {mintHook.state.message}
      </Notice>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Typecheck + manual verification**

Run: `pnpm --filter web typecheck`
Expected: PASS. Switch tabs, observe the cross-fade. Trigger an error on Create, see the Notice slide in.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "Animate dashboard tab transitions and Notice toasts"
```

---

## Task 16: Animate run page timeline entries

**Files:**
- Modify: `apps/web/app/(app)/agents/[id]/run/page.tsx`

- [ ] **Step 1: Identify the timeline list**

Open `apps/web/app/(app)/agents/[id]/run/page.tsx` and find the list/grid that renders run-status entries (look for `.map(` rendering steps or actions).

- [ ] **Step 2: Wrap the list in stagger + each item in `motion.div`**

At the top:

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, stagger, useMotionVariant } from "@/lib/motion";
```

Inside the component, add:

```tsx
const itemVariant = useMotionVariant(fadeUp);
```

Replace the list container with `motion.ul` (or `motion.div`) using `variants={stagger} initial="initial" animate="animate"`. Replace each item with `<motion.li variants={itemVariant}>` (or `motion.div`).

If the list mutates (items added during a run), wrap in `<AnimatePresence initial={false}>`.

- [ ] **Step 3: Manual verification**

Run a task, watch entries appear with stagger.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/agents/\[id\]/run/page.tsx
git commit -m "Animate run page timeline entries"
```

---

## Task 17: Reduced-motion + final smoke test

**Files:** none (verification only)

- [ ] **Step 1: Reduced-motion**

In macOS System Settings → Accessibility → Display → enable "Reduce motion". Reload `/dashboard`. Confirm cards/tabs/overlay still appear (opacity-only) but no `y` / `scale` / `slide` motion.

- [ ] **Step 2: Full happy path**

1. Reset your user (`update users set username = null, onboarded_at = null where ...`).
2. Log in with a fresh wallet.
3. Go through wizard end-to-end: pick username → fund wallet (if needed) → mint.
4. Confirm: agent visible on dashboard, overlay does not return on refresh.
5. Disconnect, reconnect — overlay does not appear.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm --filter web typecheck && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 4: Optional final commit**

If any tweaks were made during smoke testing:

```bash
git add -A
git commit -m "Smoke test polish"
```

---

## Summary Checklist

- [ ] Schema migration applied (`username`, `onboarded_at`)
- [ ] Framer Motion installed + `motion.ts` shared module
- [ ] `/api/auth/sync` returns `needsOnboarding`
- [ ] `/api/onboarding/username-available` works
- [ ] `/api/onboarding/complete` writes username + onboarded_at
- [ ] `useMintPassport` hook extracted
- [ ] Dashboard Create tab uses the hook
- [ ] OnboardingOverlay shell + 3 steps
- [ ] `(app)/layout.tsx` gates onboarding overlay
- [ ] Page transitions, AgentCard, tabs, Notice, run page all animated
- [ ] Reduced-motion respected
- [ ] End-to-end happy path verified
