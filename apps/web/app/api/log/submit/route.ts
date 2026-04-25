import "server-only";
import { z } from "zod";
import { type Hex } from "viem";
import { json, unauthorized, validationError } from "../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";
import { getPublicClient } from "@/lib/chain/client";
import {
  ActionLog,
  USDC,
  assertContractsDeployed,
} from "@/lib/chain/contracts";
import { getSignerFromEncryptedKey } from "@/lib/agent/wallet";

export const runtime = "nodejs";

const Body = z.object({
  agentId:     z.string().uuid(),
  runId:       z.string().uuid(),
  taskHash:    z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  actionsRoot: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  feeAmount:   z.string().regex(/^[0-9]+$/),
  beneficiary: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export async function POST(req: Request) {
  assertContractsDeployed();

  const session = await getSessionUser();
  if (!session) return unauthorized();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return validationError(err);
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, user_id, passport_id, encrypted_private_key")
    .eq("id", body.agentId)
    .single();
  if (error || !agent) return json({ error: "not_found" }, { status: 404 });
  if ((agent as { user_id: string }).user_id !== session.user.id) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  const a = agent as {
    user_id: string;
    passport_id: string | null;
    encrypted_private_key: string;
  };
  if (!a.passport_id) {
    return json({ error: "no_passport" }, { status: 400 });
  }

  const { account, wallet } = getSignerFromEncryptedKey(a.encrypted_private_key);
  const pub = getPublicClient();
  const fee = BigInt(body.feeAmount);

  if (fee > 0n) {
    const allowance = (await pub.readContract({
      address: USDC.address,
      abi: USDC.abi,
      functionName: "allowance",
      args: [account.address, ActionLog.address],
    })) as bigint;

    if (allowance < fee) {
      const approveTx = await wallet.writeContract({
        account,
        chain: wallet.chain!,
        address: USDC.address,
        abi: USDC.abi,
        functionName: "approve",
        args: [ActionLog.address, 2n ** 256n - 1n],
      });
      await pub.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  const txHash = (await wallet.writeContract({
    account,
    chain: wallet.chain!,
    address: ActionLog.address,
    abi: ActionLog.abi as never,
    functionName: "logAction",
    args: [
      BigInt(a.passport_id),
      body.taskHash as Hex,
      body.actionsRoot as Hex,
      fee,
      body.beneficiary as Hex,
    ],
  })) as Hex;

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  await supabase
    .from("action_runs")
    .update({
      log_tx_hash:  txHash,
      actions_root: body.actionsRoot,
      fee_amount:   body.feeAmount,
      status:       "done",
    })
    .eq("id", body.runId);

  return json({ txHash, blockNumber: Number(receipt.blockNumber) });
}
