import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (publicClient) return publicClient;
  publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(RPC),
  });
  return publicClient;
}

export function getPlatformAccount(): Account {
  const pk = process.env.PLATFORM_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("PLATFORM_PRIVATE_KEY not set");
  return privateKeyToAccount(pk);
}

export function getPlatformWalletClient(): WalletClient {
  return createWalletClient({
    account: getPlatformAccount(),
    chain: avalancheFuji,
    transport: http(RPC),
  });
}

export function getWalletClientFor(privateKey: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: avalancheFuji,
    transport: http(RPC),
  });
}

export const FUJI_CHAIN_ID = 43113;
