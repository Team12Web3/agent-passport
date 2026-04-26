"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";

import {
  fetchPassportById,
  toDisplayPassport,
  type Passport,
} from "@/lib/agentPassport";
import {
  getStoredContractAddress,
  listAgents,
  type AgentRecord,
} from "@/lib/agentKeys";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { shortenAddress } from "@/lib/utils";
import { TrustReport } from "@/components/agents/TrustReport";
import { ActionHistoryTable, type ActionRunRow } from "@/components/agents/ActionHistoryTable";
import { OnChainLogTable } from "@/components/agents/OnChainLogTable";
import { useAgentBalances } from "@/hooks/useAgentBalances";
import { useOnChainLog } from "@/hooks/useOnChainLog";

const SNOWTRACE_ADDRESS = "https://testnet.snowtrace.io/address";

type ParsedMeta = {
  name?: string;
  purpose?: string;
  tools?: string[];
};

type ResolvedAgent = {
  /** Display label / name. */
  name: string;
  purpose: string;
  tools: string[];
  passportId: string;
  walletAddress: `0x${string}`;
  ownerAddress: string;
  passport: Passport;
  /** Local browser-only key, when this passport was minted in this browser. */
  agentPrivateKey?: Hex;
  /** DB row id when the agent exists in Supabase, otherwise the passport id. */
  agentId: string;
  source: "db" | "local" | "onchain";
};

