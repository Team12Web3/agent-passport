"use client";

import { shortenAddress } from "@/lib/utils";
import type { OnChainLogEntry } from "@/hooks/useOnChainLog";

const SNOWTRACE_TX = "https://testnet.snowtrace.io/tx";

type Props = {
  entries: OnChainLogEntry[];
  loading?: boolean;
  error?: string | null;
};

export function OnChainLogTable({ entries, loading = false, error }: Props) {
  if (loading) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-8 text-center text-[12.5px] text-faint">
          <span className="inline-block h-3.5 w-3.5 mr-2 rounded-full border-[1.5px] border-current border-r-transparent animate-spin align-middle" />
          Scanning Avalanche Fuji for ActionLogged events…
        </div>
      </div>
    );
  }

  if (error === "action_log_not_deployed") {
    return (
      <div className="card p-8 text-center">
        <div className="text-[13px] text-fg font-medium">
          ActionLog not configured
        </div>
        <div className="mt-1 text-[12px] text-muted">
          Deploy <span className="font-mono">ActionLog</span> and update{" "}
          <span className="font-mono">deployments.json</span> to surface
          on-chain task receipts here.
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-[13px] text-fg font-medium">
          No on-chain actions yet
        </div>
        <div className="mt-1 text-[12px] text-muted">
          Each completed task emits an{" "}
          <span className="font-mono">ActionLogged</span> event on Avalanche
          Fuji that will appear here.
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
              <th className="px-4 py-2.5 font-medium">Block</th>
              <th className="px-4 py-2.5 font-medium">Task hash</th>
              <th className="px-4 py-2.5 font-medium text-right">Fee USDC</th>
              <th className="px-4 py-2.5 font-medium text-right">Beneficiary</th>
              <th className="px-4 py-2.5 font-medium text-right">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                  {formatBlockTimestamp(entry.blockTimestamp)}
                </td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-muted">
                  #{entry.blockNumber.toString()}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted">
                  {shortenAddress(entry.taskHash, 6, 4)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">
                  {entry.feeAmountRaw === 0n ? "—" : entry.feeAmountUsdc}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-muted">
                  {shortenAddress(entry.beneficiary, 4, 4)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <a
                    href={`${SNOWTRACE_TX}/${entry.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-300 underline decoration-dotted underline-offset-2 hover:text-emerald-200"
                  >
                    {shortenAddress(entry.transactionHash, 5, 4)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBlockTimestamp(ts: bigint): string {
  if (ts === 0n) return "—";
  const t = Number(ts) * 1000;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
