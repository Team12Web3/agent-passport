import "server-only";
import {
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { getPlatformAccount, getPublicClient } from "../chain/client";
import { USDC } from "../chain/contracts";

// ─── Person-2 stubs (TEMPORARY) ────────────────────────────────────────────
// Replace with real AES-256-GCM encryption + Thirdweb-engine signer when
// Person 2 ships lib/agent/wallet.ts. These exist so Person 1's API routes
// can compile and run end-to-end against Fuji during the first 4 hours.
// ────────────────────────────────────────────────────────────────────────────

const RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";

function xorEncrypt(plain: string, secretHex: string): string {
  // Trivial reversible obfuscation. NOT SECURE. Person 2 swaps for AES-GCM.
  const key = Buffer.from(secretHex, "hex");
  const buf = Buffer.from(plain, "utf8");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("base64");
}

function xorDecrypt(cipher: string, secretHex: string): string {
  const key = Buffer.from(secretHex, "hex");
  const buf = Buffer.from(cipher, "base64");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("utf8");
}

function getSecret(): string {
  const s = process.env.AGENT_KEY_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AGENT_KEY_SECRET must be a 32-byte hex string");
  }
  return s;
}

export type CreatedWallet = {
  address: Hex;
  encryptedKey: string;
};

export async function createAgentWallet(_userId: string): Promise<CreatedWallet> {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return {
    address: account.address,
    encryptedKey: xorEncrypt(pk, getSecret()),
  };
}

export function decryptAgentKey(encrypted: string): Hex {
  return xorDecrypt(encrypted, getSecret()) as Hex;
}

export type Funded = { fundingTxHash: Hex };

export async function fundAgentWallet(address: Hex): Promise<Funded> {
  const platform = getPlatformAccount();
  const wallet = createWalletClient({
    account: platform,
    chain: avalancheFuji,
    transport: http(RPC),
  });
  const pub = getPublicClient();

  const avaxTx = await wallet.sendTransaction({
    account: platform,
    chain: avalancheFuji,
    to: address,
    value: parseEther("0.05"),
  });
  await pub.waitForTransactionReceipt({ hash: avaxTx });

  const usdcTx = await wallet.writeContract({
    account: platform,
    chain: avalancheFuji,
    address: USDC.address,
    abi: USDC.abi,
    functionName: "transfer",
    args: [address, parseUnits("5", 6)],
  });
  await pub.waitForTransactionReceipt({ hash: usdcTx });

  return { fundingTxHash: avaxTx };
}

export function getAgentSigner(encryptedKey: string) {
  const pk = decryptAgentKey(encryptedKey);
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(RPC),
  });
  return { account, wallet };
}