export default function AgentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();

  const [agent, setAgent] = useState<ResolvedAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [runs, setRuns] = useState<ActionRunRow[]>([]);
  const [tab, setTab] = useState<"tasks" | "log">("tasks");
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  // Wallet gating mirrors /dashboard so back/forward navigation stays sane.
  useEffect(() => {
    if (status === "disconnected") {
      router.replace("/login");
    }
  }, [status, router]);

  // Resolve the agent by id. The id can be one of three things in this app:
  //   1. A Supabase row id (UUID) → /api/agents/[id]
  //   2. An Option B numeric passport id → on-chain getPassport
  //   3. A label like "agent-xyz" → look up in localStorage by label
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    async function resolve() {
      const contractAddress =
        process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS ||
        getStoredContractAddress() ||
        "";

      // 1. Try server-side first — this works for the Person 1 minted flow.
      try {
        const res = await fetch(
          `/api/agents/${encodeURIComponent(params.id)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            agent?: {
              agentId: string;
              name: string;
              purpose: string;
              tools: string[];
              passportId: string;
              walletAddress: `0x${string}`;
              mintTxHash?: `0x${string}` | null;
            };
            runs?: ActionRunRow[];
          };
          if (data?.agent) {
            const passportId = data.agent.passportId || "0";
            const onchainRaw = contractAddress
              ? await fetchPassportById(contractAddress, BigInt(passportId || "0"))
              : null;
            const passport: Passport = onchainRaw
              ? toDisplayPassport(onchainRaw)
              : {
                  owner: account?.address ?? "",
                  agentId: passportId,
                  score: 50n,
                  active: true,
                  agentWallet: data.agent.walletAddress,
                };
            if (!cancelled) {
              setAgent({
                name: data.agent.name,
                purpose: data.agent.purpose,
                tools: data.agent.tools ?? [],
                passportId,
                walletAddress: data.agent.walletAddress,
                ownerAddress: passport.owner ?? account?.address ?? "",
                passport,
                agentId: data.agent.agentId,
                source: "db",
              });
              setRuns(data.runs ?? []);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // Fall through to local resolution.
      }

      // 2. Try local Option B records — by passport id then by label.
      if (account?.address) {
        const records = listAgents(account.address);
        const local =
          records.find((r) => r.passportId === params.id) ||
          records.find((r) => r.label === params.id);
        if (local && contractAddress) {
          const raw = await fetchPassportById(contractAddress, BigInt(local.passportId));
          if (raw) {
            const passport = toDisplayPassport(raw);
            const meta = parseMetadataURI(passport.metadataURI);
            if (!cancelled) {
              setAgent({
                name: meta.name || local.label,
                purpose: meta.purpose || "—",
                tools: meta.tools ?? [],
                passportId: local.passportId,
                walletAddress: local.agentAddress as `0x${string}`,
                ownerAddress: passport.owner ?? account.address,
                passport,
                agentPrivateKey: local.privateKey,
                agentId: local.passportId,
                source: "local",
              });
              setLoading(false);
            }
            return;
          }
        }
      }

      // 3. Last resort — treat the id as a raw on-chain passport id.
      if (contractAddress && /^\d+$/.test(params.id)) {
        const raw = await fetchPassportById(contractAddress, BigInt(params.id));
        if (raw) {
          const passport = toDisplayPassport(raw);
          const meta = parseMetadataURI(passport.metadataURI);
          if (!cancelled) {
            setAgent({
              name: meta.name || `passport-${params.id}`,
              purpose: meta.purpose || "—",
              tools: meta.tools ?? [],
              passportId: params.id,
              walletAddress: (passport.agentWallet ?? "0x") as `0x${string}`,
              ownerAddress: passport.owner ?? "",
              passport,
              agentId: params.id,
              source: "onchain",
            });
            setLoading(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setNotFound(true);
        setLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [params.id, account?.address]);

  const balances = useAgentBalances(agent?.walletAddress);
  const onChainLog = useOnChainLog(agent?.passportId, {
    refreshKey: logRefreshKey,
  });

  const avatar = useMemo(
    () =>
      avatarStyle(
        agent?.walletAddress || agent?.passportId || params.id,
      ),
    [agent?.walletAddress, agent?.passportId, params.id],
  );

  if (loading) {
    return <DetailSkeleton />;
  }
  if (notFound || !agent) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <div className="eyebrow">Not found</div>
          <h1 className="mt-3 text-[24px] font-semibold tracking-tight">
            Agent not found
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            We couldn&apos;t find an agent matching <span className="font-mono">{params.id}</span>{" "}
            for the connected wallet.
          </p>
          <Link href="/dashboard" className="btn btn-primary focus-ring mt-6">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const initials = avatarInitials(agent.walletAddress || agent.name || "");
  const trustScore = Number(agent.passport.score) || 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-5 md:px-8 pt-10 pb-24">
        <Link
          href="/dashboard"
          className="text-[12px] text-faint hover:text-fg transition-colors inline-flex items-center gap-1.5"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>

        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-[13px] font-semibold text-white/95 font-mono shadow-inner"
              style={avatar}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="eyebrow">Agent · #{agent.passportId}</div>
              <h1 className="mt-1.5 text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] truncate">
                {agent.name}
              </h1>
              <p className="mt-1.5 max-w-prose text-[13.5px] text-muted">
                {agent.purpose}
              </p>
              {agent.tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {agent.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/agents/${encodeURIComponent(agent.agentId)}/run`}
              className="btn btn-primary focus-ring text-[12.5px]"
            >
              Run new task
              <span aria-hidden>→</span>
            </Link>
          </div>
        </header>

        {/* ── Wallet panel ─────────────────────────────────────────── */}
        <section className="mt-8">
          <WalletPanel
            address={agent.walletAddress}
            avax={balances.avax}
            usdc={balances.usdc}
            actionCount={onChainLog.entries.length}
            loading={balances.loading || onChainLog.loading}
            onRefresh={() => setLogRefreshKey((k) => k + 1)}
          />
        </section>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="mt-10 flex items-end gap-6 border-b border-white/[0.06]">
          {(
            [
              ["tasks", `Tasks${runs.length ? ` · ${runs.length}` : ""}`],
              [
                "log",
                `On-chain log${onChainLog.entries.length ? ` · ${onChainLog.entries.length}` : ""}`,
              ],
            ] as const
          ).map(([id, label]) => {
            const isActive = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative pb-3 text-[13px] focus-ring rounded-sm"
              >
                <span
                  className={
                    isActive
                      ? "text-fg"
                      : "text-muted hover:text-fg transition-colors"
                  }
                >
                  {label}
                </span>
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-px h-px bg-accent"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === "tasks" ? (
            <ActionHistoryTable
              runs={runs}
              emptyHint={
                agent.source === "db"
                  ? undefined
                  : "Server-side task history is empty for browser-minted agents. Use Run task to populate it."
              }
            />
          ) : (
            <OnChainLogTable
              entries={onChainLog.entries}
              loading={onChainLog.loading}
              error={onChainLog.error}
            />
          )}
        </div>

        {/* ── Trust Report ─────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="eyebrow">Trust</div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight">
            Trust Report
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Live verification of stake, attestation, session keys, and
            intent-bound execution for this agent.
          </p>
          <div className="mt-4">
            <TrustReport
              passportId={agent.passportId}
              agentAddress={agent.walletAddress}
              agentPrivateKey={agent.agentPrivateKey}
              ownerAddress={agent.ownerAddress}
              trustScore={trustScore}
              active={agent.passport.active}
              metadataURI={agent.passport.metadataURI}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// ───────────────────────── helpers ─────────────────────────

function parseMetadataURI(uri?: string): ParsedMeta {
  if (!uri) return {};
  try {
    if (uri.startsWith("data:application/json,")) {
      const parsed = JSON.parse(
        decodeURIComponent(uri.slice("data:application/json,".length)),
      );
      return {
        name: typeof parsed?.name === "string" ? parsed.name : undefined,
        purpose:
          typeof parsed?.purpose === "string" ? parsed.purpose : undefined,
        tools: Array.isArray(parsed?.tools) ? parsed.tools : undefined,
      };
    }
    // Older agents stored a bare JSON object ({label,createdAt}) — try parsing it.
    const parsed = JSON.parse(uri);
    return {
      name: typeof parsed?.label === "string" ? parsed.label : undefined,
    };
  } catch {
    return {};
  }
}

function WalletPanel({
  address,
  avax,
  usdc,
  actionCount,
  loading,
  onRefresh,
}: {
  address: string;
  avax: string;
  usdc: string;
  actionCount: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Agent wallet</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-1 text-[12px] font-mono text-fg">
              {shortenAddress(address, 8, 6)}
            </code>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300">
              Fuji
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="inline-block h-3 w-3 mr-1.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin align-middle" />
                Refreshing
              </>
            ) : (
              "Refresh"
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5"
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            href={`${SNOWTRACE_ADDRESS}/${address}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary focus-ring text-[11.5px] py-1.5 px-2.5"
          >
            Snowtrace ↗
          </a>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="AVAX balance" value={avax} unit="AVAX" />
        <Stat label="USDC balance" value={usdc} unit="USDC" />
        <Stat label="Actions logged" value={actionCount.toLocaleString()} unit="" />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[18px] tabular-nums text-fg leading-none">
        {value}
        {unit && (
          <span className="text-faint text-[11px] ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-5 md:px-8 pt-10 pb-24 animate-pulse">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="mt-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/[0.06]" />
          <div className="flex-1">
            <div className="h-3 w-20 rounded bg-white/[0.06]" />
            <div className="mt-3 h-7 w-72 rounded bg-white/[0.06]" />
            <div className="mt-2 h-3 w-96 rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="mt-8 h-32 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
        <div className="mt-10 h-4 w-40 rounded bg-white/[0.06]" />
        <div className="mt-5 h-48 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
      </div>
    </main>
  );
}
