"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareTransaction, type ThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSendTransaction,
  useSwitchActiveWalletChain,
} from "thirdweb/react";

import { fetchPlatformAddress } from "@/lib/agentPassport";
import {
  getStoredContractAddress,
  saveAgent,
  type AgentRecord,
} from "@/lib/agentKeys";
import { DEPLOYED_AGENT_PASSPORT_ADDRESS } from "@/lib/chain/deployedAddresses";
import { mintApprovalData } from "@/lib/mintApproval";

export type MintPhase =
  | "idle"
  | "generating"
  | "deploying"
  | "minting"
  | "confirming"
  | "done"
  | "error";

export type MintState = {
  phase: MintPhase;
  message: string | null;
  lastCreated?: AgentRecord;
};

const ENV_CONTRACT = process.env.NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS || "";

type CreateAgentResponse = {
  agentId: string;
  passportId: string;
  walletAddress: `0x${string}`;
  fundingTxHash: `0x${string}`;
  mintTxHash: `0x${string}`;
};

type CreateAgentError = {
  error?: string;
  step?: "wallet" | "funding" | "mint";
  reason?: "insufficient_avax";
  available?: string;
  required?: string;
};

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function useMintPassport(client: ThirdwebClient) {
  void client;
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });

  const [storedContract, setStoredContract] = useState<string | null>(null);
  useEffect(() => {
    setStoredContract(getStoredContractAddress());
  }, []);

  const contractAddress = useMemo(() => {
    if (isValidAddress(ENV_CONTRACT)) return ENV_CONTRACT;
    if (isValidAddress(DEPLOYED_AGENT_PASSPORT_ADDRESS)) return DEPLOYED_AGENT_PASSPORT_ADDRESS;
    if (isValidAddress(storedContract)) return storedContract;
    return "";
  }, [storedContract]);

  const [state, setState] = useState<MintState>({ phase: "idle", message: null });

  const reset = useCallback(() => setState({ phase: "idle", message: null }), []);

  const ensureFuji = useCallback(async () => {
    if (chain?.id === avalancheFuji.id) return;
    try {
      await switchChain(avalancheFuji);
    } catch {
      throw new Error("Switch your wallet network to Avalanche Fuji (43113) and try again.");
    }
  }, [chain?.id, switchChain]);

  const ensureContract = useCallback(async (): Promise<string> => {
    if (isValidAddress(contractAddress)) return contractAddress;
    throw new Error("Passport contract is not configured. Deploy contracts and update deployments.json.");
  }, [contractAddress]);

  const mint = useCallback(
    async (rawLabel: string): Promise<AgentRecord> => {
      if (!account) {
        const err = "Connect a wallet first.";
        setState({ phase: "error", message: err });
        throw new Error(err);
      }
      const label = rawLabel.trim() || `agent-${Date.now().toString(36)}`;
      try {
        setState({ phase: "generating", message: "Generating agent keypair…" });
        const address = await ensureContract();

        await ensureFuji();

        const platformLookup = await fetchPlatformAddress(address);
        if (!platformLookup.ok) throw new Error(platformLookup.message);

        setState({ phase: "minting", message: "Confirm the mint approval transaction in your wallet…" });
        const approval = await sendTx(
          prepareTransaction({
            client,
            chain: avalancheFuji,
            to: platformLookup.platformAddress,
            value: 0n,
            data: mintApprovalData(account.address, label),
          }),
        );

        setState({ phase: "confirming", message: "Creating funded agent passport…" });

        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: label,
            purpose: "General-purpose agent",
            tools: ["scraper", "summarizer", "logger"],
            mintApprovalTxHash: approval.transactionHash,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as CreateAgentError;
          throw new Error(mapCreateAgentError(res.status, data));
        }
        const created = (await res.json()) as CreateAgentResponse;

        const record = saveAgent({
          passportId: created.passportId,
          agentAddress: created.walletAddress,
          ownerAddress: account.address,
          label,
          mintTxHash: created.mintTxHash,
        });

        setState({
          phase: "done",
          message: `Passport #${record.passportId} created for ${label}.`,
          lastCreated: record,
        });
        return record;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Passport creation failed, was rejected, or you may need Fuji AVAX for gas.";
        setState({ phase: "error", message });
        throw e instanceof Error ? e : new Error(message);
      }
    },
    [account, client, ensureContract, ensureFuji, sendTx],
  );

  return { mint, reset, state, contractAddress };
}

function mapCreateAgentError(status: number, data: CreateAgentError): string {
  if (status === 401) return "Your session expired. Please sign in again and retry.";
  if (data.error === "invalid_mint_approval") return "Mint approval could not be verified. Please try again.";
  if (data.error === "missing_wallet") return "Your session is missing a wallet address. Please sign in again.";
  if (data.error === "provisioning_failed") {
    if (data.step === "wallet") return "We couldn't create your agent wallet. Please try again.";
    if (data.step === "funding") {
      if (data.reason === "insufficient_avax") {
        return `The platform wallet needs Fuji AVAX. Available: ${data.available ?? "0"} AVAX; required: ${data.required ?? "0.05"} AVAX.`;
      }
      return "The platform wallet could not fund the agent. Please try again.";
    }
    if (data.step === "mint") return "Passport creation failed on-chain. Please try again.";
  }
  return status >= 500 ? "Something went wrong on our end. Please try again." : "Passport creation failed. Please try again.";
}
