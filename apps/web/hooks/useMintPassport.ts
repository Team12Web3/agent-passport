"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getContract, prepareContractCall, waitForReceipt, type ThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import { deployContract } from "thirdweb/deploys";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSendTransaction,
  useSwitchActiveWalletChain,
} from "thirdweb/react";

import {
  AGENT_PASSPORT_ABI,
  AGENT_PASSPORT_BYTECODE,
  parsePassportMintedFromLogs,
} from "@/lib/agentPassport";
import {
  generateAgent,
  getStoredContractAddress,
  saveAgent,
  setStoredContractAddress,
  type AgentRecord,
} from "@/lib/agentKeys";

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

function isValidAddress(addr: string | null | undefined): addr is string {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function useMintPassport(client: ThirdwebClient) {
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
    if (!account) throw new Error("Connect a wallet first.");
    setState({ phase: "deploying", message: "Confirm the deploy in your wallet…" });
    await ensureFuji();
    const address = await deployContract({
      client,
      chain: avalancheFuji,
      account,
      abi: AGENT_PASSPORT_ABI as never,
      bytecode: AGENT_PASSPORT_BYTECODE as `0x${string}`,
      constructorParams: {},
    });
    setStoredContractAddress(address);
    setStoredContract(address);
    return address;
  }, [account, client, contractAddress, ensureFuji]);

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
        const generated = generateAgent();

        const address = await ensureContract();

        await ensureFuji();

        setState({ phase: "minting", message: "Confirm the mint in your wallet…" });

        const contract = getContract({ address, chain: avalancheFuji, client });
        const tx = prepareContractCall({
          contract,
          method:
            "function mintPassport(address agentWallet, string metadataURI) returns (uint256)",
          params: [
            generated.address,
            JSON.stringify({ label, createdAt: new Date().toISOString() }),
          ],
        });

        const sent = await sendTx(tx);

        setState({ phase: "confirming", message: "Waiting for Fuji confirmation…" });
        const receipt = await waitForReceipt({
          client,
          chain: avalancheFuji,
          transactionHash: sent.transactionHash,
        });

        const minted = parsePassportMintedFromLogs(receipt.logs ?? [], address);
        if (!minted) throw new Error("Mint succeeded but PassportMinted event was missing.");

        const record = saveAgent({
          passportId: minted.id.toString(),
          agentAddress: generated.address,
          privateKey: generated.privateKey,
          ownerAddress: account.address,
          label,
          mintTxHash: receipt.transactionHash,
        });

        setState({
          phase: "done",
          message: `Passport #${record.passportId} minted for ${label}.`,
          lastCreated: record,
        });
        return record;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Mint failed, was rejected, or you may need Fuji AVAX for gas.";
        setState({ phase: "error", message });
        throw e instanceof Error ? e : new Error(message);
      }
    },
    [account, client, ensureContract, ensureFuji, sendTx],
  );

  return { mint, reset, state, contractAddress };
}
