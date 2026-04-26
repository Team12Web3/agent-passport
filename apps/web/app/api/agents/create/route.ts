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
import { createUnsignedAgentClaims, getClaimsDigest } from "@/lib/agent/claims";
import {
  getPlatformWalletClient,
  getPublicClient,
} from "@/lib/chain/client";
import { AgentPassport, assertContractsDeployed } from "@/lib/chain/contracts";
import { createAgentWallet, fundAgentWallet } from "@/lib/agent/wallet";

export const runtime = "nodejs";

const Body = z.object({
  name:    z.string().min(1).max(40),
  purpose: z.string().min(1).max(200),
  tools:   z.array(z.enum(["scraper", "summarizer", "logger"])).min(1),
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
    return provisioningFailed("funding");
  }

  // 3. Mint passport
  let mintTxHash: Hex;
  let passportId: string;
  try {
    const wallet = getPlatformWalletClient();
    const pub    = getPublicClient();

    const ownerAddress =
      (session.user.wallet_address as Hex | null) ?? walletAddress;
    const issuedAt = Math.floor(Date.now() / 1000);
    const unsignedClaims = createUnsignedAgentClaims({
      passportId: "pending",
      developer: "Agent Passport Demo",
      developerWallet: wallet.account!.address,
      modelPlatform: process.env.NEXT_PUBLIC_DEFAULT_MODEL ?? "Claude 3.5",
      labels: ["non-crawler", "owner-bound"],
      complianceClaims: [
        "developer-signed",
        "trust-header-compatible",
        "session-key-ready",
      ],
      trustScore: 50,
      easUid: null,
      issuedAt,
      sessionKey: null,
    });
    const developerSignature = await wallet.signMessage({
      account: wallet.account!,
      message: { raw: getClaimsDigest(unsignedClaims) },
    });
    const metadataURI = `data:application/json,${encodeURIComponent(
      JSON.stringify({
        ...unsignedClaims,
        developerSignature,
        name: body.name,
        purpose: body.purpose,
        tools: body.tools,
      }),
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
