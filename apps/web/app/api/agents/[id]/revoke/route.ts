import "server-only";
import { avalancheFuji } from "viem/chains";
import { type Hex } from "viem";
import { json, unauthorized } from "../../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";
import {
  getPlatformWalletClient,
  getPublicClient,
} from "@/lib/chain/client";
import { AgentPassport, assertContractsDeployed } from "@/lib/chain/contracts";
import { getSignerFromEncryptedKey } from "@/lib/agent/wallet";

export const runtime = "nodejs";

const PLAIN_TRANSFER_GAS = 21_000n;

type AgentRow = {
  passport_id: string | null;
  agent_wallet_address: string;
  encrypted_private_key: string;
};

/**
 * Sweep the agent EOA's AVAX balance back to its owner.
 *
 * Reserves `gasPrice * 21_000 * 5/4` to cover the transfer itself with 25%
 * headroom against a one-block fee bump. Skips silently when the balance is
 * at or below that reserve — sending dust isn't worth a tx and the agent EOA
 * is unrecoverable after revoke either way.
 */
async function sweepAgentBalance(args: {
  encryptedPrivateKey: string;
  agentAddress: Hex;
  ownerAddress: Hex;
}): Promise<{ txHash: Hex | null; sweptWei: bigint }> {
  const pub = getPublicClient();
  const balance = await pub.getBalance({ address: args.agentAddress });
  if (balance === 0n) return { txHash: null, sweptWei: 0n };

  const gasPrice = await pub.getGasPrice();
  const reserve = (gasPrice * PLAIN_TRANSFER_GAS * 5n) / 4n;
  if (balance <= reserve) return { txHash: null, sweptWei: 0n };

  const value = balance - reserve;
  const { account, wallet } = getSignerFromEncryptedKey(args.encryptedPrivateKey);
  const txHash = (await wallet.sendTransaction({
    account,
    chain: avalancheFuji,
    to: args.ownerAddress,
    value,
    gas: PLAIN_TRANSFER_GAS,
    gasPrice,
  })) as Hex;
  await pub.waitForTransactionReceipt({ hash: txHash });
  return { txHash, sweptWei: value };
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  assertContractsDeployed();

  const session = await getSessionUser();
  if (!session) return unauthorized();

  const ownerAddress = session.user.wallet_address as Hex | null;
  if (!ownerAddress) {
    return json({ error: "missing_wallet" }, { status: 400 });
  }

  const { id: agentId } = await ctx.params;
  if (!agentId) return json({ error: "missing_agent_id" }, { status: 400 });

  const supabase = getSupabase();
  const { data: row, error: loadError } = await supabase
    .from("agents")
    .select("passport_id, agent_wallet_address, encrypted_private_key")
    .eq("id", agentId)
    .eq("user_id", session.user.id)
    .maybeSingle<AgentRow>();

  if (loadError) {
    console.error("[agents/revoke] load", loadError);
    return json({ error: "db_query_failed" }, { status: 500 });
  }
  if (!row) return json({ error: "not_found" }, { status: 404 });
  if (!row.passport_id) {
    return json({ error: "passport_not_minted" }, { status: 409 });
  }

  // 1. Sweep agent EOA → owner.
  let sweepTxHash: Hex | null;
  let sweptWei: bigint;
  try {
    const result = await sweepAgentBalance({
      encryptedPrivateKey: row.encrypted_private_key,
      agentAddress: row.agent_wallet_address as Hex,
      ownerAddress,
    });
    sweepTxHash = result.txHash;
    sweptWei = result.sweptWei;
  } catch (err) {
    console.error("[agents/revoke] sweep", err);
    return json({ error: "sweep_failed" }, { status: 502 });
  }

  // 2. Flip the on-chain active flag via the platform wallet.
  let revokeTxHash: Hex;
  try {
    const wallet = getPlatformWalletClient();
    const pub = getPublicClient();
    revokeTxHash = (await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain!,
      address: AgentPassport.address,
      abi: AgentPassport.abi as never,
      functionName: "setActive",
      args: [BigInt(row.passport_id), false],
    })) as Hex;
    await pub.waitForTransactionReceipt({ hash: revokeTxHash });
  } catch (err) {
    console.error("[agents/revoke] setActive", err);
    return json(
      { error: "revoke_failed", sweepTxHash, sweptWei: sweptWei.toString() },
      { status: 502 },
    );
  }

  // 3. Drop the DB row so the card disappears from /api/agents/list.
  const { error: deleteError } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId);
  if (deleteError) {
    console.error("[agents/revoke] db delete (non-fatal)", deleteError);
  }

  return json({
    ok: true,
    sweepTxHash,
    revokeTxHash,
    sweptWei: sweptWei.toString(),
  });
}
