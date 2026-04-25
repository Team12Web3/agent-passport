import "server-only";

import {
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  maxUint256,
  parseEther,
  parseUnits,
  type Hex,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

import { getPublicClient } from "../chain/client";
import { ActionLog, USDC } from "../chain/contracts";
import { getSupabase, type AgentRow } from "../db/supabase";
import { decrypt, encrypt } from "../crypto/kms";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FUNDING_AVAX = "0.05";
const FUNDING_USDC = "5";

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

function getUsdcAddress(): Hex {
  const usdcAddress =
    process.env.NEXT_PUBLIC_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error("Missing NEXT_PUBLIC_USDC_ADDRESS");
  }
  return usdcAddress as Hex;
}

function createAgentWalletClient(privateKey: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: avalancheFuji,
    transport: http(getFujiRpcUrl()),
  });
}

function getActionLogAddress(): Hex {
  const actionLogAddress = ActionLog.address as Hex;
  if (!actionLogAddress || actionLogAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "Missing ActionLog.address in packages/contracts/deployments.json",
    );
  }
  return actionLogAddress;
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

async function getAgentWalletRowByAddress(
  address: Hex,
): Promise<Pick<AgentRow, "encrypted_private_key" | "agent_wallet_address">> {
  const { data, error } = await getSupabase()
    .from("agents")
    .select("encrypted_private_key, agent_wallet_address")
    .ilike("agent_wallet_address", address)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load agent wallet ${address}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Agent wallet ${address} not found`);
  }
  if (!data.encrypted_private_key) {
    throw new Error(`Agent wallet ${address} is missing encrypted_private_key`);
  }

  return data as Pick<AgentRow, "encrypted_private_key" | "agent_wallet_address">;
}

export type CreateAgentWalletResult = {
  address: Hex;
  encryptedKey: string;
};

export type FundAgentWalletResult = {
  address: Hex;
  avaxAmount: typeof FUNDING_AVAX;
  usdcAmount: typeof FUNDING_USDC;
  actionLogAddress: Hex;
  fundingTxHash: Hex;
  avaxTxHash: Hex;
  usdcTxHash: Hex;
  approveTxHash: Hex;
};

// Back-compat aliases for existing callers while Person 1 wires routes.
export type CreatedWallet = CreateAgentWalletResult;
export type Funded = FundAgentWalletResult;

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
 * 1) send AVAX, 2) send USDC, 3) approve ActionLog from the agent wallet.
 *
 * Note: this helper expects the target agent row to already exist in Supabase
 * so it can load the encrypted key by `agent_wallet_address` for the approve.
 */
export async function fundAgentWallet(address: Hex): Promise<FundAgentWalletResult> {
  if (!address.trim()) {
    throw new Error("fundAgentWallet requires a non-empty toAddress");
  }

  const publicClient = getPublicClient();
  const faucetWallet = createAgentWalletClient(getFaucetPrivateKey());
  const faucetAccount = faucetWallet.account!;
  const usdcAddress = getUsdcAddress();
  const actionLogAddress = getActionLogAddress();

  const requiredAvax = parseEther(FUNDING_AVAX);
  const requiredUsdc = parseUnits(FUNDING_USDC, 6);

  const [faucetAvaxBalance, faucetUsdcBalance] = await Promise.all([
    publicClient.getBalance({ address: faucetAccount.address }),
    publicClient.readContract({
      address: usdcAddress,
      abi: USDC.abi,
      functionName: "balanceOf",
      args: [faucetAccount.address],
    }) as Promise<bigint>,
  ]);

  if (faucetAvaxBalance < requiredAvax) {
    throw new Error(
      `Faucet wallet has insufficient AVAX: ${formatEther(faucetAvaxBalance)} available, ${FUNDING_AVAX} required`,
    );
  }
  if (faucetUsdcBalance < requiredUsdc) {
    throw new Error(
      `Faucet wallet has insufficient USDC: ${formatUnits(faucetUsdcBalance, 6)} available, ${FUNDING_USDC} required`,
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

  const usdcTxHash = await faucetWallet.writeContract({
    account: faucetAccount,
    chain: avalancheFuji,
    address: usdcAddress,
    abi: USDC.abi,
    functionName: "transfer",
    args: [address, requiredUsdc],
  });
  await publicClient.waitForTransactionReceipt({
    hash: usdcTxHash,
    confirmations: 1,
  });

  const agentWalletRow = await getAgentWalletRowByAddress(address);
  const { wallet: agentWallet } = getSignerFromEncryptedKey(
    agentWalletRow.encrypted_private_key,
  );

  const approveTxHash = await agentWallet.writeContract({
    account: agentWallet.account!,
    chain: avalancheFuji,
    address: usdcAddress,
    abi: USDC.abi,
    functionName: "approve",
    args: [actionLogAddress, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({
    hash: approveTxHash,
    confirmations: 1,
  });

  return {
    address,
    avaxAmount: FUNDING_AVAX,
    usdcAmount: FUNDING_USDC,
    actionLogAddress,
    fundingTxHash: avaxTxHash,
    avaxTxHash,
    usdcTxHash,
    approveTxHash,
  };
}
