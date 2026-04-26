"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Hex } from "viem";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Passport } from "@/lib/agentPassport";
import { shortenAddress, clamp } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { useAgentBalances } from "@/hooks/useAgentBalances";
import { useOnChainLog } from "@/hooks/useOnChainLog";
import { fadeUp, useMotionVariant } from "@/lib/motion";
import { TrustReport } from "./TrustReport";

type Props = {
  agentId: string;
  passport: Passport;
  trusted: boolean;
  /** Reserved for future use; the card now derives its own activity from trust score. */
  progressPercent: number;
  sourceLabel: string;
  /** Numeric uint256 passport id — used by the Trust Report. */
  passportId?: string;
  /** Local browser-only private key for the agent EOA, if available. */
  agentPrivateKey?: Hex;
};

type StakeSummary = {
  stakeVaultEnabled: boolean;
  activeStakeEth: string;
  totalSlashedEth: string;
  requiredStakeEth: string;
  hasMinimumStake: boolean;
  lastStakeAt: number | null;
};

const SNOWTRACE_BASE = "https://testnet.snowtrace.io/address";

export function AgentCard({
  agentId,
  passport,
  trusted,
  sourceLabel,
  passportId,
  agentPrivateKey,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState<StakeSummary | null>(null);

  const reportPassportId =
    passportId ?? (/^\d+$/.test(passport.agentId) ? passport.agentId : "0");

  // Single fetch per card; passed down to TrustReport so we don't fetch twice.
  useEffect(() => {
    if (!/^\d+$/.test(reportPassportId)) return;
    let cancelled = false;
    fetch(`/api/trust/stake/${encodeURIComponent(reportPassportId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StakeSummary | null) => {
        if (!cancelled) setStake(data);
      })
      .catch(() => {
        if (!cancelled) setStake(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reportPassportId]);

  const scoreNumber = useMemo(() => {
    const n = Number(passport.score);
    return Number.isFinite(n) ? n : 0;
  }, [passport.score]);

  const scorePct = clamp(scoreNumber, 0, 100);

  const statusTone = passport.active
    ? trusted
      ? {
          dot: "bg-emerald-400",
          text: "text-emerald-300",
          bar: "bg-gradient-to-r from-emerald-500 to-emerald-300",
        }
      : {
          dot: "bg-amber-400",
          text: "text-amber-300",
          bar: "bg-gradient-to-r from-amber-500 to-amber-300",
        }
    : {
        dot: "bg-rose-400",
        text: "text-rose-300",
        bar: "bg-gradient-to-r from-rose-500 to-rose-300",
      };
  const statusText = passport.active ? (trusted ? "Trusted" : "Building") : "Revoked";

  const seed = passport.agentWallet || passport.owner || agentId;
  const avatar = avatarStyle(seed);
  const initials = avatarInitials(passport.agentWallet || agentId);

  const ownerAddr = passport.owner || "";
  const agentAddr = passport.agentWallet || "";

  // Cheap, single-line "purpose" parsed from the on-chain metadataURI when
  // it's a data:application/json payload. Falls back to undefined for legacy
  // string-only metadata.
  const purpose = useMemo(() => parsePurpose(passport.metadataURI), [passport.metadataURI]);

  // Live wallet balances + on-chain action count. We poll less aggressively
  // than the detail page (one card on a busy dashboard shouldn't burn RPC),
  // and pause completely when not on-screen.
  const balances = useAgentBalances(agentAddr || null, { intervalMs: 30_000 });
  const onChainLog = useOnChainLog(reportPassportId, { limit: 25 });

  const stakeChip = useMemo(() => {
    if (!stake || !stake.stakeVaultEnabled) return null;
    const value = Number(stake.activeStakeEth);
    if (!Number.isFinite(value) || value <= 0) {
      return { label: "no stake", tone: "amber" as const };
    }
    return {
      label: `${trimNum(stake.activeStakeEth)} AVAX staked`,
      tone: stake.hasMinimumStake ? ("emerald" as const) : ("amber" as const),
    };
  }, [stake]);

  const cardVariant = useMotionVariant(fadeUp);
  const runHref = `/agents/${encodeURIComponent(agentId)}/run`;
  return (
    <motion.div
      variants={cardVariant}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={[
        "card card-hover group w-full min-w-0 max-w-full overflow-hidden p-4 transition",
        open ? "ring-1 ring-emerald-400/20 border-emerald-400/20" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="block w-full min-w-0 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
      >
        {/* Header: avatar + name + score */}
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-[12px] font-semibold text-white/95 font-mono shadow-inner"
            style={avatar}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-fg leading-tight">
              {agentId}
            </div>
            {purpose ? (
              <div className="mt-0.5 truncate text-[11.5px] text-muted">
                {purpose}
              </div>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-subtle">
              <span
                className={["h-1.5 w-1.5 rounded-full", statusTone.dot].join(" ")}
                aria-hidden
              />
              <span className={statusTone.text}>{statusText}</span>
              <span className="text-faint">·</span>
              <span className="font-mono normal-case tracking-normal text-faint truncate">
                {sourceLabel}
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-[20px] leading-none tabular-nums text-fg">
              {scoreNumber}
              <span className="text-faint text-[11px]"> /100</span>
            </div>
            <div className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-faint leading-none">
              Trust score
            </div>
          </div>
        </div>

        {/* Trust score bar — meaningful, not decorative */}
        <div className="mt-4">
          <div className="h-[4px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={[
                "h-full rounded-full transition-[width] duration-500",
                statusTone.bar,
              ].join(" ")}
              style={{ width: `${scorePct}%` }}
            />
          </div>
        </div>

        {/* Optional stake chip */}
        {stakeChip && (
          <div className="mt-3 flex justify-end">
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                stakeChip.tone === "emerald"
                  ? "bg-emerald-400/12 text-emerald-300 border border-emerald-400/20"
                  : "bg-amber-400/12 text-amber-200 border border-amber-400/20",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  stakeChip.tone === "emerald" ? "bg-emerald-400" : "bg-amber-400",
                ].join(" ")}
                aria-hidden
              />
              {stakeChip.label}
            </span>
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-3 flex items-center justify-between text-[10.5px] text-faint">
          <span className="uppercase tracking-[0.14em]">Trust Report</span>
          <span className="font-mono normal-case tracking-normal">
            {open ? "− hide" : "+ view"}
          </span>
        </div>
      </button>

      {/* Live balances + on-chain action count — sits between the trust bar
          and the address rows so the card feels alive on every refresh. */}
      <dl className="mt-3 grid grid-cols-3 gap-1.5 text-[10.5px]">
        <Metric
          label="AVAX"
          value={balances.loading && balances.avax === "—" ? "…" : balances.avax}
        />
        <Metric
          label="USDC"
          value={balances.loading && balances.usdc === "—" ? "…" : balances.usdc}
        />
        <Metric
          label="Actions"
          value={
            onChainLog.error === "action_log_not_deployed"
              ? "—"
              : onChainLog.loading && onChainLog.entries.length === 0
                ? "…"
                : onChainLog.entries.length.toString()
          }
        />
      </dl>

      {/* Always-visible address rows with copy + Snowtrace */}
      <dl className="mt-3 space-y-1.5 text-[11.5px]">
        <AddressRow label="Owner" value={ownerAddr} />
        <AddressRow label="Agent" value={agentAddr} />
      </dl>

      {/* Expanded content — outside the toggle button so its inner controls
          don't bubble and collapse the card. */}
      {open && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[11.5px]">
            <dl className="space-y-1.5">
              <DetailRow label="passport.id" value={reportPassportId} />
              <DetailRow label="owner" value={ownerAddr || "—"} />
              <DetailRow label="agentWallet" value={agentAddr || "—"} />
              <DetailRow label="score" value={`${scoreNumber}`} />
              <DetailRow label="active" value={String(passport.active)} />
              {passport.metadataURI && (
                <DetailRow label="metadata" value={passport.metadataURI} wrap />
              )}
            </dl>
          </div>

          <TrustReport
            passportId={reportPassportId}
            agentAddress={agentAddr}
            agentPrivateKey={agentPrivateKey}
            ownerAddress={ownerAddr}
            trustScore={scoreNumber}
            active={passport.active}
            metadataURI={passport.metadataURI}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <Link
          href={`/agents/${encodeURIComponent(reportPassportId)}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:border-white/15 hover:bg-white/[0.06] hover:text-fg"
        >
          Detail
        </Link>
        <Link
          href={runHref}
          prefetch
          onMouseEnter={() => router.prefetch(runHref)}
          onFocus={() => router.prefetch(runHref)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:border-white/15 hover:bg-white/[0.06] hover:text-fg"
        >
          Run task
          <span aria-hidden>→</span>
        </Link>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-black/30 px-2 py-1.5 min-w-0">
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint leading-none">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-[12px] tabular-nums text-fg leading-none truncate"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function parsePurpose(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith("data:application/json,")) return undefined;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(uri.slice("data:application/json,".length)),
    );
    if (typeof parsed?.purpose === "string" && parsed.purpose.trim()) {
      return parsed.purpose.trim();
    }
  } catch {
    // ignore parse failures — purpose just won't render.
  }
  return undefined;
}

// ───────────────────────── helpers ─────────────────────────

function AddressRow({ label, value }: { label: string; value: string }) {
  const display = value ? shortenAddress(value, 5, 4) : "—";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <dt className="w-12 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono tabular-nums text-muted text-right">
        {display}
      </dd>
      <div className="shrink-0 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <CopyAddressButton value={value} />
        {value && (
          <a
            href={`${SNOWTRACE_BASE}/${value}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="View on Snowtrace"
            aria-label={`View ${label.toLowerCase()} on Snowtrace`}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-faint hover:text-fg hover:bg-white/[0.06] transition"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M14 5h5v5M19 5l-9 9M11 5H5v14h14v-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

function CopyAddressButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!value) return null;

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // ignore
        }
      }}
      title={copied ? "Copied" : "Copy address"}
      aria-label="Copy address"
      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-faint hover:text-fg hover:bg-white/[0.06] transition"
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="8" y="8" width="12" height="12" rx="2.4" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      )}
    </button>
  );
}

function DetailRow({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd
        className={[
          "min-w-0 flex-1 text-right font-mono text-muted",
          wrap ? "break-all whitespace-pre-wrap" : "truncate",
        ].join(" ")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function trimNum(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toString() : value;
}
