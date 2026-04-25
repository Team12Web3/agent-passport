"use client";

import { useEffect, useMemo, useState } from "react";

type BalanceValue = number | string;

export type AgentWalletPanelProps = {
  address: string;
  avaxBalance: BalanceValue;
  usdcBalance: BalanceValue;
  actionCount: number;
  className?: string;
  isRefreshing?: boolean;
  autoRefresh?: boolean;
  refreshEveryMs?: number;
  lastUpdatedAt?: Date | number | string | null;
  explorerBaseUrl?: string;
  onRefresh?: () => Promise<void> | void;
};

const DEFAULT_EXPLORER_BASE_URL = "https://testnet.snowtrace.io/address";

function formatBalance(value: BalanceValue, symbol: string): string {
  if (typeof value === "number") {
    return `${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })} ${symbol}`;
  }

  return `${value} ${symbol}`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function truncateAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatLastUpdated(value: AgentWalletPanelProps["lastUpdatedAt"]): string {
  if (!value) {
    return "Not refreshed yet";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not refreshed yet";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AgentWalletPanel({
  address,
  avaxBalance,
  usdcBalance,
  actionCount,
  className,
  isRefreshing = false,
  autoRefresh = false,
  refreshEveryMs = 10_000,
  lastUpdatedAt,
  explorerBaseUrl = DEFAULT_EXPLORER_BASE_URL,
  onRefresh,
}: AgentWalletPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const snowtraceHref = `${explorerBaseUrl.replace(/\/$/, "")}/${address}`;

  const statCards = useMemo(
    () => [
      {
        label: "AVAX Balance",
        value: formatBalance(avaxBalance, "AVAX"),
      },
      {
        label: "USDC Balance",
        value: formatBalance(usdcBalance, "USDC"),
      },
      {
        label: "Actions Logged",
        value: formatCount(actionCount),
      },
    ],
    [actionCount, avaxBalance, usdcBalance],
  );

  useEffect(() => {
    if (!autoRefresh || !onRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void onRefresh();
    }, refreshEveryMs);

    return () => window.clearInterval(interval);
  }, [autoRefresh, onRefresh, refreshEveryMs]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 1_500);

    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      className={[
        "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">Agent Wallet</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-900">
                {truncateAddress(address)}
              </code>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Fuji
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Last updated {formatLastUpdated(lastUpdatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {onRefresh ? (
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={isRefreshing}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy address"}
            </button>

            <a
              href={snowtraceHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              View on Snowtrace
            </a>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {card.label}
              </dt>
              <dd className="mt-2 text-lg font-semibold text-zinc-950">
                {card.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
