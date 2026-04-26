import "server-only";

import { json } from "../../../_lib/responses";
import { getPassportStakeSummary } from "@/lib/agent/staking";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { passportId: string } },
) {
  if (!/^\d+$/.test(params.passportId)) {
    return json({ error: "invalid_passport_id" }, { status: 400 });
  }

  try {
    const summary = await getPassportStakeSummary(params.passportId);
    return json({
      passportId: summary.passportId,
      stakeVaultEnabled: summary.stakeVaultEnabled,
      activeStakeEth: summary.activeStakeEth,
      totalSlashedEth: summary.totalSlashedEth,
      requiredStakeEth: summary.requiredStakeEth,
      hasMinimumStake: summary.hasMinimumStake,
      lastStakeAt: summary.lastStakeAt,
    });
  } catch {
    // Fail open — verifier sites can still decide what to do, and the UI
    // treats this the same as "stake vault not configured".
    return json({
      passportId: params.passportId,
      stakeVaultEnabled: false,
      activeStakeEth: "0",
      totalSlashedEth: "0",
      requiredStakeEth: "0",
      hasMinimumStake: false,
      lastStakeAt: null,
    });
  }
}
