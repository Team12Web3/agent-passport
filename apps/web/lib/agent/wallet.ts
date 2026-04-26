import "server-only";

import {
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Hex,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

import { getPublicClient } from "../chain/client";
import { getSupabase, type AgentRow } from "../db/supabase";
import { decrypt, encrypt } from "../crypto/kms";

const FUNDING_AVAX = "0.05";

function getFujiRpcUrl(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_FUJI_RPC;
  if (!rpcUrl) throw new Error("Missing NEXT_PUBLIC_FUJI_RPC");
  return rpcUrl;
}

function getFaucetPrivateKey(): Hex {
  const privateKey =
    process.env.FAUCET_PRIVATE_KEY ?? process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing FAUCET_PRIVATE_KEY (or PLATFORM_PRIVATE_KEY fallback)");
  }
  return privateKey as Hex;
}

function createAgentWalletClient(privateKey: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: avalancheFuji,
    transport: http(getFujiRpcUrl()),
  });
}

async function getAgentWalletRow(agentId: string): Promise<Pick<AgentRow, "encrypted_private_key">> {
  const { data, error } = await getSupabase()
    .from("agents")
    .select("encrypted_private_key")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Agent ${agentId} not found`);
  }
  if (!data.encrypted_private_key) {
    throw new Error(`Agent ${agentId} is missing encrypted_private_key`);
  }

  return data as Pick<AgentRow, "encrypted_private_key">;
}

export type CreateAgentWalletResult = {
  address: Hex;
  encryptedKey: string;
};

export type FundAgentWalletResult = {
  address: Hex;
  avaxAmount: typeof FUNDING_AVAX;
  fundingTxHash: Hex;
  avaxTxHash: Hex;
};

// Back-compat aliases for existing callers while Person 1 wires routes.
export type CreatedWallet = CreateAgentWalletResult;
export type Funded = FundAgentWalletResult;

export type AgentFundingErrorCode = "insufficient_avax";

export class AgentFundingError extends Error {
  constructor(
    public readonly code: AgentFundingErrorCode,
    public readonly available: string,
    public readonly required: string,
  ) {
    super(`Faucet wallet has insufficient AVAX: ${available} available, ${required} required`);
    this.name = "AgentFundingError";
  }
}

/**
 * Generates a fresh agent EOA and returns only the values the caller should
 * persist on the `agents` row. This helper does not insert into Supabase.
 */
export async function createAgentWallet(userId: string): Promise<CreateAgentWalletResult> {
  if (!userId.trim()) {
    throw new Error("createAgentWallet requires a non-empty userId");
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    encryptedKey: encrypt(privateKey),
  };
}

export function decryptAgentKey(encrypted: string): Hex {
  return decrypt(encrypted) as Hex;
}

/**
 * Convenience helper for server-only paths that already have the encrypted key
 * on hand and need an account plus wallet client without another DB lookup.
 */
export function getSignerFromEncryptedKey(encrypted: string) {
  const privateKey = decryptAgentKey(encrypted);
  const wallet = createAgentWalletClient(privateKey);
  return {
    account: wallet.account!,
    wallet,
  };
}

/**
 * Loads an existing agent's encrypted private key from the `agents` table and
 * returns a Fuji wallet client ready for signing or sending transactions.
 */
export async function getAgentSigner(agentId: string): Promise<WalletClient> {
  if (!agentId.trim()) {
    throw new Error("getAgentSigner requires a non-empty agentId");
  }

  const data = await getAgentWalletRow(agentId);
  return createAgentWalletClient(decryptAgentKey(data.encrypted_private_key));
}

/**
 * Demo funding flow used immediately after the `agents` row has been created:
 * send enough AVAX for the agent wallet to pay Fuji gas.
 */
export async function fundAgentWallet(address: Hex): Promise<FundAgentWalletResult> {
  if (!address.trim()) {
    throw new Error("fundAgentWallet requires a non-empty toAddress");
  }

  const publicClient = getPublicClient();
  const faucetWallet = createAgentWalletClient(getFaucetPrivateKey());
  const faucetAccount = faucetWallet.account!;

  const requiredAvax = parseEther(FUNDING_AVAX);
  const faucetAvaxBalance = await publicClient.getBalance({
    address: faucetAccount.address,
  });

  if (faucetAvaxBalance < requiredAvax) {
    throw new AgentFundingError(
      "insufficient_avax",
      formatEther(faucetAvaxBalance),
      FUNDING_AVAX,
    );
  }

  const avaxTxHash = await faucetWallet.sendTransaction({
    account: faucetAccount,
    chain: avalancheFuji,
    to: address,
    value: requiredAvax,
  });
  await publicClient.waitForTransactionReceipt({
    hash: avaxTxHash,
    confirmations: 1,
  });

  return {
    address,
    avaxAmount: FUNDING_AVAX,
    fundingTxHash: avaxTxHash,
    avaxTxHash,
  };
}
