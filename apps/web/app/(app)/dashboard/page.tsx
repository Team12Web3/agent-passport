"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, stagger, useMotionVariant } from "@/lib/motion";
import { type ThirdwebClient } from "thirdweb";
import type { Hex } from "viem";
import { avalancheFuji } from "thirdweb/chains";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
  useActiveWalletConnectionStatus,
  useDisconnect,
  useProfiles,
  useWalletBalance
} from "thirdweb/react";
import {
  fetchPassportById,
  fetchPassportsOf,
  toDisplayPassport,
  type Passport
} from "@/lib/agentPassport";
import {
  downloadAgentBackup,
  listAgents,
  type AgentRecord
} from "@/lib/agentKeys";
import { useMintPassport, type MintState } from "@/hooks/useMintPassport";
import { AgentCard } from "@/components/agents/AgentCard";
import { PassportCreatingLoader } from "@/components/onboarding/PassportCreatingLoader";
import { deterministicPercent, shortenAddress } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { DEPLOYED_AGENT_PASSPORT_ADDRESS } from "@/lib/chain/deployedAddresses";

type AgentRow = {
  agentId: string;
  passportId: string;
  passport: Passport;
  trusted: boolean;
  progressPercent: number;
  sourceLabel: string;
  agentPrivateKey?: Hex;
};

type ContractAddressSource = "env" | "deployment" | "local" | "none";

type BackendAgent = {
  agentId: string;
  name: string;
  passportId: string;
  walletAddress: string;
};

const MIN_TRUST_SCORE = 50;

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && addr.startsWith("0x") && addr.length === 42;
}

function snowtraceAddressUrl(address: string) {
  return `https://testnet.snowtrace.io/address/${address}`;
}

