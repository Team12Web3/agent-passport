# Dashboard ↔ Backend Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-26-dashboard-backend-integration-design.md`

**Goal:** Replace the dashboard's client-side mint flow with calls to person 1's `/api/agents/*` backend, drop localStorage agent keys, and surface real backend data (purpose, tools, actionCount) on the cards so navigation to `/agents/[id]/run` works end-to-end.

**Architecture:** Dashboard becomes a thin client over the backend. New `lib/api/agents.ts` wraps the three endpoints with typed errors. `useAuth` round-trips `/api/auth/status` so SIWE-cookie validity (not wallet status) gates the page. `AgentCard` is widened to take a `DashboardAgent` shape. `dashboard/page.tsx` is rewritten to wire it all together. Then dead files are deleted.

**Tech Stack:** Next.js 14 App Router, TypeScript, thirdweb SDK, Tailwind. No new deps. No automated tests (matches repo convention; spec calls for manual smoke tests).

---

## Pre-flight

- [ ] **Step 0.1: Confirm clean working tree on `main`**

```bash
git status
```

Expected: `working tree clean` (or only the spec files committed in commits `a706756` / `edc62e8`).

- [ ] **Step 0.2: Confirm dev server runs**

```bash
cd apps/web && pnpm dev
```

Expected: Next dev server starts on `http://localhost:3000`. Stop it (Ctrl-C) before continuing — we'll restart at the end for manual smoke.

- [ ] **Step 0.3: Confirm typecheck baseline**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors. (If the baseline already has errors, capture them — we must not regress past this baseline.)

---

## Task 1: Create `lib/api/agents.ts` wrapper

**Files:**
- Create: `apps/web/lib/api/agents.ts`

This is additive. Nothing else changes yet. After this task the module compiles but is unused.

- [ ] **Step 1.1: Create the file with types and error classes**

```ts
// apps/web/lib/api/agents.ts
"use client";

export type AgentTool = "scraper" | "summarizer" | "logger";

export type DashboardAgent = {
  agentId: string;
  name: string;
  purpose: string;
  tools: AgentTool[];
  passportId: string;
  walletAddress: `0x${string}`;
  actionCount: number;
  createdAt: string;
};

export type CreateAgentInput = {
  name: string;
  purpose: string;
  tools: AgentTool[];
};

export type CreateAgentResult = {
  agentId: string;
  passportId: string;
  walletAddress: `0x${string}`;
  fundingTxHash: `0x${string}`;
  mintTxHash: `0x${string}`;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, code: string | undefined, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

- [ ] **Step 1.2: Append the request helper**

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (res.status === 401) throw new UnauthorizedError();

  if (!res.ok) {
    let body: { error?: string; details?: unknown; step?: string } = {};
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    const code = body.error ?? `http_${res.status}`;
    const details = body.step ? { ...((body.details as object) ?? {}), step: body.step } : body.details;
    throw new ApiError(res.status, code, code, details);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 1.3: Append the two endpoint functions**

```ts
export async function listAgents(): Promise<DashboardAgent[]> {
  const data = await request<{ agents: DashboardAgent[] }>("/api/agents/list");
  return data.agents;
}

