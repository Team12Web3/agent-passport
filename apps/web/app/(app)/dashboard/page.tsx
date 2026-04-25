"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getContract, prepareContractCall, type ThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
  useActiveWalletConnectionStatus,
  useDisconnect,
  useProfiles,
  useSendTransaction,
  useSwitchActiveWalletChain,
  useWalletBalance
} from "thirdweb/react";
import type { Passport } from "@/lib/agentPassport";
import { fetchPassport, fetchVerifyAgent } from "@/lib/agentPassport";
import { MOCK_AGENT_IDS, mockOwner, mockProgressPercent, mockScore } from "@/lib/mockAgents";
import { AgentCard } from "@/components/agents/AgentCard";
import { shortenAddress } from "@/lib/utils";
import { getThirdwebClient } from "@/lib/thirdwebClient";

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
  const client = getThirdwebClient();

  if (!client) {
    return (
      <main className="min-h-screen bg-[#050b1a]">
        <div className="mx-auto max-w-6xl px-5 py-10 text-amber-200">
          Missing <span className="font-mono">NEXT_PUBLIC_TW_CLIENT_ID</span> (or{" "}
          <span className="font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</span>). Add it to{" "}
          <span className="font-mono">.env.local</span> and restart{" "}
          <span className="font-mono">pnpm dev</span>.
        </div>
      </main>
    );
  }

  return <DashboardShell client={client} />;
}

