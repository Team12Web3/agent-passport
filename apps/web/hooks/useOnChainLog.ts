"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { avalancheFuji } from "viem/chains";

import deployments from "@contracts/deployments.json";

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";

const ACTION_LOGGED = parseAbiItem(
  "event ActionLogged(uint256 indexed passportId, address indexed agentWallet, bytes32 taskHash, bytes32 actionsRoot, uint256 feeAmount, address beneficiary, uint256 blockTimestamp)",
);

export type OnChainLogEntry = {
  /** Block-ordered key for table rendering. */
  id: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: Hex;
  passportId: bigint;
  agentWallet: Address;
  taskHash: Hex;
  actionsRoot: Hex;
  feeAmountRaw: bigint;
  /** USDC has 6 decimals — pre-formatted for direct rendering. */
  feeAmountUsdc: string;
  beneficiary: Address;
};

export type OnChainLogState = {
  entries: OnChainLogEntry[];
  loading: boolean;
  error: string | null;
};

const ACTION_LOG_ADDRESS = (deployments as { ActionLog?: { address?: string } })
  .ActionLog?.address as Address | undefined;

/**
 * Reads ActionLogged events from the on-chain ActionLog contract.
 *
 * Scoped by passportId. Results are sorted newest-first. Refreshes
 * automatically when the passport id changes; callers can also bump
 * `refreshKey` to force a re-fetch (used after a Run-task completes).
 */
export function useOnChainLog(
  passportId: string | null | undefined,
  options: { limit?: number; refreshKey?: number } = {},
): OnChainLogState {
  const { limit = 50, refreshKey = 0 } = options;
  const [state, setState] = useState<OnChainLogState>({
    entries: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!passportId || !/^\d+$/.test(passportId)) {
      setState({ entries: [], loading: false, error: null });
      return;
    }
    if (
      !ACTION_LOG_ADDRESS ||
      ACTION_LOG_ADDRESS === "0x0000000000000000000000000000000000000000"
    ) {
      setState({
        entries: [],
        loading: false,
        error: "action_log_not_deployed",
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const client = createPublicClient({
      chain: avalancheFuji,
      transport: http(FUJI_RPC),
    });

    (async () => {
      try {
        // Avalanche RPCs cap getLogs ranges. We scan the most recent ~50k
        // blocks which comfortably covers a hackathon's worth of activity
        // without hitting the typical 2k-block per-call limit on public RPCs.
        const latest = await client.getBlockNumber();
        const RANGE = 2000n;
        const TOTAL_BLOCKS = 50_000n;
        const fromFloor =
          latest > TOTAL_BLOCKS ? latest - TOTAL_BLOCKS + 1n : 0n;

        const all: Log[] = [];
        for (let to = latest; to >= fromFloor; to -= RANGE) {
          const from = to >= RANGE ? to - RANGE + 1n : 0n;
          try {
            const logs = await client.getLogs({
              address: ACTION_LOG_ADDRESS,
              event: ACTION_LOGGED,
              args: { passportId: BigInt(passportId) },
              fromBlock: from,
              toBlock: to,
            });
            all.push(...logs);
            if (all.length >= limit) break;
          } catch {
            // ignore the chunk; keep scanning so a single flaky range
            // doesn't blank the whole table.
          }
          if (from === 0n) break;
        }

        if (cancelled) return;

        const blockTimes = new Map<bigint, bigint>();
        await Promise.all(
          [...new Set(all.map((l) => l.blockNumber))]
            .filter((bn): bn is bigint => bn !== null)
            .map(async (bn) => {
              try {
                const block = await client.getBlock({ blockNumber: bn });
                blockTimes.set(bn, block.timestamp);
              } catch {
                blockTimes.set(bn, 0n);
              }
            }),
        );

        const entries = all
          .map((log) => {
            const args = (log as Log & { args?: Record<string, unknown> })
              .args;
            if (!args) return null;
            const blockNumber = log.blockNumber ?? 0n;
            const feeAmountRaw = (args.feeAmount as bigint) ?? 0n;
            return {
              id: `${log.transactionHash}-${log.logIndex ?? 0}`,
              blockNumber,
              blockTimestamp:
                (args.blockTimestamp as bigint | undefined) ??
                blockTimes.get(blockNumber) ??
                0n,
              transactionHash: log.transactionHash as Hex,
              passportId: (args.passportId as bigint) ?? 0n,
              agentWallet: args.agentWallet as Address,
              taskHash: args.taskHash as Hex,
              actionsRoot: args.actionsRoot as Hex,
              feeAmountRaw,
              feeAmountUsdc: formatUsdc(feeAmountRaw),
              beneficiary: args.beneficiary as Address,
            } satisfies OnChainLogEntry;
          })
          .filter((entry): entry is OnChainLogEntry => entry !== null)
          .sort((a, b) =>
            a.blockNumber === b.blockNumber
              ? 0
              : a.blockNumber > b.blockNumber
                ? -1
                : 1,
          )
          .slice(0, limit);

        if (!cancelled) {
          setState({ entries, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            entries: [],
            loading: false,
            error:
              err instanceof Error ? err.message : "log_read_failed",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [passportId, limit, refreshKey]);

  return state;
}

function formatUsdc(raw: bigint): string {
  // USDC has 6 decimals.
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
