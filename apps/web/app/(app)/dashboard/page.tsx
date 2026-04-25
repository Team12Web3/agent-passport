"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getContract, prepareContractCall, waitForReceipt, type ThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import { deployContract } from "thirdweb/deploys";
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
import {
  AGENT_PASSPORT_ABI,
  AGENT_PASSPORT_BYTECODE,
  fetchPassportById,
  fetchPassportsOf,
  parsePassportMintedFromLogs,
  toDisplayPassport,
  type Passport
} from "@/lib/agentPassport";
import {
  downloadAgentBackup,
  generateAgent,
  getStoredContractAddress,
  listAgents,
  saveAgent,
  setStoredContractAddress,
  type AgentRecord
} from "@/lib/agentKeys";
import { AgentCard } from "@/components/agents/AgentCard";
import { deterministicPercent, shortenAddress } from "@/lib/utils";
import { avatarInitials, avatarStyle } from "@/lib/avatar";
import { getThirdwebClient } from "@/lib/thirdwebClient";

type AgentRow = {
  agentId: string;
  passport: Passport;
  trusted: boolean;
  progressPercent: number;
  sourceLabel: string;
};

const MIN_TRUST_SCORE = 50;
const FUJI_FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && addr.startsWith("0x") && addr.length === 42;
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
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });
  const profilesQuery = useProfiles({ client });
  const walletBalanceQuery = useWalletBalance({
    client,
    address: account?.address,
    chain: chain ?? avalancheFuji
  });

  // Contract address resolution: env > localStorage (post-deploy) > none.
  const envContractAddress = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";
  const [storedContractAddress, setStoredContractAddressState] = useState<string | null>(null);
  useEffect(() => {
    setStoredContractAddressState(getStoredContractAddress());
  }, []);
  const contractAddress = useMemo(() => {
    if (isValidAddress(envContractAddress)) return envContractAddress;
    if (isValidAddress(storedContractAddress)) return storedContractAddress;
    return "";
  }, [envContractAddress, storedContractAddress]);
  const contractAddressSource: "env" | "local" | "none" = isValidAddress(envContractAddress)
    ? "env"
    : isValidAddress(storedContractAddress)
      ? "local"
      : "none";

  const [createdAgents, setCreatedAgents] = useState<AgentRecord[]>([]);
  const [onChainRows, setOnChainRows] = useState<AgentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "create" | "profile">("monitor");
  const [agentLabel, setAgentLabel] = useState("");
  const [createState, setCreateState] = useState<{
    loading: boolean;
    message: string | null;
    ok: boolean;
    lastCreated?: AgentRecord;
  }>({ loading: false, message: null, ok: false });

  const [deployState, setDeployState] = useState<{ loading: boolean; message: string | null; ok: boolean }>({
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

  // Hydrate on-chain agents for the current owner.
  const hydrateOnChainAgents = useCallback(async () => {
    if (!account?.address) {
      setCreatedAgents([]);
      setOnChainRows([]);
      return;
    }
    const localRecords = listAgents(account.address);
    setCreatedAgents(localRecords);

    if (!isValidAddress(contractAddress)) {
      setOnChainRows([]);
      return;
    }

    try {
      const onchainIds = await fetchPassportsOf(contractAddress, account.address);
      const idStrings = new Set(onchainIds.map((x) => x.toString()));

      const knownLocal = localRecords.filter((r) => idStrings.has(r.passportId));
      const orphanIds = onchainIds.filter((id) => !localRecords.some((r) => r.passportId === id.toString()));

      const fetched = await Promise.all([
        ...knownLocal.map(async (rec) => {
          const raw = await fetchPassportById(contractAddress, BigInt(rec.passportId));
          if (!raw) return null;
          const passport = toDisplayPassport(raw);
          return {
            agentId: rec.label || `agent-${rec.passportId}`,
            passport: { ...passport, agentId: rec.label || passport.agentId },
            trusted: passport.active && Number(passport.score) >= MIN_TRUST_SCORE,
            progressPercent: deterministicPercent(rec.passportId),
            sourceLabel: `fuji · #${rec.passportId}`
          } satisfies AgentRow;
        }),
        ...orphanIds.map(async (id) => {
          const raw = await fetchPassportById(contractAddress, id);
          if (!raw) return null;
          const passport = toDisplayPassport(raw);
          return {
            agentId: `passport-${id.toString()}`,
            passport,
            trusted: passport.active && Number(passport.score) >= MIN_TRUST_SCORE,
            progressPercent: deterministicPercent(id.toString()),
            sourceLabel: `fuji · #${id.toString()}`
          } satisfies AgentRow;
        })
      ]);

      setOnChainRows(fetched.filter((x): x is AgentRow => x !== null));
    } catch {
      setOnChainRows([]);
    }
  }, [account?.address, contractAddress]);

  useEffect(() => {
    setError(null);
    hydrateOnChainAgents().catch(() => {
      setError("Couldn't reach Fuji RPC for on-chain agents — showing local data only.");
    });
  }, [hydrateOnChainAgents]);

  async function ensureFujiChain(): Promise<void> {
    if (chain?.id === avalancheFuji.id) return;
    try {
      await switchChain(avalancheFuji);
    } catch {
      throw new Error("Could not switch network to Avalanche Fuji (43113). Please switch in your wallet and try again.");
    }
  }

  async function handleDeployContract() {
    if (!account) {
      setDeployState({ loading: false, message: "Connect a wallet first.", ok: false });
      return;
    }
    try {
      setDeployState({ loading: true, message: "Confirm the deploy in your wallet…", ok: true });
      await ensureFujiChain();
      const address = await deployContract({
        client,
        chain: avalancheFuji,
        account,
        abi: AGENT_PASSPORT_ABI as never,
        bytecode: AGENT_PASSPORT_BYTECODE as `0x${string}`,
        constructorParams: {}
      });
      setStoredContractAddress(address);
      setStoredContractAddressState(address);
      setDeployState({
        loading: false,
        message: `Contract deployed at ${address}.`,
        ok: true
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Deploy failed. You may need a small amount of Fuji AVAX for gas.";
      setDeployState({ loading: false, message: msg, ok: false });
    }
  }

  async function handleCreateAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) {
      setCreateState({ loading: false, message: "Connect a wallet first.", ok: false });
      return;
    }
    if (!isValidAddress(contractAddress)) {
      setCreateState({
        loading: false,
        message: "No AgentPassport contract is set yet. Deploy it first.",
        ok: false
      });
      return;
    }

    const label = agentLabel.trim() || `agent-${Date.now().toString(36)}`;

    try {
      setCreateState({ loading: true, message: "Generating agent keypair…", ok: true });
      const generated = generateAgent();

      await ensureFujiChain();

      setCreateState({ loading: true, message: "Confirm the mint in your wallet…", ok: true });

      const contract = getContract({
        address: contractAddress,
        chain: avalancheFuji,
        client
      });

      const tx = prepareContractCall({
        contract,
        method: "function mintPassport(address agentWallet, string metadataURI) returns (uint256)",
        params: [generated.address, JSON.stringify({ label, createdAt: new Date().toISOString() })]
      });

      const sent = await sendTx(tx);

      setCreateState({ loading: true, message: "Waiting for Fuji confirmation…", ok: true });
      const receipt = await waitForReceipt({
        client,
        chain: avalancheFuji,
        transactionHash: sent.transactionHash
      });

      const minted = parsePassportMintedFromLogs(receipt.logs ?? [], contractAddress);
      if (!minted) {
        throw new Error("Mint succeeded but PassportMinted event was not found in receipt logs.");
      }

      const record = saveAgent({
        passportId: minted.id.toString(),
        agentAddress: generated.address,
        privateKey: generated.privateKey,
        ownerAddress: account.address,
        label,
        mintTxHash: receipt.transactionHash
      });

      await hydrateOnChainAgents();

      setCreateState({
        loading: false,
        message: `Passport #${record.passportId} minted for ${label}.`,
        ok: true,
        lastCreated: record
      });
      setAgentLabel("");
      setActiveTab("monitor");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mint failed, was rejected, or you may need Fuji AVAX for gas.";
      setCreateState({ loading: false, message: msg, ok: false });
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
  const showDeployBox = contractAddressSource !== "env";

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
        onProfile={() => setActiveTab("profile")}
        onLogout={handleLogout}
      />

      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-10 pb-24">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="mt-2 text-[26px] md:text-[30px] font-semibold tracking-[-0.02em]">Agent Passport</h1>
          <p className="mt-2 text-[14px] text-muted">
            Mint on-chain identities for AI agents and watch their reputation evolve on Avalanche Fuji.
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

        {activeTab === "monitor" && (
          <MonitorTab
            onChainRows={onChainRows}
            walletAddress={walletAddress}
            onCreate={() => setActiveTab("create")}
            hasContract={isValidAddress(contractAddress)}
          />
        )}

        {activeTab === "create" && (
          <CreateTab
            walletAddress={walletAddress}
            agentLabel={agentLabel}
            setAgentLabel={setAgentLabel}
            onSubmit={handleCreateAgent}
            createState={createState}
            hasContract={isValidAddress(contractAddress)}
            createdAgents={createdAgents}
            contractAddress={contractAddress}
            showDeployBox={showDeployBox}
            storedContractAddress={storedContractAddress}
            onDeploy={handleDeployContract}
            deployState={deployState}
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
  onProfile,
  onLogout
}: {
  walletAddress: string;
  ownerAvatarStyle: ReturnType<typeof avatarStyle>;
  ownerInitials: string;
  onFuji: boolean;
  chainName: string | undefined;
  contractAddress: string;
  contractSource: "env" | "local" | "none";
  onProfile: () => void;
  onLogout: () => void;
}) {
  const networkLabel = onFuji ? "Avalanche Fuji" : chainName || "Wrong network";
  const networkDot = onFuji ? "#34d399" : "#fbbf24";
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
          <span className="chip">
            <span className="chip-dot" style={{ backgroundColor: contractAddress ? "#34d399" : "#52525b" }} />
            {contractAddress
              ? `Contract ${shortenAddress(contractAddress)}${contractSource === "local" ? " · local" : ""}`
              : "Contract not deployed"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={onProfile} className="btn btn-ghost focus-ring">
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
              className="relative pb-3 text-[13px] focus-ring rounded-sm"
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
  hasContract
}: {
  onChainRows: AgentRow[];
  walletAddress: string;
  onCreate: () => void;
  hasContract: boolean;
}) {
  return (
    <div className="mt-8">
      <Section
        eyebrow="Your agents"
        title={onChainRows.length === 0 ? "No agents yet" : `${onChainRows.length} on-chain passport${onChainRows.length === 1 ? "" : "s"}`}
        subtitle={
          onChainRows.length === 0
            ? "Mint a passport to bind your wallet to a fresh agent EOA on Avalanche Fuji."
            : `Owned by ${shortenAddress(walletAddress)}`
        }
        action={
          <button onClick={onCreate} className="btn btn-primary focus-ring">
            {onChainRows.length === 0 ? "Create your first agent" : "New agent"}
          </button>
        }
      >
        {onChainRows.length > 0 ? (
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {onChainRows.map((row) => (
              <AgentCard
                key={`onchain-${row.passport.agentId}`}
                agentId={row.agentId}
                passport={row.passport}
                trusted={row.trusted}
                progressPercent={row.progressPercent}
                sourceLabel={row.sourceLabel}
              />
            ))}
          </div>
        ) : (
          <EmptyState hasContract={hasContract} />
        )}
      </Section>
    </div>
  );
}

function EmptyState({ hasContract }: { hasContract: boolean }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-4 text-[14px] text-fg font-medium">
        {hasContract ? "Mint your first passport" : "Deploy the contract to begin"}
      </div>
      <div className="mt-1 text-[12.5px] text-muted">
        {hasContract
          ? "A fresh agent wallet is generated in your browser and bound to your owner address on chain."
          : "One-click deploy to Avalanche Fuji — costs a fraction of a cent in test AVAX."}
      </div>
    </div>
  );
}

// ───────────────────────────── Create ─────────────────────────────

function CreateTab({
  walletAddress,
  agentLabel,
  setAgentLabel,
  onSubmit,
  createState,
  hasContract,
  createdAgents,
  contractAddress,
  showDeployBox,
  storedContractAddress,
  onDeploy,
  deployState
}: {
  walletAddress: string;
  agentLabel: string;
  setAgentLabel: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  createState: { loading: boolean; message: string | null; ok: boolean; lastCreated?: AgentRecord };
  hasContract: boolean;
  createdAgents: AgentRecord[];
  contractAddress: string;
  showDeployBox: boolean;
  storedContractAddress: string | null;
  onDeploy: () => void;
  deployState: { loading: boolean; message: string | null; ok: boolean };
}) {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-5">
      <div className={["card p-6", showDeployBox ? "md:col-span-3" : "md:col-span-5"].join(" ")}>
        <div className="eyebrow">Mint</div>
        <h2 className="mt-2 text-[18px] font-semibold tracking-tight">Create agent passport</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          Generates a fresh EOA in your browser, then mints an on-chain passport that binds your wallet to the new agent.
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

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createState.loading || !hasContract}
              className="btn btn-primary focus-ring"
            >
              {createState.loading ? <Spinner /> : null}
              {createState.loading ? "Working…" : "Create & mint"}
            </button>
            <span className="text-[11.5px] text-faint font-mono">
              owner · {shortenAddress(walletAddress)}
            </span>
          </div>

          {!hasContract && (
            <div className="text-[12px] text-amber-300">
              Deploy the AgentPassport contract first (panel on the right).
            </div>
          )}
        </form>

        {createState.message && (
          <Notice tone={createState.ok ? "success" : "error"} className="mt-5">
            {createState.message}
          </Notice>
        )}

        {createState.lastCreated && (
          <LatestPassport record={createState.lastCreated} contractAddress={contractAddress} />
        )}
      </div>

      {showDeployBox && (
        <div className="card p-6 md:col-span-2">
          <div className="eyebrow">Setup</div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight">AgentPassport contract</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            {storedContractAddress
              ? "Deployed locally. Redeploy if you want a fresh contract."
              : "One-time deploy. Your wallet pays a fraction of a cent in test AVAX."}
          </p>

          <dl className="mt-5 space-y-2 text-[12px]">
            <KV k="Network" v={<span className="font-mono">Avalanche Fuji · 43113</span>} />
            <KV k="Bytecode" v={<span className="font-mono">{((AGENT_PASSPORT_BYTECODE.length - 2) / 2).toLocaleString()} bytes</span>} />
            {storedContractAddress && (
              <KV k="Address" v={<span className="font-mono">{shortenAddress(storedContractAddress)}</span>} />
            )}
          </dl>

          <button
            onClick={onDeploy}
            disabled={deployState.loading}
            className={["btn focus-ring mt-5", storedContractAddress ? "btn-secondary" : "btn-primary"].join(" ")}
          >
            {deployState.loading ? <Spinner /> : null}
            {deployState.loading ? "Deploying…" : storedContractAddress ? "Redeploy" : "Deploy contract"}
          </button>

          {deployState.message && (
            <Notice tone={deployState.ok ? "success" : "error"} className="mt-4">
              {deployState.message}
            </Notice>
          )}

          <p className="mt-4 text-[11.5px] text-faint">
            Need test AVAX?{" "}
            <a className="underline decoration-dotted underline-offset-2 hover:text-muted" href={FUJI_FAUCET_URL} target="_blank" rel="noreferrer">
              Avalanche Fuji faucet
            </a>
            .
          </p>
        </div>
      )}

      {createdAgents.length > 0 && (
        <div className="card p-6 md:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Local</div>
              <h3 className="mt-2 text-[16px] font-semibold tracking-tight">Agent keys in this browser</h3>
              <p className="mt-1 text-[12.5px] text-muted">Private keys never leave your browser. Download a backup if you want to keep one.</p>
            </div>
          </div>
          <div className="mt-5 divider" />
          <ul className="divide-y divide-white/[0.05]">
            {createdAgents.map((rec) => (
              <li key={rec.passportId} className="flex items-center gap-3 py-3 text-[13px]">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white/95 font-mono"
                  style={avatarStyle(rec.agentAddress)}
                >
                  {avatarInitials(rec.agentAddress)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-fg">
                    <span className="font-mono text-faint">#{rec.passportId}</span>{" "}
                    <span>{rec.label}</span>
                  </div>
                  <div className="font-mono text-[11.5px] text-faint">{shortenAddress(rec.agentAddress)}</div>
                </div>
                <button
                  onClick={() => downloadAgentBackup(rec, contractAddress)}
                  className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5"
                >
                  Backup
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LatestPassport({ record, contractAddress }: { record: AgentRecord; contractAddress: string }) {
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
        <button
          onClick={() => downloadAgentBackup(record, contractAddress)}
          className="btn btn-secondary focus-ring text-[11.5px] py-1.5 px-2.5"
        >
          Download backup
        </button>
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
  contractSource: "env" | "local" | "none";
  ownerAvatarStyle: ReturnType<typeof avatarStyle>;
  ownerInitials: string;
}) {
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
          mono
          subtitle={
            contractSource === "env"
              ? "from NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS"
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
  mono,
  subtitle
}: {
  label: string;
  value: string;
  mono?: boolean;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className={["mt-1 text-[13px] text-fg break-all", mono ? "font-mono" : ""].join(" ")}>{value}</div>
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

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-faint">{k}</dt>
      <dd className="text-muted text-right">{v}</dd>
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
