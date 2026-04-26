import "server-only";
import { formatEther, parseEther } from "viem";
import { json, unauthorized } from "../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { FUJI_CHAIN_ID, getPlatformWalletClient, getPublicClient } from "@/lib/chain/client";

export const runtime = "nodejs";

const MINT_GAS_RESERVE = parseEther("0.01");

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const platformAddress = getPlatformWalletClient().account?.address;
  if (!platformAddress) {
    return json({ error: "platform_wallet_not_configured" }, { status: 500 });
  }

  try {
    const balance = await getPublicClient().getBalance({ address: platformAddress });
    if (balance < MINT_GAS_RESERVE) {
      return json(
        {
          error: "platform_wallet_low_balance",
          available: formatEther(balance),
          required: formatEther(MINT_GAS_RESERVE),
        },
        { status: 503 },
      );
    }
  } catch {
    // Non-fatal: proceed even if balance check fails
  }

  return json({
    chainId: FUJI_CHAIN_ID,
    platformAddress,
  });
}
