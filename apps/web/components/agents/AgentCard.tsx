"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Passport } from "@/lib/agentPassport";
import { shortenAddress, clamp } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { fadeUp, useMotionVariant } from "@/lib/motion";

type Props = {
  agentId: string;
  passport: Passport;
  trusted: boolean;
  progressPercent: number;
  sourceLabel: string;
};

export function AgentCard({ agentId, passport, trusted, progressPercent, sourceLabel }: Props) {
  const [open, setOpen] = useState(false);

  const scoreNumber = useMemo(() => {
    const n = Number(passport.score);
    return Number.isFinite(n) ? n : 0;
  }, [passport.score]);

  const progress = clamp(progressPercent, 0, 100);

  const statusTone = passport.active
    ? trusted
      ? { dot: "bg-emerald-400", text: "text-emerald-300", bar: "bg-emerald-400/90" }
      : { dot: "bg-amber-400", text: "text-amber-300", bar: "bg-amber-400/85" }
    : { dot: "bg-rose-400", text: "text-rose-300", bar: "bg-rose-400/85" };
  const statusText = passport.active ? (trusted ? "Trusted" : "Building") : "Revoked";

  const seed = passport.agentWallet || passport.owner || agentId;
  const avatar = avatarStyle(seed);
  const initials = avatarInitials(passport.agentWallet || agentId);

  const ownerShort = shortenAddress(passport.owner || "0x0", 5, 4);
  const agentShort = passport.agentWallet ? shortenAddress(passport.agentWallet, 5, 4) : "—";

  const cardVariant = useMotionVariant(fadeUp);
  return (
    <motion.div
      variants={cardVariant}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="card card-hover group w-full min-w-0 max-w-full overflow-hidden p-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="block w-full min-w-0 text-left focus-ring rounded-md"
      >
        {/* Header: avatar + name (truncates) + compact score */}
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white/95 font-mono"
            style={avatar}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-fg leading-tight">{agentId}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-subtle">
              <span className={["h-1.5 w-1.5 rounded-full", statusTone.dot].join(" ")} aria-hidden />
              <span className={statusTone.text}>{statusText}</span>
              <span className="text-faint">·</span>
              <span className="font-mono normal-case tracking-normal text-faint truncate">{sourceLabel}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-[18px] leading-none tabular-nums text-fg">{scoreNumber}</div>
            <div className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-faint leading-none">Trust</div>
          </div>
        </div>

        {/* Activity bar — single line, full width */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.12em] text-faint">
            <span>Activity</span>
            <span className="font-mono tabular-nums normal-case tracking-normal text-muted">{progress}%</span>
          </div>
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={["h-full rounded-full transition-all duration-500", statusTone.bar].join(" ")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Addresses — vertical key/value list, fits any card width */}
        <dl className="mt-4 space-y-1 text-[11.5px]">
          <AddressRow label="Owner" value={ownerShort} />
          <AddressRow label="Agent" value={agentShort} />
        </dl>

        {open && (
          <div className="mt-3 min-w-0 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[11.5px]">
            <dl className="space-y-1.5">
              <DetailRow label="passport.id" value={passport.agentId} />
              <DetailRow label="owner" value={passport.owner || "—"} />
              <DetailRow label="agentWallet" value={passport.agentWallet || "—"} />
              <DetailRow label="score" value={`${scoreNumber}`} />
              <DetailRow label="active" value={String(passport.active)} />
              {passport.metadataURI && <DetailRow label="metadata" value={passport.metadataURI} wrap />}
            </dl>
          </div>
        )}
      </button>

      <div className="mt-3 flex items-center justify-end">
        <Link
          href={`/agents/${encodeURIComponent(agentId)}/run`}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:border-white/15 hover:bg-white/[0.06] hover:text-fg"
        >
          Run task
          <span aria-hidden>→</span>
        </Link>
      </div>
    </motion.div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <dt className="w-12 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono tabular-nums text-muted text-right">{value}</dd>
    </div>
  );
}

function DetailRow({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd
        className={[
          "min-w-0 flex-1 text-right font-mono text-muted",
          wrap ? "break-all whitespace-pre-wrap" : "truncate"
        ].join(" ")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