export default function DashboardPage() {
  const client = getThirdwebClient();

  if (!client) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-24">
          <div className="card p-6 text-sm text-amber-200">
            Missing <span className="font-mono">NEXT_PUBLIC_TW_CLIENT_ID</span> (or{" "}
            <span className="font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</span>). Add it to{" "}
            <span className="font-mono">.env.local</span> and restart{" "}
            <span className="font-mono">pnpm dev</span>.
          </div>
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
  const profilesQuery = useProfiles({ client });
  const walletBalanceQuery = useWalletBalance({
    client,
    address: account?.address,
    chain: chain ?? avalancheFuji
  });

  const mintHook = useMintPassport(client);
  const { contractAddress } = mintHook;

  // Derive contract address source for display purposes.
  const envContractAddress = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";
  const contractAddressSource: ContractAddressSource = isValidAddress(envContractAddress)
    ? "env"
    : isValidAddress(DEPLOYED_AGENT_PASSPORT_ADDRESS)
      ? "deployment"
    : isValidAddress(contractAddress)
      ? "local"
      : "none";

  const [onChainRows, setOnChainRows] = useState<AgentRow[]>([]);
  const [isHydratingAgents, setIsHydratingAgents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "create" | "profile">("monitor");
  const [agentLabel, setAgentLabel] = useState("");

  const tabVariant = useMotionVariant(fadeUp);

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

  // Auth gating. Wallet-based only — the dashboard makes no authenticated API
  // calls today, so we don't need to round-trip /api/auth/status here.
  useEffect(() => {
    if (walletStatus === "disconnected") {
      router.replace("/login");
      return;
    }
    if (walletStatus === "connected" && !account?.address) {
      router.replace("/login");
    }
  }, [account?.address, router, walletStatus]);

  // Hydrate backend-created agents first, then merge any extra on-chain rows.
  const hydrateOnChainAgents = useCallback(async () => {
    setIsHydratingAgents(true);
    try {
      if (!account?.address) {
        setOnChainRows([]);
        return;
      }
      const localRecords = listAgents(account.address);
      const backendAgents = await fetchBackendAgents();
      if (!isValidAddress(contractAddress)) {
        setOnChainRows([]);
        return;
      }

      const onchainIds = await fetchPassportsOf(contractAddress, account.address);
      const backendIdStrings = new Set(backendAgents.map((x) => x.passportId).filter(Boolean));
      const localIdStrings = new Set(localRecords.map((x) => x.passportId));

      const orphanIds = onchainIds.filter((id) => {
        const idString = id.toString();
        return !backendIdStrings.has(idString) && !localIdStrings.has(idString);
      });

      const fetched = await Promise.all([
        ...backendAgents
          .filter((agent) => agent.passportId)
          .map(async (agent) => {
            const raw = await fetchPassportById(contractAddress, BigInt(agent.passportId));
            const passport = raw
              ? toDisplayPassport(raw)
              : {
                  owner: account.address,
                  agentId: agent.passportId,
                  score: BigInt(MIN_TRUST_SCORE),
                  active: true,
                  agentWallet: agent.walletAddress,
                };
            return {
              agentId: agent.name || agent.agentId,
              passportId: agent.passportId,
              passport: { ...passport, agentId: agent.name || passport.agentId },
              trusted: passport.active && Number(passport.score) >= MIN_TRUST_SCORE,
              progressPercent: deterministicPercent(agent.passportId),
              sourceLabel: `fuji · #${agent.passportId}`,
            } satisfies AgentRow;
          }),
        ...localRecords.map(async (rec) => {
          if (backendIdStrings.has(rec.passportId)) return null;
          const raw = await fetchPassportById(contractAddress, BigInt(rec.passportId));
          if (!raw) return null;
          const passport = toDisplayPassport(raw);
          return {
            agentId: rec.label || `agent-${rec.passportId}`,
            passportId: rec.passportId,
            passport: { ...passport, agentId: rec.label || passport.agentId },
            trusted: passport.active && Number(passport.score) >= MIN_TRUST_SCORE,
            progressPercent: deterministicPercent(rec.passportId),
            sourceLabel: `fuji · #${rec.passportId}`,
            agentPrivateKey: rec.privateKey
          } satisfies AgentRow;
        }),
        ...orphanIds.map(async (id) => {
          const raw = await fetchPassportById(contractAddress, id);
          if (!raw) return null;
          const passport = toDisplayPassport(raw);
          if (!passport.active) return null;
          return {
            agentId: `passport-${id.toString()}`,
            passportId: id.toString(),
            passport,
            trusted: passport.active && Number(passport.score) >= MIN_TRUST_SCORE,
            progressPercent: deterministicPercent(id.toString()),
            sourceLabel: `fuji · #${id.toString()}`
          } satisfies AgentRow;
        })
      ]);

      setOnChainRows(fetched.filter((x): x is AgentRow => x !== null));
    } catch {
      const backendAgents = await fetchBackendAgents();
      const ownerAddress = account?.address;
      if (!ownerAddress) {
        setOnChainRows([]);
        return;
      }
      setOnChainRows(
        backendAgents
          .filter((agent) => agent.passportId)
          .map((agent) => ({
            agentId: agent.name || agent.agentId,
            passportId: agent.passportId,
            passport: {
              owner: ownerAddress,
              agentId: agent.name,
              score: BigInt(MIN_TRUST_SCORE),
              active: true,
              agentWallet: agent.walletAddress,
            },
            trusted: true,
            progressPercent: deterministicPercent(agent.passportId),
            sourceLabel: `fuji · #${agent.passportId}`,
          })),
      );
    } finally {
      setIsHydratingAgents(false);
    }
  }, [account?.address, contractAddress]);

  useEffect(() => {
    setError(null);
    hydrateOnChainAgents().catch(() => {
      setError("Couldn't reach Fuji RPC for on-chain agents — showing local data only.");
    });
  }, [hydrateOnChainAgents]);

  async function handleCreateAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await mintHook.mint(agentLabel);
      setAgentLabel("");
      await hydrateOnChainAgents();
    } catch {
      // mintHook.state already carries the error message
    }
  }

  async function handleLogout() {
    // Clear the SIWE JWT cookie too — wallet-only disconnect leaves it dangling
    // and any future authenticated API call would still see the old session.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort — proceed with wallet disconnect regardless
    }
    if (wallet) disconnect(wallet);
    router.replace("/login");
  }

  if (walletStatus === "connecting" || walletStatus === "unknown") {
    return <FullPageMessage>Connecting wallet…</FullPageMessage>;
  }
  if (walletStatus === "connected" && !account?.address) {
    return <FullPageMessage>Preparing account…</FullPageMessage>;
  }
  if (!account?.address) {
    return <FullPageMessage>Redirecting to connect…</FullPageMessage>;
  }

  const walletAddress = account.address;
  const onFuji = chain?.id === avalancheFuji.id;
  const ownerAvatar = avatarStyle(walletAddress);

  return (
    <main className="min-h-screen">
      <Header
        walletAddress={walletAddress}
        ownerAvatarStyle={ownerAvatar}
        ownerInitials={avatarInitials(walletAddress)}
        onFuji={onFuji}
        chainName={chain?.name}
        contractAddress={contractAddress}
        contractSource={contractAddressSource}
        canCreate={isValidAddress(contractAddress)}
        onCreate={() => setActiveTab("create")}
        onProfile={() => setActiveTab("profile")}
        onLogout={handleLogout}
      />

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 pb-24">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="mt-2 text-[26px] md:text-[30px] font-semibold tracking-[-0.02em]">Agent Passport</h1>
          <p className="mt-2 text-[14px] text-muted">
            Create on-chain passports for AI agents and watch their reputation evolve on Avalanche Fuji.
          </p>
        </div>

        <Tabs
          tabs={[
            { id: "monitor", label: "Monitor" },
            { id: "create", label: "Create" },
            { id: "profile", label: "Profile" }
          ]}
          active={activeTab}
          onSelect={(t) => setActiveTab(t as typeof activeTab)}
          rightSlot={
            error ? (
              <span className="chip" style={{ borderColor: "rgba(251,113,133,0.35)", color: "#fda4af" }}>
                <span className="chip-dot" style={{ backgroundColor: "#fb7185" }} />
                {error}
              </span>
            ) : null
          }
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={tabVariant.initial}
            animate={tabVariant.animate}
            exit={tabVariant.exit}
          >
            {activeTab === "monitor" && (
              <MonitorTab
                onChainRows={onChainRows}
                walletAddress={walletAddress}
                onCreate={() => setActiveTab("create")}
                hasContract={true}
                isLoading={isHydratingAgents}
                onRevoked={hydrateOnChainAgents}
              />
            )}

            {activeTab === "create" && (
              <CreateTab
                walletAddress={walletAddress}
                agentLabel={agentLabel}
                setAgentLabel={setAgentLabel}
                onSubmit={handleCreateAgent}
                createState={mintHook.state}
                contractAddress={mintHook.contractAddress}
                onGoToMonitor={() => setActiveTab("monitor")}
              />
            )}

            {activeTab === "profile" && (
              <ProfileTab
                walletAddress={walletAddress}
                linkedEmail={linkedEmail}
                chainName={chain?.name}
                chainId={chain?.id}
                balanceLoading={walletBalanceQuery.isLoading}
                balanceText={
                  walletBalanceQuery.data
                    ? `${walletBalanceQuery.data.displayValue} ${walletBalanceQuery.data.symbol}`
                    : null
                }
                contractAddress={contractAddress}
                contractSource={contractAddressSource}
                ownerAvatarStyle={ownerAvatar}
                ownerInitials={avatarInitials(walletAddress)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </main>
  );
}

// ───────────────────────────── Header ─────────────────────────────

function Header({
  walletAddress,
  ownerAvatarStyle,
  ownerInitials,
  onFuji,
  chainName,
  contractAddress,
  contractSource,
  canCreate,
  onCreate,
  onProfile,
  onLogout
}: {
  walletAddress: string;
  ownerAvatarStyle: ReturnType<typeof avatarStyle>;
  ownerInitials: string;
  onFuji: boolean;
  chainName: string | undefined;
  contractAddress: string;
  contractSource: ContractAddressSource;
  canCreate: boolean;
  onCreate: () => void;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const networkLabel = onFuji ? "Avalanche Fuji" : chainName || "Wrong network";
  const networkDot = onFuji ? "#34d399" : "#fbbf24";
  const contractUrl = contractAddress ? snowtraceAddressUrl(contractAddress) : null;
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(7,8,10,0.72)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <div
            className="h-6 w-6 rounded-md"
            style={{
              background:
                "conic-gradient(from 210deg, #34d399, #38bdf8, #a78bfa, #34d399)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)"
            }}
            aria-hidden
          />
          <span className="text-[13.5px] font-medium tracking-tight">Agent Passport</span>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-4">
          <span className="chip">
            <span className="chip-dot" style={{ backgroundColor: networkDot }} />
            {networkLabel}
          </span>
          {contractUrl ? (
            <a
              className="chip hover:border-white/20 hover:text-fg transition-colors"
              href={contractUrl}
              target="_blank"
              rel="noreferrer"
              title="View contract on Snowtrace"
            >
              <span className="chip-dot" style={{ backgroundColor: "#34d399" }} />
              {`Contract ${shortenAddress(contractAddress)}${contractSource === "local" ? " · local" : ""}`}
            </a>
          ) : (
            <span className="chip">
              <span className="chip-dot" style={{ backgroundColor: "#52525b" }} />
              Contract not deployed
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={onProfile} className="btn btn-ghost focus-ring">
            <AvalancheIcon />
            <span className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-semibold text-white/95 font-mono" style={ownerAvatarStyle}>
              {ownerInitials}
            </span>
            <span className="hidden sm:inline font-mono text-[12px]">{shortenAddress(walletAddress)}</span>
          </button>
          <button onClick={onLogout} className="btn btn-secondary focus-ring text-[12px]">
            Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}

function AvalancheIcon() {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-md bg-[#E84142] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
      aria-label="Avalanche"
      title="Avalanche"
    >
      <svg viewBox="0 0 64 64" className="h-3.5 w-3.5" aria-hidden>
        <path
          fill="#fff"
          d="M30.1 14.4c.8-1.4 2.9-1.4 3.7 0l16.4 28.4c.8 1.4-.2 3.2-1.9 3.2H15.7c-1.7 0-2.7-1.8-1.9-3.2l16.3-28.4Zm1.9 7.5L21.2 40.7h21.6L32 21.9Zm10.5 9.8c.8-1.4 2.9-1.4 3.7 0l6.4 11.1c.8 1.4-.2 3.2-1.9 3.2H37.9c-1.7 0-2.7-1.8-1.9-3.2l6.5-11.1Z"
        />
      </svg>
    </span>
  );
}

// ───────────────────────────── Tabs ─────────────────────────────

function Tabs({
  tabs,
  active,
  onSelect,
  rightSlot
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="mt-10 flex items-end justify-between gap-3 border-b border-white/[0.06]">
      <nav className="flex items-end gap-6">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="relative rounded-sm pb-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
            >
              <span className={isActive ? "text-fg" : "text-muted hover:text-fg transition-colors"}>{t.label}</span>
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-accent" aria-hidden />
              )}
            </button>
          );
        })}
      </nav>
      {rightSlot && <div className="pb-2">{rightSlot}</div>}
    </div>
  );
}

