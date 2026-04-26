"use client";

import { useState } from "react";
import { prepareTransaction } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSendTransaction,
  useSwitchActiveWalletChain,
} from "thirdweb/react";

import { fetchPlatformAddress } from "@/lib/agentPassport";
import { DEPLOYED_AGENT_PASSPORT_ADDRESS } from "@/lib/chain/deployedAddresses";
import { mintApprovalData } from "@/lib/mintApproval";
import { getThirdwebClient } from "@/lib/thirdwebClient";

type Phase = "idle" | "provisioning" | "saving" | "skipping" | "error";

const PUBLIC_AGENT_PASSPORT_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || DEPLOYED_AGENT_PASSPORT_ADDRESS;

type ApiError = {
  error?: string;
  step?: "wallet" | "funding" | "mint";
  reason?: "insufficient_avax";
  available?: string;
  required?: string;
  details?: unknown;
};

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function StepMint({
  username,
  onComplete,
}: {
  username: string;
  onComplete: () => void;
}) {
  const defaultName = `${username || "my"}-agent-1`;
  const client = getThirdwebClient();
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });
  const [name, setName] = useState(defaultName);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // If provisioning succeeded but `/onboarding/complete` failed, retry only the
  // second call — we don't want to mint a second on-chain passport.
  const [provisioned, setProvisioned] = useState(false);

  const isWorking = phase === "provisioning" || phase === "saving" || phase === "skipping";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isWorking) return;
    setErrorMessage(null);

    try {
      if (!provisioned) {
        setPhase("provisioning");
        if (!client || !account) throw new Error("Connect a wallet first.");
        if (chain?.id !== avalancheFuji.id) {
          await switchChain(avalancheFuji);
        }
        const agentName = name.trim() || defaultName;
        if (!isValidAddress(PUBLIC_AGENT_PASSPORT_ADDRESS)) {
          throw new Error(
            "Passport contract is not configured. Set NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS or sync packages/contracts/deployments.json.",
          );
        }
        const platformLookup = await fetchPlatformAddress(PUBLIC_AGENT_PASSPORT_ADDRESS);
        if (!platformLookup.ok) throw new Error(platformLookup.message);
        const approval = await sendTx(
          prepareTransaction({
            client,
            chain: avalancheFuji,
            to: platformLookup.platformAddress,
            value: 0n,
            data: mintApprovalData(account.address, agentName),
          }),
        );
        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agentName,
            purpose: "Help me explore Agent Passport.",
            tools: ["scraper", "summarizer"],
            mintApprovalTxHash: approval.transactionHash,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as ApiError;
          throw new Error(mapApiErrorToUserMessage(res.status, data));
        }
        setProvisioned(true);
      }

      setPhase("saving");
      const finish = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(username ? { username } : {}),
      });
      if (!finish.ok) {
        const data = (await finish.json().catch(() => ({}))) as ApiError;
        throw new Error(mapApiErrorToUserMessage(finish.status, data));
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setPhase("error");
      setErrorMessage(msg);
    }
  }

  async function handleSkip() {
    if (isWorking) return;
    setErrorMessage(null);
    setPhase("skipping");
    try {
      const finish = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(username ? { username } : {}),
      });
      if (!finish.ok) {
        const data = (await finish.json().catch(() => ({}))) as ApiError;
        throw new Error(mapApiErrorToUserMessage(finish.status, data));
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setPhase("error");
      setErrorMessage(msg);
    }
  }

  const phaseLabel: Record<Phase, string> = {
    idle: "Create passport",
    provisioning: "Provisioning agent…",
    saving: "Finishing up…",
    skipping: "Skipping…",
    error: "Retry",
  };

  return (
    <form className="p-6" onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-semibold tracking-tight">Create your first agent</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        You&apos;ll approve the mint with a zero-value Fuji transaction; the platform funds the agent.
      </p>

      <label htmlFor="name" className="mt-5 block text-[12px] text-subtle">
        Agent name
      </label>
      <input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input focus-ring mt-1.5"
        disabled={isWorking || provisioned}
        maxLength={40}
      />

      <div className="mt-2 h-4 text-[11.5px] text-muted">
        {phase === "provisioning"
          ? "Confirming wallet approval, creating wallet, funding, creating passport…"
          : phase === "saving"
            ? "Saving your profile…"
            : phase === "skipping"
              ? "Wrapping up…"
              : "Single-tap setup."}
      </div>

      {phase === "error" && errorMessage && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isWorking}
          className="text-[12.5px] text-primary underline-offset-4 hover:text-default hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        <button type="submit" disabled={isWorking} className="btn btn-primary focus-ring">
          {phaseLabel[phase]}
        </button>
      </div>
    </form>
  );
}

function mapApiErrorToUserMessage(status: number, data: ApiError): string {
  if (status === 401) return "Your session expired. Please refresh the page and try again.";
  if (data.error === "invalid_mint_approval") return "Mint approval could not be verified. Please try again.";
  if (data.error === "missing_wallet") return "Your session is missing a wallet address. Please sign in again.";

  if (data.error === "provisioning_failed") {
    if (data.step === "wallet") return "We couldn't create your agent wallet. Please try again.";
    if (data.step === "funding") {
      if (data.reason === "insufficient_avax") {
        return `Our faucet needs Fuji AVAX before it can finish onboarding. Available: ${data.available ?? "0"} AVAX; required: ${data.required ?? "0.05"} AVAX.`;
      }
      return "Our faucet is temporarily unavailable. Please try again in a moment.";
    }
    if (data.step === "mint") return "Passport creation failed on-chain. Please try again.";
    return "Agent setup failed. Please try again.";
  }

  if (data.error === "username_taken") return "That username was just taken. Go back and choose another.";
  if (data.error === "invalid_username") return "Username must be 3–20 lowercase letters, numbers, or underscores.";

  if (status >= 500) return "Something went wrong on our end. Please try again.";

  return "Something went wrong. Please try again.";
}