function DashboardShell({ client }: { client: ThirdwebClient }) {
  const router = useRouter();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const chain = useActiveWalletChain();
  const walletStatus = useActiveWalletConnectionStatus();
  const { disconnect } = useDisconnect();
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });
  const profilesQuery = useProfiles({ client });
  const walletBalanceQuery = useWalletBalance({
    client,
    address: account?.address,
    chain: chain ?? avalancheFuji
  });

  const contractAddress = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";

  const baseAgentIds = useMemo(() => MOCK_AGENT_IDS, []);
  const [createdAgentIds, setCreatedAgentIds] = useState<string[]>([]);
  const agentIds = useMemo(() => Array.from(new Set([...createdAgentIds, ...baseAgentIds])), [baseAgentIds, createdAgentIds]);

  const [rows, setRows] = useState<AgentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "create" | "profile">("monitor");
  const [newAgentId, setNewAgentId] = useState("");
  const [createState, setCreateState] = useState<{ loading: boolean; message: string | null; ok: boolean }>({
    loading: false,
    message: null,
    ok: false
  });

  const linkedEmail = useMemo(() => {
    const profiles = profilesQuery.data;
    if (!profiles?.length) return null;
    const emailProfile = profiles.find((p) => p.type === "email");
    if (!emailProfile) return null;

    const details = (emailProfile as { details?: unknown }).details;
    if (details && typeof details === "object" && details !== null && "email" in details) {
      const email = (details as { email?: unknown }).email;
      return typeof email === "string" && email.length > 0 ? email : null;
    }

    return null;
  }, [profilesQuery.data]);

  useEffect(() => {
    if (walletStatus === "disconnected") {
      router.replace("/login");
      return;
    }

    // Avoid flashing `/login` during initial auto-connect / reconnect windows.
    if (walletStatus === "connected" && !account?.address) {
      router.replace("/login");
    }
  }, [account?.address, router, walletStatus]);

  useEffect(() => {
    if (!account?.address) return;

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
      } catch {
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
  }, [agentIds, contractAddress, account?.address]);

  async function handleCreateAgent(e: FormEvent<HTMLFormElement>) {
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

    if (!account?.address) {
      setCreateState({ loading: false, message: "Connect a wallet first.", ok: false });
      return;
    }

    try {
      setCreateState({ loading: true, message: "Submitting transaction...", ok: true });

      if (chain?.id !== avalancheFuji.id) {
        try {
          await switchChain(avalancheFuji);
        } catch {
          throw new Error("Could not switch network to Avalanche Fuji (43113). Please switch in your wallet and try again.");
        }
      }

      const contract = getContract({
        address: contractAddress,
        chain: avalancheFuji,
        client
      });

      const tx = prepareContractCall({
        contract,
        method: "function createPassport(string agentId)",
        params: [agentId]
      });

      const receipt = await sendTx(tx);

      setCreatedAgentIds((prev) => (prev.includes(agentId) ? prev : [agentId, ...prev]));
      setCreateState({
        loading: false,
        message: `Passport created. Tx: ${receipt.transactionHash}`,
        ok: true
      });
      setNewAgentId("");
      setActiveTab("monitor");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed, was rejected, or you may need Fuji AVAX for gas.";
      setCreateState({
        loading: false,
        message: msg,
        ok: false
      });
    }
  }

  function handleLogout() {
    if (wallet) disconnect(wallet);
    router.replace("/login");
  }

  if (walletStatus === "connecting" || walletStatus === "unknown") {
    return (
      <main className="min-h-screen bg-[#050b1a]">
        <div className="mx-auto max-w-6xl px-5 py-10 text-slate-400">Connecting wallet...</div>
      </main>
    );
  }

  if (walletStatus === "connected" && !account?.address) {
    return (
      <main className="min-h-screen bg-[#050b1a]">
        <div className="mx-auto max-w-6xl px-5 py-10 text-slate-400">Preparing account...</div>
      </main>
    );
  }

  if (!account?.address) {
    return (
      <main className="min-h-screen bg-[#050b1a]">
        <div className="mx-auto max-w-6xl px-5 py-10 text-slate-400">Redirecting to connect...</div>
      </main>
    );
  }

  const walletAddress = account.address;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Agent Passport Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">Monitor AI agents, reputation, and task activity</p>
          </div>

          <div className="text-right">
            <div className="hidden md:block">
              <div className="text-xs text-slate-500">Trust threshold</div>
              <div className="font-mono text-sm text-slate-200">{MIN_TRUST_SCORE}+</div>
            </div>
            <button
              onClick={() => setActiveTab("profile")}
              className={[
                "mt-2 w-full rounded-lg border px-3 py-1.5 text-xs transition",
                activeTab === "profile"
                  ? "border-slate-500 bg-slate-100 text-slate-900"
                  : "border-slate-700 text-slate-300 hover:bg-slate-900/60"
              ].join(" ")}
            >
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900/60"
            >
              Disconnect
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-slate-300">
            Network: Avalanche Fuji
          </span>
          <span className="text-xs rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-slate-300">
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
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            <button
              onClick={() => setActiveTab("monitor")}
              className={[
                "px-4 py-2 text-sm rounded-md transition",
                activeTab === "monitor" ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:text-white"
              ].join(" ")}
            >
              Monitor Agents
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={[
                "px-4 py-2 text-sm rounded-md transition",
                activeTab === "create" ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:text-white"
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
                    className="rounded-xl border border-slate-800 bg-slate-900/45 p-5 animate-pulse"
                  >
                    <div className="h-4 w-40 bg-slate-800 rounded" />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="h-14 bg-slate-800/60 rounded-lg" />
                      <div className="h-14 bg-slate-800/60 rounded-lg" />
                      <div className="h-14 bg-slate-800/60 rounded-lg" />
                      <div className="h-14 bg-slate-800/60 rounded-lg" />
                    </div>
                    <div className="mt-4 h-2 bg-slate-800 rounded-full" />
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
            <div className="mt-4 max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-lg font-semibold">Create Agent Passport</h2>
              <p className="mt-1 text-sm text-slate-400">
                Creates a passport on Fuji using your connected thirdweb wallet (email wallet or MetaMask).
              </p>

              <form className="mt-4 space-y-4" onSubmit={handleCreateAgent}>
                <div>
                  <label htmlFor="agentId" className="mb-2 block text-sm text-slate-300">
                    Agent ID
                  </label>
                  <input
                    id="agentId"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    placeholder="agent-omega"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-blue-500"
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

          {activeTab === "profile" && (
            <div className="mt-4 max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-lg font-semibold">Profile</h2>
              <p className="mt-1 text-sm text-slate-400">Your connected thirdweb wallet session.</p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400">You</div>
                  <div className="text-sm font-medium">Connected wallet owner</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400">Wallet address</div>
                  <div className="text-sm font-mono">{shortenAddress(walletAddress)}</div>
                  <div className="mt-1 text-xs text-slate-500 break-all">{walletAddress}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400">Linked email (in-app wallet)</div>
                  <div className="text-sm font-medium">{linkedEmail || "Not linked / not an in-app wallet"}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400">Active chain</div>
                  <div className="text-sm font-medium">
                    {chain ? `${chain.name || "Unknown"} (${chain.id})` : "Unknown"}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400">Wallet balance</div>
                  <div className="text-sm font-medium">
                    {walletBalanceQuery.isLoading
                      ? "Loading..."
                      : walletBalanceQuery.data
                        ? `${walletBalanceQuery.data.displayValue} ${walletBalanceQuery.data.symbol}`
                        : "Unavailable"}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </main>
  );
}
