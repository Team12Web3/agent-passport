"use client";

import useSWR, { type SWRResponse } from "swr";

export type AgentSummary = {
  /** Internal database id (UUID). Empty for client-only Option B agents. */
  agentId: string;
  /** uint256 passport id (decimal string). */
  passportId: string;
  name: string;
  purpose: string;
  tools: string[];
  walletAddress: `0x${string}`;
  createdAt?: string;
  mintTxHash?: `0x${string}` | null;
};

type ListResponse = { agents: AgentSummary[] };

const fetcher = async (url: string): Promise<ListResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    // Unauthenticated dashboards (Option B / wallet-only) — treat as empty,
    // not as an error, so cards just don't render an extra "DB row" annotation.
    return { agents: [] };
  }
  if (!res.ok) {
    throw new Error(`agents/list ${res.status}`);
  }
  const data = (await res.json()) as { agents?: AgentSummary[] };
  return { agents: data.agents ?? [] };
};

/**
 * Pulls the authenticated user's server-side agent list with SWR.
 *
 * Auto-refreshes every 30s and on focus to satisfy the Person 4 spec
 * ("agents auto-refresh after create"). Safe to call from unauthenticated
 * pages — we treat 401 as an empty list rather than throwing.
 */
export function useAgents(): SWRResponse<ListResponse, Error> & {
  agents: AgentSummary[];
} {
  const swr = useSWR<ListResponse, Error>("/api/agents/list", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  return Object.assign(swr, { agents: swr.data?.agents ?? [] });
}
