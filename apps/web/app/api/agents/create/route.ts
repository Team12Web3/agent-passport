import "server-only";
import { z } from "zod";
import { type Hex } from "viem";
import {
  json,
  provisioningFailed,
  unauthorized,
  validationError,
} from "../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";
import {
  getPlatformWalletClient,
  getPublicClient,
} from "@/lib/chain/client";
import { AgentPassport, assertContractsDeployed } from "@/lib/chain/contracts";
import { mintApprovalData } from "@/lib/mintApproval";
import {
  AgentFundingError,
  createAgentWallet,
  fundAgentWallet,
} from "@/lib/agent/wallet";

export const runtime = "nodejs";

const Body = z.object({
  name:    z.string().min(1).max(40),
  purpose: z.string().min(1).max(200),
  tools:   z.array(z.enum(["scraper", "summarizer", "logger"])).min(1),
  mintApprovalTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
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

  const ownerAddress = (session.user.wallet_address as Hex | null);
  if (!ownerAddress) {
    return json({ error: "missing_wallet" }, { status: 400 });
  }

  try {
    await verifyMintApprovalTx({
      hash: body.mintApprovalTxHash as Hex,
      ownerAddress,
      name: body.name,
    });
  } catch (err) {
    console.error("[agents/create] mint approval", err);
    return json({ error: "invalid_mint_approval" }, { status: 400 });
  }

  // 1. Provision wallet
  let walletAddress: Hex;
  let encryptedKey: string;
  try {
    const w = await createAgentWallet(session.user.id);
    walletAddress = w.address;
    encryptedKey  = w.encryptedKey;
  } catch (err) {
    console.error("[agents/create] wallet step", err);
    return provisioningFailed("wallet");
  }

  const supabase = getSupabase();
  const { data: draftAgent, error: draftInsertError } = await supabase
    .from("agents")
    .insert({
      user_id: session.user.id,
      name: body.name,
      purpose: body.purpose,
      tools: body.tools,
      agent_wallet_address: walletAddress,
      encrypted_private_key: encryptedKey,
    })
    .select("id")
    .single();

  if (draftInsertError || !draftAgent) {
    console.error("[agents/create] draft db insert", draftInsertError);
    return json({ error: "db_insert_failed" }, { status: 500 });
  }

  // 2. Fund
  let fundingTxHash: Hex;
  try {
    const f = await fundAgentWallet(walletAddress);
    fundingTxHash = f.fundingTxHash;
  } catch (err) {
    console.error("[agents/create] funding step", err);
    await supabase.from("agents").delete().eq("id", draftAgent.id);
    if (err instanceof AgentFundingError) {
      return provisioningFailed("funding", {
        reason: err.code,
        available: err.available,
        required: err.required,
      });
    }
    return provisioningFailed("funding");
  }

  // 3. Mint passport
  let mintTxHash: Hex;
  let passportId: string;
  try {
    const wallet = getPlatformWalletClient();
    const pub    = getPublicClient();

    const metadataURI =
      `data:application/json,${encodeURIComponent(
        JSON.stringify({ name: body.name, purpose: body.purpose, tools: body.tools }),
      )}`;

    mintTxHash = (await wallet.writeContract({
      account: wallet.account!,
      chain:   wallet.chain!,
      address: AgentPassport.address,
      abi:     AgentPassport.abi as never,
      functionName: "mintPassport",
      args: [ownerAddress, walletAddress, metadataURI],
    })) as Hex;

    const receipt = await pub.waitForTransactionReceipt({ hash: mintTxHash });

    // Decode passportId from PassportMinted(id, owner, agentWallet) — it is the
    // first indexed topic after the event signature.
    const minted = receipt.logs.find(
      (l) => l.address.toLowerCase() === AgentPassport.address.toLowerCase(),
    );
    if (!minted || minted.topics.length < 2) throw new Error("no PassportMinted log");
    passportId = BigInt(minted.topics[1]!).toString();
  } catch (err) {
    console.error("[agents/create] mint step", err);
    await supabase.from("agents").delete().eq("id", draftAgent.id);
    return provisioningFailed("mint");
  }

  // 4. Persist
  const { data: agent, error } = await supabase
    .from("agents")
    .update({
      passport_id:           passportId,
      mint_tx_hash:          mintTxHash,
    })
    .eq("id", draftAgent.id)
    .select("id")
    .single();

  if (error || !agent) {
    console.error("[agents/create] db insert", error);
    return json({ error: "db_insert_failed" }, { status: 500 });
  }

  return json(
    {
      agentId:       agent.id,
      passportId,
      walletAddress,
      fundingTxHash,
      mintTxHash,
    },
    { status: 201 },
  );
}

async function verifyMintApprovalTx({
  hash,
  ownerAddress,
  name,
}: {
  hash: Hex;
  ownerAddress: Hex;
  name: string;
}) {
  const pub = getPublicClient();
  const platformAddress = getPlatformWalletClient().account!.address;
  const receipt = await pub.waitForTransactionReceipt({ hash, confirmations: 1 });
  const tx = await pub.getTransaction({ hash });

  if (receipt.status !== "success") throw new Error("approval tx failed");
  if (tx.chainId !== 43113) throw new Error(`wrong chain ${tx.chainId}`);
  if (tx.from.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("approval tx sender mismatch");
  }
  if (!tx.to || tx.to.toLowerCase() !== platformAddress.toLowerCase()) {
    throw new Error("approval tx recipient mismatch");
  }
  if (tx.value !== 0n) throw new Error("approval tx must be zero-value");
  if (tx.input.toLowerCase() !== mintApprovalData(ownerAddress, name).toLowerCase()) {
    throw new Error("approval tx data mismatch");
  }
}