export async function createAgent(input: CreateAgentInput): Promise<CreateAgentResult> {
  return request<CreateAgentResult>("/api/agents/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 1.4: Verify it typechecks**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 new errors.

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/lib/api/agents.ts
git commit -m "feat(web): add lib/api/agents.ts wrapper for backend agent endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Upgrade `useAuth` to round-trip `/api/auth/status`

**Files:**
- Modify: `apps/web/hooks/useAuth.ts`

Today the hook is wallet-only. It must also reflect SIWE-cookie validity so the dashboard doesn't fire API calls that 401 silently. The `/api/auth/status` endpoint returns `{ loggedIn: boolean, address: string | null }` (verified at `apps/web/app/api/auth/status/route.ts`).

**Compatibility check:** The login form currently consumes `useAuth`. Reread it before editing.

- [ ] **Step 2.1: Audit current callers**

```bash
cd /Users/andre/dev/agent-passport
grep -rn "useAuth" apps/web --include="*.ts" --include="*.tsx"
```

Expected: only `apps/web/hooks/useAuth.ts` (definition) plus, at most, `apps/web/app/login/LoginForm.tsx`. Note any other call site — its expectations must be preserved.

- [ ] **Step 2.2: Read each caller**

For every file from 2.1 (other than the definition), open it and note which keys of the returned object it uses (`isLoggedIn`, `isLoading`, `user`, `address`). The new shape must keep all currently-used keys.

- [ ] **Step 2.3: Replace the hook implementation**

```ts
// apps/web/hooks/useAuth.ts
"use client";

import { useEffect, useState } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";

type ServerState = "loading" | "ok" | "anon";

export function useAuth() {
  const account = useActiveAccount();
  const wallet  = useActiveWallet();
  const [serverState, setServerState] = useState<ServerState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { loggedIn: false }))
      .then((j: { loggedIn?: boolean }) => {
        if (!cancelled) setServerState(j.loggedIn ? "ok" : "anon");
      })
      .catch(() => { if (!cancelled) setServerState("anon"); });
    return () => { cancelled = true; };
  }, []);

  const isWalletPresent = !!account;

  return {
    user: account ?? null,
    address: account?.address as `0x${string}` | undefined,
    isLoggedIn: serverState === "ok",
    isLoading: serverState === "loading" || (!account && !!wallet),
    isAuthenticated: serverState === "ok",
    isWalletConnected: isWalletPresent,
  };
}
```

- [ ] **Step 2.4: Verify each caller from 2.2 still compiles**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 new errors. (The new shape is a superset; old keys `isLoggedIn`, `isLoading`, `user`, `address` are preserved.)

- [ ] **Step 2.5: Manual login-form smoke**

Run `pnpm dev`, open `http://localhost:3000/login`, confirm the form behaves the same as before (gates redirect on session, not wallet — matches commit `7ed7f52`). Then stop the dev server.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/hooks/useAuth.ts
git commit -m "feat(web): useAuth now reflects SIWE session, not just wallet

Round-trips /api/auth/status so dashboard auth gating matches what
the API routes actually require. Existing keys (user, address,
isLoggedIn, isLoading) preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Widen `AgentCard` to take `DashboardAgent`

**Files:**
- Modify: `apps/web/components/agents/AgentCard.tsx` (full rewrite)

Old props (`agentId`, `passport`, `trusted`, `progressPercent`, `sourceLabel`) are dropped. Click target stays a `Link` to `/agents/${agent.agentId}/run` — but `agentId` is now a real Supabase UUID.

- [ ] **Step 3.1: Replace the file**

```tsx
"use client";

import Link from "next/link";
import type { DashboardAgent } from "@/lib/api/agents";
import { shortenAddress } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";

type Props = { agent: DashboardAgent };

export function AgentCard({ agent }: Props) {
  const seed = agent.walletAddress || agent.agentId;
  const avatar = avatarStyle(seed);
  const initials = avatarInitials(seed);
  const actionLabel = `${agent.actionCount} action${agent.actionCount === 1 ? "" : "s"}`;

  return (
    <Link
      href={`/agents/${agent.agentId}/run`}
      className="card card-hover group block w-full min-w-0 max-w-full overflow-hidden p-4 focus-ring rounded-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white/95 font-mono"
          style={avatar}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-fg leading-tight">{agent.name}</div>
          <div className="mt-1 font-mono text-[11px] text-faint truncate">
            {shortenAddress(agent.walletAddress, 5, 4)}
          </div>
        </div>
        <span aria-hidden className="text-faint transition group-hover:text-muted">→</span>
      </div>

      {/* Purpose, line-clamped to 2 */}
      <p
        className="mt-3 text-[12.5px] text-muted"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {agent.purpose}
      </p>

      {/* Tools */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.tools.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.08em] text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-[11.5px] text-faint">
        <span className="font-mono">#{agent.passportId || "—"}</span>
        <span>{actionLabel}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3.2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: errors only in `app/(app)/dashboard/page.tsx` (it still passes the old props). That's intentional — Task 4 fixes it.

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/components/agents/AgentCard.tsx
git commit -m "refactor(web): widen AgentCard to consume DashboardAgent shape

Drops the synthetic progressPercent/sourceLabel/trusted display in
favor of real backend data: purpose, tool chips, actionCount. Link
target unchanged but now receives a real Supabase UUID.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Rewrite `app/(app)/dashboard/page.tsx`

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx` (full rewrite, ~900 → ~400 lines)

The shell becomes: `useAuth` gate → `listAgents()` on mount → render `Monitor | Create | Profile`.

Sub-tasks are split for reviewability — keep small and commit each.

### 4a. Skeleton + auth gate

- [ ] **Step 4a.1: Replace the file with a minimal authenticated shell**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { avalancheFuji } from "thirdweb/chains";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
  useDisconnect,
  useProfiles,
  useWalletBalance,
} from "thirdweb/react";
import { AgentCard } from "@/components/agents/AgentCard";
import { useAuth } from "@/hooks/useAuth";
import {
  ApiError,
  UnauthorizedError,
  createAgent,
  listAgents,
  type AgentTool,
  type CreateAgentResult,
  type DashboardAgent,
} from "@/lib/api/agents";
import { shortenAddress } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { getThirdwebClient } from "@/lib/thirdwebClient";

const ALL_TOOLS: AgentTool[] = ["scraper", "summarizer", "logger"];
const DEFAULT_PURPOSE = "General-purpose agent";
const FUJI_FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

export default function DashboardPage() {
  const client = getThirdwebClient();
  if (!client) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-24">
          <div className="card p-6 text-sm text-amber-200">
            Missing <span className="font-mono">NEXT_PUBLIC_TW_CLIENT_ID</span>. Add it to{" "}
            <span className="font-mono">.env.local</span> and restart{" "}
            <span className="font-mono">pnpm dev</span>.
          </div>
        </div>
      </main>
    );
  }
  return <DashboardShell />;
}

