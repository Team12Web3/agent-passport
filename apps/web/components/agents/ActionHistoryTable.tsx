"use client";

import { shortenAddress } from "@/lib/utils";

export type ActionRunRow = {
  id: string;
  url: string;
  prompt: string;
  status: "pending" | "done" | "error";
  summary?: string;
  actionsCount: number;
  feeUsd: number;
  logTxHash?: `0x${string}`;
  createdAt: string;
};

type Props = {
  runs: ActionRunRow[];
  loading?: boolean;
  emptyHint?: string;
};

const SNOWTRACE_TX = "https://testnet.snowtrace.io/tx";

export function ActionHistoryTable({
  runs,
  loading = false,
  emptyHint,
}: Props) {
  if (loading) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-8 text-center text-[12.5px] text-faint">
          <span className="inline-block h-3.5 w-3.5 mr-2 rounded-full border-[1.5px] border-current border-r-transparent animate-spin align-middle" />
          Loading task history…
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-[13px] text-fg font-medium">
          No tasks have run yet
        </div>
        <div className="mt-1 text-[12px] text-muted">
          {emptyHint ??
            "Use Run task to drive this agent. Successful runs are recorded here and on-chain."}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-[0.14em] text-faint">
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">URL</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              <th className="px-4 py-2.5 font-medium text-right">Fee</th>
              <th className="px-4 py-2.5 font-medium text-right">Log tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                  {formatRelative(run.createdAt)}
                </td>
                <td className="px-4 py-2.5 max-w-[280px]">
                  <div className="truncate text-fg" title={run.url}>
                    {hostnameOf(run.url)}
                  </div>
                  {run.summary && (
                    <div
                      className="mt-0.5 truncate text-faint text-[11px]"
                      title={run.summary}
                    >
                      {run.summary}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={run.status} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">
                  {run.actionsCount || "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">
                  {run.feeUsd > 0 ? `$${run.feeUsd.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {run.logTxHash ? (
                    <a
                      href={`${SNOWTRACE_TX}/${run.logTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-emerald-300 underline decoration-dotted underline-offset-2 hover:text-emerald-200"
                    >
                      {shortenAddress(run.logTxHash, 5, 4)}
                    </a>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "done" | "error" }) {
  const map = {
    done: { label: "done", cls: "bg-emerald-400/15 text-emerald-300" },
    pending: { label: "running", cls: "bg-zinc-700/30 text-zinc-200" },
    error: { label: "error", cls: "bg-rose-400/15 text-rose-300" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] ${cls}`}
    >
      {label}
    </span>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
