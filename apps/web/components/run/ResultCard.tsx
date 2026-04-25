"use client";
import { useState } from "react";
import type { DoneResult } from "@/hooks/useAgentRun";

type Props = {
  result: DoneResult | null;
};

export function ResultCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const txHash = result.txHash ?? "";
  const snowtraceUrl = txHash
    ? `https://testnet.snowtrace.io/tx/${txHash}`
    : null;

  async function copyHash() {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const summaryLines = result.summary.split("\n");
  const isTruncated = !expanded && summaryLines.length > 6;
  const displaySummary = isTruncated
    ? summaryLines.slice(0, 6).join("\n")
    : result.summary;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 backdrop-blur shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/60 px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-black">
          ✓
        </span>
        <h2 className="text-sm font-semibold text-white">Run Complete</h2>
      </div>

      <div className="p-5">
        {/* Summary */}
        <div className="mb-5">
          <p className="mb-1.5 text-xs uppercase tracking-wider text-slate-500">
            Summary
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {displaySummary}
            {isTruncated && "…"}
          </p>
          {summaryLines.length > 6 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-slate-400 underline hover:text-white"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-black p-3 text-center">
            <p className="text-xs text-slate-500">Actions</p>
            <p className="mt-1 text-xl font-bold text-white">
              {result.actionsCount}
            </p>
          </div>
          <div className="rounded-lg bg-black p-3 text-center">
            <p className="text-xs text-slate-500">Fee</p>
            <p className="mt-1 text-xl font-bold text-white">
              ${result.feeUsd.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-black p-3 text-center">
            {snowtraceUrl ? (
              <>
                <p className="text-xs text-slate-500">Snowtrace</p>
                <a
                  href={snowtraceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-red-400 hover:text-red-300"
                  style={{ color: "#E84142" }}
                >
                  View →
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">Tx Hash</p>
                <p className="mt-1 text-sm text-slate-400">—</p>
              </>
            )}
          </div>
        </div>

        {/* Tx hash copy */}
        {txHash && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-black px-4 py-3">
            <p className="font-mono text-xs text-slate-400 truncate">
              {txHash}
            </p>
            <button
              onClick={copyHash}
              className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
