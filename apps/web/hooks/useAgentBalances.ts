"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { avalancheFuji } from "viem/chains";

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x5425890298aed601595a70AB815c96711a31Bc65") as Address;

const ERC20_BALANCE_OF = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type AgentBalances = {
  /** AVAX balance formatted to 4 dp (or "—"). */
  avax: string;
  /** USDC balance formatted to 2 dp (or "—"). */
  usdc: string;
  /** Raw bigints for callers that need precise math. */
  avaxWei: bigint;
  usdcRaw: bigint;
  loading: boolean;
  error: string | null;
};

const EMPTY: AgentBalances = {
  avax: "—",
  usdc: "—",
  avaxWei: 0n,
  usdcRaw: 0n,
  loading: false,
  error: null,
};

/**
 * Live AVAX + USDC balances for an agent EOA on Avalanche Fuji.
 *
 * Polls every 10s (per Person 4 spec) and pauses when the tab is hidden
 * to avoid burning RPC quota. Returns formatted strings ready for display
 * plus the raw bigints for precise comparisons.
 */
export function useAgentBalances(
  address: string | null | undefined,
  options: { intervalMs?: number; enabled?: boolean } = {},
): AgentBalances {
  const { intervalMs = 10_000, enabled = true } = options;
  const [state, setState] = useState<AgentBalances>(EMPTY);

  useEffect(() => {
    if (
      !enabled ||
      !address ||
      typeof address !== "string" ||
      !address.startsWith("0x") ||
      address.length !== 42
    ) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    const client = createPublicClient({
      chain: avalancheFuji,
      transport: http(FUJI_RPC),
    });

    async function load(initial: boolean) {
      if (cancelled) return;
      if (initial) {
        setState((s) => ({ ...s, loading: true, error: null }));
      }
      try {
        const [avaxWei, usdcRaw] = await Promise.all([
          client.getBalance({ address: address as Address }),
          client
            .readContract({
              address: USDC_ADDRESS,
              abi: ERC20_BALANCE_OF,
              functionName: "balanceOf",
              args: [address as Address],
            })
            .catch(() => 0n),
        ]);
        if (cancelled) return;
        setState({
          avax: trim(formatUnits(avaxWei, 18), 4),
          usdc: trim(formatUnits(usdcRaw as bigint, 6), 2),
          avaxWei,
          usdcRaw: usdcRaw as bigint,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "balance_read_failed",
        }));
      }
    }

    void load(true);

    let timer: ReturnType<typeof setInterval> | null = null;
    function startTimer() {
      stopTimer();
      timer = setInterval(() => void load(false), intervalMs);
    }
    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void load(false);
        startTimer();
      } else {
        stopTimer();
      }
    }

    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [address, enabled, intervalMs]);

  return state;
}

function trim(value: string, dp: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return "0";
  const fixed = n.toFixed(dp);
  return fixed.replace(/\.?0+$/, "");
}
