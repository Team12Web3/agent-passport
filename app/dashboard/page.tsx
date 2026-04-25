"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { Passport } from "@/lib/agentPassport";
import { fetchPassport, fetchVerifyAgent } from "@/lib/agentPassport";
import { MOCK_AGENT_IDS, mockOwner, mockProgressPercent, mockScore } from "@/lib/mockAgents";
import { AgentCard } from "@/components/AgentCard";

type AgentRow = {
  agentId: string;
  passport: Passport;
  trusted: boolean;
  progressPercent: number;
  sourceLabel: string;
};

const MIN_TRUST_SCORE = 500;

function mockPassport(agentId: string): Passport {
  return {
    owner: mockOwner(agentId),
    agentId,
    score: BigInt(mockScore(agentId)),
    active: true
  };
}

export default function DashboardPage() {
  const contractAddress = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";

  const baseAgentIds = useMemo(() => {
    // MVP: mock list is fine (replace with indexing later).
    return MOCK_AGENT_IDS;
  }, []);
  const [createdAgentIds, setCreatedAgentIds] = useState<string[]>([]);
  const agentIds = useMemo(() => {
    return Array.from(new Set([...createdAgentIds, ...baseAgentIds]));
  }, [baseAgentIds, createdAgentIds]);

  const [rows, setRows] = useState<AgentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "create">("monitor");
  const [newAgentId, setNewAgentId] = useState("");
  const [createState, setCreateState] = useState<{ loading: boolean; message: string | null; ok: boolean }>({
    loading: false,
    message: null,
    ok: false
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      setRows(null);

      const hasAddress = contractAddress && contractAddress.startsWith("0x") && contractAddress.length === 42;

      if (!hasAddress) {
        const mockRows = agentIds.map((agentId) => {
          const passport = mockPassport(agentId);
          const trusted = Number(passport.score) >= MIN_TRUST_SCORE;
          return {
            agentId,
            passport,
            trusted,
            progressPercent: mockProgressPercent(agentId),
            sourceLabel: "mock"
          };
        });
        if (!cancelled) setRows(mockRows);
        return;
      }

      try {
        const fetched = await Promise.all(
          agentIds.map(async (agentId) => {
            const [passport, verified] = await Promise.all([
              fetchPassport(contractAddress, agentId),
              fetchVerifyAgent(contractAddress, agentId, MIN_TRUST_SCORE)
            ]);
            return {
              agentId,
              passport,
              trusted: verified || Number(passport.score) >= MIN_TRUST_SCORE,
              progressPercent: mockProgressPercent(agentId),
              sourceLabel: "fuji"
            } satisfies AgentRow;
          })
        );

        if (!cancelled) setRows(fetched);
      } catch (e) {
        const mockRows = agentIds.map((agentId) => {
          const passport = mockPassport(agentId);
          const trusted = Number(passport.score) >= MIN_TRUST_SCORE;
          return {
            agentId,
            passport,
            trusted,
            progressPercent: mockProgressPercent(agentId),
            sourceLabel: "mock"
          };
        });
        if (!cancelled) {
          setError("RPC/contract unavailable — showing mock data.");
          setRows(mockRows);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [agentIds, contractAddress]);

  async function handleCreateAgent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const agentId = newAgentId.trim();
    if (!agentId) {
      setCreateState({ loading: false, message: "Please enter an Agent ID.", ok: false });
      return;
    }

    const hasAddress = contractAddress && contractAddress.startsWith("0x") && contractAddress.length === 42;
    if (!hasAddress) {
      setCreatedAgentIds((prev) => (prev.includes(agentId) ? prev : [agentId, ...prev]));
      setCreateState({
        loading: false,
        message: "Contract address not set. Added agent locally for demo mode.",
        ok: true
      });
      setNewAgentId("");
      setActiveTab("monitor");
      return;
    }

    if (typeof window === "undefined" || !(window as { ethereum?: unknown }).ethereum) {
      setCreateState({
        loading: false,
        message: "No wallet found. Install MetaMask (or similar) to create on-chain.",
        ok: false
      });
      return;
    }

    try {
      setCreateState({ loading: true, message: "Submitting transaction...", ok: true });

      const browserProvider = new ethers.BrowserProvider((window as { ethereum: ethers.Eip1193Provider }).ethereum);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        ["function createPassport(string agentId) external"],
        signer
      );

      const tx = await contract.createPassport(agentId);
      await tx.wait();

      setCreatedAgentIds((prev) => (prev.includes(agentId) ? prev : [agentId, ...prev]));
      setCreateState({ loading: false, message: "Agent passport created successfully.", ok: true });
      setNewAgentId("");
      setActiveTab("monitor");
    } catch {
      setCreateState({
        loading: false,
        message: "Transaction failed or rejected. Please try again.",
        ok: false
      });
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Agent Passport Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Monitor AI agents, reputation, and task activity</p>
          </div>

          <div className="hidden md:block text-right">
            <div className="text-xs text-zinc-500">Trust threshold</div>
            <div className="font-mono text-sm text-zinc-200">{MIN_TRUST_SCORE}+</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-zinc-300">
            Network: Avalanche Fuji
          </span>
          <span className="text-xs rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-zinc-300">
            Contract:{" "}
            <span className="font-mono">
              {contractAddress ? contractAddress : "NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS (not set)"}
            </span>
          </span>
          {error && (
            <span className="text-xs rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-200">
              {error}
            </span>
          )}
        </div>

        <div className="mt-8">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
            <button
              onClick={() => setActiveTab("monitor")}
              className={[
                "px-4 py-2 text-sm rounded-md transition",
                activeTab === "monitor" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:text-white"
              ].join(" ")}
            >
              Monitor Agents
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={[
                "px-4 py-2 text-sm rounded-md transition",
                activeTab === "create" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:text-white"
              ].join(" ")}
            >
              Create Agent
            </button>
          </div>

          {activeTab === "monitor" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!rows &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 animate-pulse"
                  >
                    <div className="h-4 w-40 bg-zinc-800 rounded" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="h-14 bg-zinc-800/60 rounded-lg" />
                      <div className="h-14 bg-zinc-800/60 rounded-lg" />
                      <div className="h-14 bg-zinc-800/60 rounded-lg" />
                      <div className="h-14 bg-zinc-800/60 rounded-lg" />
                    </div>
                    <div className="mt-4 h-2 bg-zinc-800 rounded-full" />
                  </div>
                ))}

              {rows?.map((row) => (
                <AgentCard
                  key={row.agentId}
                  agentId={row.agentId}
                  passport={row.passport}
                  trusted={row.trusted}
                  progressPercent={row.progressPercent}
                  sourceLabel={row.sourceLabel}
                />
              ))}
            </div>
          )}

          {activeTab === "create" && (
            <div className="mt-4 max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h2 className="text-lg font-semibold">Create Agent Passport</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Create a new agent passport on-chain. In demo mode (no contract address), this adds a local mock agent.
              </p>

              <form className="mt-4 space-y-4" onSubmit={handleCreateAgent}>
                <div>
                  <label htmlFor="agentId" className="mb-2 block text-sm text-zinc-300">
                    Agent ID
                  </label>
                  <input
                    id="agentId"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    placeholder="agent-omega"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-0 focus:border-zinc-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createState.loading}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createState.loading ? "Creating..." : "Create Passport"}
                </button>
              </form>

              {createState.message && (
                <div
                  className={[
                    "mt-4 rounded-lg border px-3 py-2 text-sm",
                    createState.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  ].join(" ")}
                >
                  {createState.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

