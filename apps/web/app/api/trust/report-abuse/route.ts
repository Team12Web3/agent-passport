import "server-only";

import { z } from "zod";

import { json, validationError } from "../../_lib/responses";
import {
  getPassportStakeSummary,
  slashPassportStake,
} from "@/lib/agent/staking";

export const runtime = "nodejs";

const Body = z.object({
  passportId: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  timestamp: z.string().regex(/^\d+$/),
  intentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  evidenceUri: z.string().min(1),
  reason: z.enum(["ddos", "policy_violation"]),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const stake = await getPassportStakeSummary(body.passportId);
  if (!stake.stakeVaultEnabled) {
    return json({
      accepted: false,
      message: "StakeVault is not configured in deployments.json.",
    });
  }

  if (stake.activeStakeWei === 0n) {
    return json({
      accepted: false,
      message: "No active stake is available for this passport.",
    });
  }

  const slash = await slashPassportStake({
    passportId: body.passportId,
    signature: body.signature as `0x${string}`,
    timestamp: body.timestamp,
    intentHash: body.intentHash as `0x${string}`,
    evidenceUri: body.evidenceUri,
    reason: body.reason,
  });

  return json({
    accepted: true,
    slashAmountEth: slash.slashAmountEth,
  });
}
