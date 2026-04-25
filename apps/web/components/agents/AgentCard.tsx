"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Passport } from "@/lib/agentPassport";
import { shortenAddress, clamp } from "@/lib/utils";

type Props = {
  agentId: string;
  passport: Passport;
  trusted: boolean;
  progressPercent: number;
  sourceLabel: string;
};

export function AgentCard({ agentId, passport, trusted, progressPercent, sourceLabel }: Props) {
  const [open, setOpen] = useState(false);

  const statusLabel = passport.active ? "Active" : "Revoked";
  const statusTone = passport.active ? "border-emerald-400/30" : "border-rose-400/30";

  const trustLabel = trusted ? "Trusted" : "Untrusted";
  const trustTone = trusted ? "text-emerald-300" : "text-rose-300";

  const scoreNumber = useMemo(() => {
    const n = Number(passport.score);
    return Number.isFinite(n) ? n : 0;
  }, [passport.score]);

  const progress = clamp(progressPercent, 0, 100);

  return (
    <div
      className={[
        "w-full rounded-xl border bg-slate-950/70 transition",
        "p-4 md:p-5 backdrop-blur",
        "border-slate-800/80 shadow-[0_10px_30px_rgba(2,6,23,0.45)]",
        statusTone
      ].join(" ")}
    >
    <button
      onClick={() => setOpen((v) => !v)}
      className="block w-full text-left"
      aria-expanded={open}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-400">Agent ID</div>
          <div className="font-mono text-base md:text-lg truncate">{agentId}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className={"text-sm font-semibold " + trustTone}>{trustLabel}</div>
          <div className="text-xs text-slate-500">{sourceLabel}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Owner</div>
          <div className="font-mono text-sm">{shortenAddress(passport.owner || "0x0")}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Score</div>
          <div className="text-sm font-semibold">{scoreNumber}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Status</div>
          <div className="text-sm font-semibold">{statusLabel}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Progress</div>
          <div className="text-sm font-semibold">{progress}%</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={"h-full rounded-full " + (trusted ? "bg-emerald-500" : "bg-rose-500")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {open && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">Passport details</div>
          <div className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">owner</span>
              <span className="font-mono">{passport.owner || "0x0000000000000000000000000000000000000000"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">agentId</span>
              <span className="font-mono">{passport.agentId || agentId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">score</span>
              <span className="font-mono">{scoreNumber}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">active</span>
              <span className="font-mono">{String(passport.active)}</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Tip: set <span className="font-mono">NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS</span> to use on-chain data.
          </div>
        </div>
      )}
    </button>

      <div className="mt-4 flex items-center justify-end">
        <Link
          href={`/agents/${encodeURIComponent(agentId)}/run`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70"
        >
          Run task
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
