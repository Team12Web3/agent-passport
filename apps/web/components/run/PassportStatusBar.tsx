"use client";
import { useState } from "react";
import type { RunStatus } from "@/hooks/useAgentRun";

type Props = {
  passportId?: string | null;
  trustScore?: number | null;
  txHash?: string | null;
  status: RunStatus;
};

const stateStyles: Record<RunStatus, string> = {
  idle: "border-slate-800/80 bg-slate-950/70 backdrop-blur text-slate-400",
  running: "border-blue-700 bg-blue-950/40 text-blue-300",
  done: "border-green-700 bg-green-950/40 text-green-300",
  error: "border-red-700 bg-red-950/40 text-red-300",
  blocked: "border-red-700 bg-red-950/60 text-red-300",
};

const dotStyles: Record<RunStatus, string> = {
  idle: "bg-slate-500",
  running: "bg-blue-400 animate-pulse",
  done: "bg-green-400 animate-pulse",
  error: "bg-red-500",
  blocked: "bg-red-500",
};

const statusLabels: Record<RunStatus, string> = {
  idle: "Idle",
  running: "Running…",
  done: "Verified",
  error: "Error",
  blocked: "Blocked",
};

export function PassportStatusBar({ passportId, trustScore, txHash, status }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyHash() {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t transition-colors duration-500 ${stateStyles[status]} ${status === "blocked" ? "animate-shake" : ""}`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-2.5 text-xs font-mono">
        {/* Status dot + label */}
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${dotStyles[status]}`} />
          <span className="font-semibold uppercase tracking-wider">
            {statusLabels[status]}
          </span>
        </div>

        {/* Passport ID */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
            />
          </svg>
          <span>Passport</span>
          <span className="text-slate-300">#{passportId ?? "—"}</span>
        </div>

        {/* Trust score */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>Trust</span>
          <span className="text-slate-300">{trustScore ?? "—"}</span>
        </div>

        {/* Tx hash */}
        {txHash ? (
          <button
            onClick={copyHash}
            className="flex items-center gap-1.5 text-slate-400 transition hover:text-slate-200"
            title="Click to copy tx hash"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span>Tx</span>
            <span className="text-slate-300">
              {txHash.slice(0, 6)}…{txHash.slice(-4)}
            </span>
            {copied && <span className="text-green-400">✓</span>}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>Tx —</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        <span className="text-slate-600">Agent Passport · Avalanche Fuji</span>
      </div>
    </div>
  );
}