function DashboardShell() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const account = useActiveAccount();
  const wallet  = useActiveWallet();
  const chain   = useActiveWalletChain();
  const { disconnect } = useDisconnect();

  const [agents,  setAgents]  = useState<DashboardAgent[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab,     setTab]     = useState<"monitor" | "create" | "profile">("monitor");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  const refresh = useCallback(async () => {
    try {
      setAgents(await listAgents());
      setLoadErr(null);
    } catch (e) {
      if (e instanceof UnauthorizedError) { router.replace("/login"); return; }
      setLoadErr(e instanceof Error ? e.message : "Failed to load agents.");
    }
  }, [router]);

  useEffect(() => { if (isAuthenticated) refresh(); }, [isAuthenticated, refresh]);

  async function handleLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    if (wallet) disconnect(wallet);
    router.replace("/login");
  }

  if (authLoading) return <FullPageMessage>Connecting…</FullPageMessage>;
  if (!isAuthenticated) return <FullPageMessage>Redirecting to login…</FullPageMessage>;

  const walletAddress = account?.address ?? "";
  const onFuji = chain?.id === avalancheFuji.id;
  const ownerAvatar = walletAddress ? avatarStyle(walletAddress) : undefined;

  return (
    <main className="min-h-screen">
      <Header
        walletAddress={walletAddress}
        ownerAvatarStyle={ownerAvatar}
        ownerInitials={walletAddress ? avatarInitials(walletAddress) : "·"}
        onFuji={onFuji}
        chainName={chain?.name}
        onProfile={() => setTab("profile")}
        onLogout={handleLogout}
      />

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 pb-24">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="mt-2 text-[26px] md:text-[30px] font-semibold tracking-[-0.02em]">Agent Passport</h1>
          <p className="mt-2 text-[14px] text-muted">
            Mint on-chain identities for AI agents and watch their reputation evolve on Avalanche Fuji.
          </p>
        </div>

        <Tabs
          tabs={[
            { id: "monitor", label: "Monitor" },
            { id: "create",  label: "Create" },
            { id: "profile", label: "Profile" },
          ]}
          active={tab}
          onSelect={(t) => setTab(t as typeof tab)}
          rightSlot={
            loadErr ? (
              <span className="chip" style={{ borderColor: "rgba(251,113,133,0.35)", color: "#fda4af" }}>
                <span className="chip-dot" style={{ backgroundColor: "#fb7185" }} />
                {loadErr}
              </span>
            ) : null
          }
        />

        {tab === "monitor" && <MonitorTab agents={agents} onCreate={() => setTab("create")} />}
        {tab === "create"  && <CreateTab onCreated={async () => { await refresh(); setTab("monitor"); }} />}
        {tab === "profile" && <ProfileTab agents={agents} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 4a.2: Add the placeholder tab + atom components at the bottom of the file**

Append (still inside the same file):

```tsx
function MonitorTab({ agents, onCreate }: { agents: DashboardAgent[]; onCreate: () => void }) {
  return (
    <div className="mt-8">
      <Section
        eyebrow="Your agents"
        title={agents.length === 0 ? "No agents yet" : `${agents.length} agent${agents.length === 1 ? "" : "s"}`}
        subtitle={agents.length === 0 ? "Mint a passport to spin up your first backend-managed agent." : undefined}
        action={
          <button onClick={onCreate} className="btn btn-primary focus-ring">
            {agents.length === 0 ? "Create your first agent" : "New agent"}
          </button>
        }
      >
        {agents.length > 0 ? (
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {agents.map((a) => <AgentCard key={a.agentId} agent={a} />)}
          </div>
        ) : (
          <EmptyState />
        )}
      </Section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-4 text-[14px] text-fg font-medium">Mint your first passport</div>
      <div className="mt-1 text-[12.5px] text-muted">
        The platform funds a fresh agent wallet and binds it to your owner address on Avalanche Fuji.
      </div>
    </div>
  );
}

function CreateTab({ onCreated }: { onCreated: () => Promise<void> | void }) {
  return <div className="mt-8 card p-6 text-[13px] text-muted">Create form lands in step 4b.</div>;
}

function ProfileTab({ agents }: { agents: DashboardAgent[] }) {
  return <div className="mt-8 card p-6 text-[13px] text-muted">Profile lands in step 4c.</div>;
}

// ───── Atoms (carried over from previous dashboard) ─────

function Header({
  walletAddress, ownerAvatarStyle, ownerInitials, onFuji, chainName, onProfile, onLogout,
}: {
  walletAddress: string;
  ownerAvatarStyle: ReturnType<typeof avatarStyle> | undefined;
  ownerInitials: string;
  onFuji: boolean;
  chainName: string | undefined;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const networkLabel = onFuji ? "Avalanche Fuji" : chainName || "Wrong network";
  const networkDot   = onFuji ? "#34d399" : "#fbbf24";
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(7,8,10,0.72)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <div
            className="h-6 w-6 rounded-md"
            style={{
              background: "conic-gradient(from 210deg, #34d399, #38bdf8, #a78bfa, #34d399)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
            }}
            aria-hidden
          />
          <span className="text-[13.5px] font-medium tracking-tight">Agent Passport</span>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4">
          <span className="chip">
            <span className="chip-dot" style={{ backgroundColor: networkDot }} />
            {networkLabel}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onProfile} className="btn btn-ghost focus-ring">
            {ownerAvatarStyle && (
              <span
                className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-semibold text-white/95 font-mono"
                style={ownerAvatarStyle}
              >
                {ownerInitials}
              </span>
            )}
            <span className="hidden sm:inline font-mono text-[12px]">
              {walletAddress ? shortenAddress(walletAddress) : "—"}
            </span>
          </button>
          <button onClick={onLogout} className="btn btn-secondary focus-ring text-[12px]">
            Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}

function Tabs({
  tabs, active, onSelect, rightSlot,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="mt-10 flex items-end justify-between gap-3 border-b border-white/[0.06]">
      <nav className="flex items-end gap-6">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="relative pb-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-sm"
            >
              <span className={isActive ? "text-fg" : "text-muted hover:text-fg transition-colors"}>{t.label}</span>
              {isActive && <span className="absolute left-0 right-0 -bottom-px h-px bg-accent" aria-hidden />}
            </button>
          );
        })}
      </nav>
      {rightSlot && <div className="pb-2">{rightSlot}</div>}
    </div>
  );
}

function Section({
  eyebrow, title, subtitle, action, children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Notice({
  tone, children, className,
}: {
  tone: "success" | "error";
  children: ReactNode;
  className?: string;
}) {
  const styles = tone === "success"
    ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200"
    : "border-rose-400/25 bg-rose-400/[0.06] text-rose-200";
  return (
    <div className={["rounded-lg border px-3 py-2 text-[12.5px]", styles, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin"
    />
  );
}

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-32 text-center text-muted text-[13px]">{children}</div>
    </main>
  );
}
```

- [ ] **Step 4a.3: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors. (`useProfiles`, `useWalletBalance`, `Notice`, `Spinner`, `useMemo`, `useState`, `FormEvent`, `CreateAgentResult`, `ApiError`, `ALL_TOOLS`, `DEFAULT_PURPOSE`, `FUJI_FAUCET_URL`, `getThirdwebClient` may be unused-warning level depending on ESLint config; if they error, prefix imports with `// eslint-disable-next-line` or remove the unused ones in this step. The remaining names are used in 4b/4c.)

If `pnpm typecheck` errors on unused imports specifically, drop them now; we'll re-add them in 4b/4c.

- [ ] **Step 4a.4: Browser smoke**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/dashboard`:
- Logged out → redirect to `/login`. ✓
- Logged in, zero agents → empty state with "Create your first agent" CTA. ✓
- Click "Create" tab → placeholder card. ✓
- Click "Profile" tab → placeholder card. ✓

Stop dev server.

- [ ] **Step 4a.5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "feat(web): dashboard skeleton wired to /api/agents/list

Replaces client-side on-chain hydration with backend list call. Auth
gating now goes through useAuth (which round-trips /api/auth/status).
Create and Profile tabs are placeholders filled in next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### 4b. Create form

- [ ] **Step 4b.1: Replace the `CreateTab` placeholder with the real form**

Find the existing `function CreateTab(...)` placeholder and replace it with:

```tsx
type CreateState = {
  loading: boolean;
  ok?: boolean;
  message?: string;
  fieldErrors?: { name?: string; purpose?: string; tools?: string };
  lastCreated?: CreateAgentResult;
};

const PROVISION_MESSAGES: Record<string, string> = {
  wallet:  "Couldn't generate a fresh agent wallet. Try again.",
  funding: "Couldn't fund the agent wallet — platform may be out of test AVAX. Try again shortly.",
  mint:    "Mint transaction failed on-chain. Try again.",
};

function parseValidationDetails(details: unknown): CreateState["fieldErrors"] {
  // Backend returns Zod's flatten() shape: { fieldErrors: { name?: string[], ... } }
  const fe = (details as { fieldErrors?: Record<string, string[]> })?.fieldErrors;
  if (!fe) return undefined;
  return {
    name:    fe.name?.[0],
    purpose: fe.purpose?.[0],
    tools:   fe.tools?.[0],
  };
}

function CreateTab({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [name, setName]       = useState("");
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [tools, setTools]     = useState<AgentTool[]>(ALL_TOOLS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [state, setState] = useState<CreateState>({ loading: false });

  function toggleTool(t: AgentTool) {
    setTools((prev) => {
      const has = prev.includes(t);
      if (has) {
        // Don't let the user uncheck the last one
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== t);
      }
      return [...prev, t];
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.loading) return;

    // Client-side guards mirror the backend Zod schema
    const trimmedName = name.trim();
    const trimmedPurpose = purpose.trim() || DEFAULT_PURPOSE;
    const fieldErrors: CreateState["fieldErrors"] = {};
    if (!trimmedName || trimmedName.length > 40) fieldErrors.name = "Name must be 1–40 characters.";
    if (trimmedPurpose.length < 1 || trimmedPurpose.length > 200) fieldErrors.purpose = "Purpose must be 1–200 characters.";
    if (tools.length === 0) fieldErrors.tools = "Pick at least one tool.";
    if (Object.values(fieldErrors).some(Boolean)) {
      setState({ loading: false, ok: false, fieldErrors });
      return;
    }

    setState({ loading: true });
    try {
      const result = await createAgent({ name: trimmedName, purpose: trimmedPurpose, tools });
      setState({ loading: false, ok: true, lastCreated: result });
      await onCreated();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        // Top-level dashboard effect handles redirect via refresh; surface a hint.
        setState({ loading: false, ok: false, message: "Session expired. Reloading…" });
        setTimeout(() => window.location.assign("/login"), 600);
        return;
      }
      if (e instanceof ApiError && e.status === 400) {
        setState({ loading: false, ok: false, fieldErrors: parseValidationDetails(e.details) ?? {}, message: "Please fix the highlighted fields." });
        return;
      }
      if (e instanceof ApiError && e.status === 502) {
        const step = (e.details as { step?: string })?.step ?? "unknown";
        setState({ loading: false, ok: false, message: PROVISION_MESSAGES[step] ?? "Provisioning failed. Try again." });
        return;
      }
      setState({ loading: false, ok: false, message: e instanceof Error ? e.message : "Couldn't create agent. Try again." });
    }
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-1">
      <div className="card p-6">
        <div className="eyebrow">Mint</div>
        <h2 className="mt-2 text-[18px] font-semibold tracking-tight">Create agent passport</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          The platform provisions a fresh agent wallet, funds it with test AVAX + USDC on Fuji, and mints an on-chain passport bound to your account.
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="agentName" className="block text-[12px] text-subtle mb-1.5">Name</label>
            <input
              id="agentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="research-agent"
              maxLength={40}
              className="input focus-ring"
              required
            />
            {state.fieldErrors?.name && (
              <p className="mt-1.5 text-[11.5px] text-rose-300">{state.fieldErrors.name}</p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-[12px] text-muted hover:text-fg transition-colors"
            >
              {advancedOpen ? "▾ Advanced" : "▸ Advanced"}
            </button>

            {advancedOpen && (
              <div className="mt-3 space-y-4 rounded-lg border border-white/[0.06] bg-black/20 p-4">
                <div>
                  <label htmlFor="agentPurpose" className="block text-[12px] text-subtle mb-1.5">Purpose</label>
                  <textarea
                    id="agentPurpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    maxLength={200}
                    className="input focus-ring"
                  />
                  <p className="mt-1 text-[11px] text-faint">Shown on the agent card. 1–200 characters.</p>
                  {state.fieldErrors?.purpose && (
                    <p className="mt-1 text-[11.5px] text-rose-300">{state.fieldErrors.purpose}</p>
                  )}
                </div>

                <div>
                  <span className="block text-[12px] text-subtle mb-1.5">Tools</span>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TOOLS.map((t) => {
                      const checked = tools.includes(t);
                      return (
                        <label
                          key={t}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] cursor-pointer transition",
                            checked
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                              : "border-white/[0.08] bg-white/[0.02] text-muted hover:border-white/15 hover:text-fg",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleTool(t)}
                          />
                          {t}
                        </label>
                      );
                    })}
                  </div>
                  {state.fieldErrors?.tools && (
                    <p className="mt-1 text-[11.5px] text-rose-300">{state.fieldErrors.tools}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={state.loading} className="btn btn-primary focus-ring">
              {state.loading ? <Spinner /> : null}
              {state.loading ? "Working…" : "Create agent"}
            </button>
            <a
              href={FUJI_FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-faint underline decoration-dotted underline-offset-2 hover:text-muted"
            >
              Fuji faucet
            </a>
          </div>
        </form>

        {state.message && (
          <Notice tone={state.ok ? "success" : "error"} className="mt-5">
            {state.message}
          </Notice>
        )}

        {state.lastCreated && <LatestPassport result={state.lastCreated} />}
      </div>
    </div>
  );
}

function LatestPassport({ result }: { result: CreateAgentResult }) {
  const snowtrace = `https://testnet.snowtrace.io/tx/${result.mintTxHash}`;
  return (
    <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 text-[12.5px] text-emerald-100">
      <div className="font-medium">Passport #{result.passportId} minted.</div>
      <div className="mt-1 font-mono text-[11.5px] text-emerald-200/80 break-all">
        wallet · {result.walletAddress}
      </div>
      <a
        href={snowtrace}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[11.5px] underline decoration-dotted underline-offset-2 hover:text-emerald-50"
      >
        View mint tx on Snowtrace ↗
      </a>
    </div>
  );
}
```

- [ ] **Step 4b.2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4b.3: Browser smoke**

```bash
cd apps/web && pnpm dev
```

- Switch to Create tab → form renders, "Advanced ▸" disclosure works.
- Submit empty → inline "Name must be 1–40 characters." error, no network call (DevTools Network tab confirms).
- Submit valid name → spinner, then success notice with passport id and Snowtrace link, agent appears on Monitor tab. *(Requires backend env: `PLATFORM_PRIVATE_KEY`, `USDC_ADDRESS`, Supabase keys, etc. If your local env doesn't have these wired, this step verifies only the request fires and the UI renders the appropriate error shape — confirm DevTools sees the POST to `/api/agents/create`.)*

Stop dev server.

- [ ] **Step 4b.4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "feat(web): wire Create tab to /api/agents/create

Lean form (Name only) with Advanced disclosure for Purpose and Tools.
Surfaces Zod field errors inline and provisioning errors with
step-specific messages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### 4c. Profile tab

- [ ] **Step 4c.1: Replace `ProfileTab` placeholder with the real component**

Find the existing `function ProfileTab(...)` placeholder and replace it with:

```tsx
function ProfileTab({ agents }: { agents: DashboardAgent[] }) {
  const account = useActiveAccount();
  const chain   = useActiveWalletChain();
  const profilesQuery     = useProfiles({ client: getThirdwebClient()! });
  const walletBalanceQuery = useWalletBalance({
    client:  getThirdwebClient()!,
    address: account?.address,
    chain:   chain ?? avalancheFuji,
  });

  const linkedEmail = useMemo(() => {
    const profiles = profilesQuery.data;
    if (!profiles?.length) return null;
    const emailProfile = profiles.find((p) => p.type === "email");
    if (!emailProfile) return null;
    const details = (emailProfile as { details?: unknown }).details;
    if (details && typeof details === "object" && details !== null && "email" in details) {
      const email = (details as { email?: unknown }).email;
      return typeof email === "string" && email.length > 0 ? email : null;
    }
    return null;
  }, [profilesQuery.data]);

  const totalActions = useMemo(
    () => agents.reduce((n, a) => n + a.actionCount, 0),
    [agents],
  );

  const walletAddress = account?.address ?? "";
  const ownerAvatar   = walletAddress ? avatarStyle(walletAddress) : undefined;
  const ownerInitials = walletAddress ? avatarInitials(walletAddress) : "·";
  const balanceText   = walletBalanceQuery.data
    ? `${walletBalanceQuery.data.displayValue} ${walletBalanceQuery.data.symbol}`
    : null;

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <div className="card p-6 md:col-span-1">
        {ownerAvatar && (
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-[14px] font-semibold text-white/95 font-mono"
            style={ownerAvatar}
          >
            {ownerInitials}
          </div>
        )}
        <div className="mt-4 text-[15px] text-fg font-medium">Connected wallet</div>
        <div className="mt-1 font-mono text-[12px] text-muted break-all">{walletAddress || "—"}</div>
      </div>

      <div className="card p-6 md:col-span-2 grid gap-4 sm:grid-cols-2">
        <Field label="Linked email" value={linkedEmail || "—"} />
        <Field label="Active chain" value={chain ? `${chain.name} · ${chain.id}` : "—"} />
        <Field
          label="Wallet balance"
          value={walletBalanceQuery.isLoading ? "Loading…" : balanceText || "Unavailable"}
        />
        <Field label="Total actions" value={`${totalActions} across ${agents.length} agent${agents.length === 1 ? "" : "s"}`} />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className={["mt-1 text-[13px] text-fg break-all", mono ? "font-mono" : ""].join(" ")}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4c.2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4c.3: Browser smoke**

Switch to Profile tab. Verify wallet address, linked email (if any), chain name, balance, and total actions render. Stop dev server.

- [ ] **Step 4c.4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "feat(web): trim Profile tab to wallet info + total actions

Drops the Passport-contract field (now backend-owned) and adds a
Total actions summary computed from the agents list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Delete dead files

Verify no remaining imports, then delete.

- [ ] **Step 5.1: Confirm no callers remain**

```bash
cd /Users/andre/dev/agent-passport
grep -rn "agentKeys\|agentPassport\|AgentPassport.artifact\|fetchPassportsOf\|fetchPassportById\|parsePassportMintedFromLogs\|toDisplayPassport" apps/web --include="*.ts" --include="*.tsx" -l
```

Expected: only the three files we're about to delete (`apps/web/lib/agentKeys.ts`, `apps/web/lib/agentPassport.ts`, possibly the artifact JSON in plain text). If any other file still imports from them, **stop** and update it first — do not force the deletion.

- [ ] **Step 5.2: Delete the files**

```bash
git rm apps/web/lib/agentKeys.ts \
       apps/web/lib/agentPassport.ts \
       apps/web/lib/AgentPassport.artifact.json
```

- [ ] **Step 5.3: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5.4: Verify lint**

```bash
cd apps/web && pnpm lint
```

Expected: 0 new errors past the baseline. (If `next lint` reports pre-existing warnings, that's fine; do not introduce new ones.)

- [ ] **Step 5.5: Commit**

```bash
git commit -m "chore(web): drop client-side mint scaffolding

agentKeys.ts (localStorage agent keys), agentPassport.ts (on-chain
hydration helpers), and the AgentPassport bytecode artifact are no
longer used now that the dashboard mints via /api/agents/create.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: End-to-end smoke

These are the eight scenarios from the spec. Run each manually; check off only after observing the expected outcome.

- [ ] **Step 6.1: Start backend env + dev server**

Confirm `apps/web/.env.local` has the values listed in `docs/05-environment-setup.md`:
- `NEXT_PUBLIC_TW_CLIENT_ID` (or `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`)
- `THIRDWEB_SECRET_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `PLATFORM_PRIVATE_KEY` (funded with Fuji AVAX + USDC)
- `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) — needed for run flow

Then:

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 6.2: Logged-out redirect**

Open `http://localhost:3000/dashboard` in an incognito window. Expected: redirect to `/login`.

- [ ] **Step 6.3: Empty state**

Log in with a fresh wallet → land on `/dashboard` → Monitor tab shows "Create your first agent" CTA. ✓

- [ ] **Step 6.4: Create with name only**

Switch to Create. Type `research-agent`. Submit. Expected: success notice with passport id + Snowtrace link. Card appears on Monitor with `purpose = "General-purpose agent"` and all three tool chips. ✓

- [ ] **Step 6.5: Create with Advanced fields**

Submit a second agent. Open Advanced. Set Purpose to `Summarize HN frontpage`. Uncheck `logger`. Submit. Expected: card shows the custom purpose, only `scraper` and `summarizer` chips. ✓

- [ ] **Step 6.6: Card click → run page**

Click an agent card. Expected: lands on `/agents/<uuid>/run`, name in the run-page header matches, wallet pill matches the card's wallet. ✓

- [ ] **Step 6.7: Full run end-to-end**

On the run page, leave the demo URL/prompt and click "Run with passport". Expected: SSE events stream into the split view, final result card shows a `mintTxHash`-style log tx hash, link to Snowtrace shows the `ActionLog.logAction` tx. ✓

- [ ] **Step 6.8: Validation error path**

Back on dashboard → Create tab. Open Advanced, clear Purpose entirely, submit. Expected: inline "Purpose must be 1–200 characters." (Note: the form auto-fills the default if blank, so to actually trigger the backend Zod path, paste a 201-char string. Either path is acceptable — the goal is to confirm field-level errors render.)

- [ ] **Step 6.9: Provisioning failure path** *(optional, only if you can run it safely)*

Temporarily set `PLATFORM_PRIVATE_KEY` to an unfunded address in `.env.local`, restart dev. Submit a create. Expected: red Notice "Couldn't fund the agent wallet — platform may be out of test AVAX. Try again shortly." Restore the funded key after testing.

- [ ] **Step 6.10: Final typecheck + lint**

```bash
cd apps/web && pnpm typecheck && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 6.11: Stop dev server. No commit needed for this task — it's verification only.**

---

## Self-review checklist

(Filled out after writing the plan above.)

**Spec coverage:**
- §Architecture diagram → represented in Task 4a's shell wiring.
- §`lib/api/agents.ts` types/functions/errors → Task 1.
- §`useAuth` upgrade → Task 2.
- §`AgentCard` widening → Task 3.
- §Dashboard Monitor/Create/Profile rewrite → Tasks 4a/4b/4c.
- §thirdweb hooks "kept vs dropped" list → matched in Task 4 (no `useSendTransaction` or `useSwitchActiveWalletChain` imports).
- §Files to delete → Task 5.
- §Error handling — three classes → Task 1 (error classes), Task 4b (UI surfaces all three).
- §Manual smoke (8 scenarios) → Task 6.

**Placeholder scan:** No "TBD" / "implement later" / "similar to" / "add validation". One optional step (6.9, provisioning fault injection) is explicitly marked optional with a rationale.

**Type consistency:** `DashboardAgent`, `AgentTool`, `CreateAgentInput`, `CreateAgentResult` defined once in Task 1, imported everywhere. Error classes (`UnauthorizedError`, `ApiError`) ditto. `ALL_TOOLS`, `DEFAULT_PURPOSE`, `PROVISION_MESSAGES` are file-local consts in `dashboard/page.tsx` and only referenced there.