// ───────────────────────────── Monitor ─────────────────────────────

function MonitorTab({
  onChainRows,
  walletAddress,
  onCreate,
  hasContract,
  isLoading,
  onRevoked,
}: {
  onChainRows: AgentRow[];
  walletAddress: string;
  onCreate: () => void;
  hasContract: boolean;
  isLoading: boolean;
  onRevoked?: () => void;
}) {
  const hasRows = onChainRows.length > 0;
  return (
    <div className="mt-8">
      <Section
        eyebrow="Your agents"
        title={
          isLoading
            ? "Loading agents…"
            : hasRows
              ? `${onChainRows.length} on-chain passport${onChainRows.length === 1 ? "" : "s"}`
              : "No agents yet"
        }
        subtitle={
          isLoading
            ? "Fetching on-chain passports from Avalanche Fuji."
            : onChainRows.length === 0
            ? "Create a passport for your first agent on Avalanche Fuji."
            : `Owned by ${shortenAddress(walletAddress)}`
        }
        action={hasRows ?
          <button onClick={onCreate} className="btn btn-primary focus-ring">
            New agent
          </button> : null
        }
      >
        {isLoading ? (
          <AgentCardSkeletonGrid />
        ) : onChainRows.length > 0 ? (
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]"
          >
            {onChainRows.map((row) => (
              <AgentCard
                key={`onchain-${row.passportId}`}
                agentId={row.agentId}
                passport={row.passport}
                trusted={row.trusted}
                progressPercent={row.progressPercent}
                sourceLabel={row.sourceLabel}
                passportId={row.passportId}
                agentPrivateKey={row.agentPrivateKey}
                onRevoked={onRevoked}
              />
            ))}
          </motion.div>
        ) : (
          <EmptyState hasContract={hasContract} onCreate={onCreate} />
        )}
      </Section>
    </div>
  );
}

function AgentCardSkeletonGrid() {
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={`agent-card-skeleton-${idx}`} className="card p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.10]" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-3/4 rounded bg-white/[0.10]" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-white/[0.08]" />
            </div>
            <div className="w-12">
              <div className="h-5 w-10 rounded bg-white/[0.10] ml-auto" />
              <div className="mt-2 h-2 w-8 rounded bg-white/[0.08] ml-auto" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-14 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-8 rounded bg-white/[0.08]" />
            </div>
            <div className="mt-2 h-[3px] w-full rounded-full bg-white/[0.08]" />
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-2.5 w-10 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-28 rounded bg-white/[0.08]" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="h-2.5 w-10 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-24 rounded bg-white/[0.08]" />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <div className="h-7 w-24 rounded-md bg-white/[0.08]" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function fetchBackendAgents(): Promise<BackendAgent[]> {
  try {
    const res = await fetch("/api/agents/list", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { agents?: BackendAgent[] };
    return Array.isArray(data.agents) ? data.agents : [];
  } catch {
    return [];
  }
}

function EmptyState({ hasContract, onCreate }: { hasContract: boolean; onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="card block w-full p-8 text-center transition-colors hover:border-white/15 hover:bg-white/[0.035] focus-ring"
    >
      <div className="mx-auto h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-4 text-[14px] text-fg font-medium">
        {hasContract ? "Create your first passport" : "Deploy passport contract"}
      </div>
      <div className="mt-1 text-[12.5px] text-muted">
        {hasContract
          ? "Set up your first agent with a verifiable on-chain passport."
          : "Deploy the Agent Passport contract to Avalanche Fuji using test AVAX."}
      </div>
    </button>
  );
}
// ───────────────────────────── Create ─────────────────────────────

const CREATE_TAB_TOOL_OPTIONS: { value: string; label: string }[] = [
  { value: "scraper", label: "Scraper" },
  { value: "summarizer", label: "Summarizer" },
  { value: "logger", label: "Logger" },
];

function CreateTab({
  walletAddress,
  agentLabel,
  setAgentLabel,
  onSubmit,
  createState,
  contractAddress,
  onGoToMonitor
}: {
  walletAddress: string;
  agentLabel: string;
  setAgentLabel: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  createState: MintState;
  contractAddress: string;
  onGoToMonitor: () => void;
}) {
  const noticeVariant = useMotionVariant(fadeUp);
  // Visual-only: kept here for the demo form but not submitted anywhere.
  const [purpose, setPurpose] = useState("");
  const [tools, setTools] = useState<string[]>(["scraper"]);
  const isWorking =
    createState.phase !== "idle" &&
    createState.phase !== "success" &&
    createState.phase !== "error";
  const showError = createState.phase === "error";
  const ctaLabel =
    createState.phase === "creating"
      ? "Creating passport…"
      : "Create passport";

  const toggleTool = (value: string) => {
    setTools((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  };

  return (
    <div className="mt-8 grid gap-6">
      <div className="card p-6">
        <div className="eyebrow">Create passport</div>
        <h2 className="mt-2 text-[18px] font-semibold tracking-tight">Create agent passport</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          Set up a named agent with a verifiable on-chain passport on Avalanche Fuji.
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="agentLabel" className="block text-[12px] text-subtle mb-1.5">
              Agent label
            </label>
            <input
              id="agentLabel"
              value={agentLabel}
              onChange={(e) => setAgentLabel(e.target.value)}
              placeholder="research-agent"
              className="input focus-ring"
            />
            <p className="mt-1.5 text-[11.5px] text-faint">
              Optional — stored in <span className="font-mono">metadataURI</span>. Leave blank to auto-name.
            </p>
          </div>

          <div>
            <label htmlFor="agentPurpose" className="block text-[12px] text-subtle mb-1.5">
              Purpose
            </label>
            <textarea
              id="agentPurpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Summarize trending repos every morning and post to #standup."
              rows={3}
              className="input focus-ring resize-y min-h-[72px]"
            />
            <p className="mt-1.5 text-[11.5px] text-faint">
              What this agent does. Surfaced in trust reports and audit logs.
            </p>
          </div>

          <div>
            <span className="block text-[12px] text-subtle mb-1.5">Tools</span>
            <div className="flex flex-wrap gap-1.5">
              {CREATE_TAB_TOOL_OPTIONS.map((opt) => {
                const selected = tools.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleTool(opt.value)}
                    aria-pressed={selected}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium border transition focus-ring",
                      selected
                        ? "border-emerald-400/40 bg-emerald-500/[0.10] text-emerald-200"
                        : "border-white/[0.08] bg-white/[0.03] text-muted hover:border-white/15 hover:text-fg",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        selected ? "bg-emerald-400" : "bg-white/20",
                      ].join(" ")}
                      aria-hidden
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-faint">
              Which capabilities the agent advertises.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isWorking}
              className="btn btn-primary focus-ring"
            >
              {isWorking ? <Spinner /> : null}
              {isWorking ? ctaLabel : "Create passport"}
            </button>
            <span className="text-[11.5px] text-faint font-mono">
              owner · {shortenAddress(walletAddress)}
            </span>
          </div>
        </form>

        <AnimatePresence>
          {createState.message && (
            <motion.div
              key={createState.message}
              initial={noticeVariant.initial}
              animate={noticeVariant.animate}
              exit={noticeVariant.exit}
            >
              <Notice tone={showError ? "error" : "success"} className="mt-5">
                {createState.message}
              </Notice>
            </motion.div>
          )}
        </AnimatePresence>

        {createState.phase === "creating" && (
          <PassportCreatingLoader
            title="Minting your new passport"
            subtitle="Backend is creating wallet, funding it, and finalizing mint..."
          />
        )}

        {createState.lastCreated && (
          <LatestPassport record={createState.lastCreated} contractAddress={contractAddress} onGoToMonitor={onGoToMonitor} />
        )}
      </div>
    </div>
  );
}

function LatestPassport({ record, contractAddress, onGoToMonitor }: { record: AgentRecord; contractAddress: string; onGoToMonitor: () => void }) {
  return (
    <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white/95 font-mono"
          style={avatarStyle(record.agentAddress)}
        >
          {avatarInitials(record.agentAddress)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-fg">
            <span className="font-mono text-faint">#{record.passportId}</span> · {record.label}
          </div>
          <div className="font-mono text-[11.5px] text-faint">{shortenAddress(record.agentAddress)}</div>
        </div>
        <div className="flex items-center gap-2">
          {record.privateKey && (
            <button
              onClick={() => downloadAgentBackup(record, contractAddress)}
              className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5"
            >
              Download backup
            </button>
          )}
          <button
            onClick={onGoToMonitor}
            className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5"
          >
            View agents →
          </button>
        </div>
      </div>
      {record.mintTxHash && (
        <div className="mt-3 text-[11.5px] text-faint font-mono">
          tx · {shortenAddress(record.mintTxHash, 6, 6)}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Profile ─────────────────────────────

function ProfileTab({
  walletAddress,
  linkedEmail,
  chainName,
  chainId,
  balanceLoading,
  balanceText,
  contractAddress,
  contractSource,
  ownerAvatarStyle,
  ownerInitials
}: {
  walletAddress: string;
  linkedEmail: string | null;
  chainName: string | undefined;
  chainId: number | undefined;
  balanceLoading: boolean;
  balanceText: string | null;
  contractAddress: string;
  contractSource: ContractAddressSource;
  ownerAvatarStyle: ReturnType<typeof avatarStyle>;
  ownerInitials: string;
}) {
  const contractUrl = contractAddress ? snowtraceAddressUrl(contractAddress) : null;
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <div className="card p-6 md:col-span-1">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center text-[14px] font-semibold text-white/95 font-mono"
          style={ownerAvatarStyle}
        >
          {ownerInitials}
        </div>
        <div className="mt-4 text-[15px] text-fg font-medium">Connected wallet</div>
        <div className="mt-1 font-mono text-[12px] text-muted break-all">{walletAddress}</div>
      </div>

      <div className="card p-6 md:col-span-2 grid gap-4 sm:grid-cols-2">
        <Field label="Linked email" value={linkedEmail || "—"} />
        <Field
          label="Active chain"
          value={chainName ? `${chainName} · ${chainId}` : "—"}
        />
        <Field label="Wallet balance" value={balanceLoading ? "Loading…" : balanceText || "Unavailable"} />
        <Field
          label="Passport contract"
          value={contractAddress || "Not deployed"}
          href={contractUrl ?? undefined}
          mono
          subtitle={
            contractSource === "env"
              ? "from NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS"
              : contractSource === "deployment"
                ? "from packages/contracts/deployments.json"
              : contractSource === "local"
                ? "deployed from this browser"
                : ""
          }
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  href,
  mono,
  subtitle
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      {href ? (
        <a
          className={["mt-1 block text-[13px] text-fg break-all underline decoration-white/20 underline-offset-4 hover:decoration-white/60", mono ? "font-mono" : ""].join(" ")}
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {value}
        </a>
      ) : (
        <div className={["mt-1 text-[13px] text-fg break-all", mono ? "font-mono" : ""].join(" ")}>{value}</div>
      )}
      {subtitle && <div className="mt-0.5 text-[11.5px] text-faint">{subtitle}</div>}
    </div>
  );
}

// ───────────────────────────── Atoms ─────────────────────────────

function Section({
  eyebrow,
  title,
  subtitle,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Notice({
  tone,
  children,
  className
}: {
  tone: "success" | "error";
  children: ReactNode;
  className?: string;
}) {
  const styles =
    tone === "success"
      ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200"
      : "border-rose-400/25 bg-rose-400/[0.06] text-rose-200";
  return (
    <div className={["rounded-lg border px-3 py-2 text-[12.5px]", styles, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin"
    />
  );
}

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-32 text-center text-muted text-[13px]">{children}</div>
    </main>
  );
}
