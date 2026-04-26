import "server-only";

import {
  formatEther,
  keccak256,
  parseEther,
  stringToHex,
  type Hex,
} from "viem";

import { getPlatformWalletClient, getPublicClient } from "../chain/client";
import { StakeVault, hasStakeVaultConfigured } from "../chain/contracts";
import { canonicalizeValue } from "./protocol";

export const DEFAULT_REQUIRED_STAKE_ETH =
  process.env.AGENT_REQUIRED_STAKE_ETH ?? "0.1";
export const DEFAULT_SLASH_AMOUNT_ETH =
  process.env.AGENT_SLASH_AMOUNT_ETH ?? DEFAULT_REQUIRED_STAKE_ETH;

export type PassportStakeSummary = {
  passportId: string;
  stakeVaultEnabled: boolean;
  activeStakeWei: bigint;
  activeStakeEth: string;
  totalSlashedWei: bigint;
  totalSlashedEth: string;
  lastStakeAt: number | null;
  requiredStakeEth: string;
  hasMinimumStake: boolean;
};

type StakeEvidenceInput = {
  passportId: string;
  signature: Hex;
  timestamp: string;
  intentHash: Hex;
  evidenceUri: string;
  reason: "ddos" | "policy_violation";
};

function parseRequiredStakeEth(): bigint {
  return parseEther(DEFAULT_REQUIRED_STAKE_ETH);
}

function assertStakeVaultConfigured(): void {
  if (!hasStakeVaultConfigured()) {
    throw new Error(
      "StakeVault.address is missing in packages/contracts/deployments.json",
    );
  }
}

export async function getPassportStakeSummary(
  passportId: string,
): Promise<PassportStakeSummary> {
  const requiredStakeWei = parseRequiredStakeEth();

  if (!hasStakeVaultConfigured()) {
    return {
      passportId,
      stakeVaultEnabled: false,
      activeStakeWei: 0n,
      activeStakeEth: "0",
      totalSlashedWei: 0n,
      totalSlashedEth: "0",
      lastStakeAt: null,
      requiredStakeEth: DEFAULT_REQUIRED_STAKE_ETH,
      hasMinimumStake: false,
    };
  }

  const [activeStake, totalSlashed, lastStakeAt] = (await getPublicClient()
    .readContract({
      address: StakeVault.address,
      abi: StakeVault.abi,
      functionName: "getStake",
      args: [BigInt(passportId)],
    })) as [bigint, bigint, bigint];

  return {
    passportId,
    stakeVaultEnabled: true,
    activeStakeWei: activeStake,
    activeStakeEth: formatEther(activeStake),
    totalSlashedWei: totalSlashed,
    totalSlashedEth: formatEther(totalSlashed),
    lastStakeAt: lastStakeAt > 0n ? Number(lastStakeAt) : null,
    requiredStakeEth: DEFAULT_REQUIRED_STAKE_ETH,
    hasMinimumStake: activeStake >= requiredStakeWei,
  };
}

export async function depositPassportStake(
  passportId: string,
  amountEth = DEFAULT_REQUIRED_STAKE_ETH,
): Promise<Hex> {
  assertStakeVaultConfigured();

  const wallet = getPlatformWalletClient();
  const hash = await wallet.writeContract({
    account: wallet.account!,
    chain: wallet.chain!,
    address: StakeVault.address,
    abi: StakeVault.abi,
    functionName: "depositStake",
    args: [BigInt(passportId)],
    value: parseEther(amountEth),
  });

  await getPublicClient().waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  return hash;
}

export function buildSlashEvidenceHash(input: StakeEvidenceInput): Hex {
  return keccak256(
    stringToHex(
      JSON.stringify({
        type: "agent-passport/slash-evidence",
        passportId: input.passportId,
        signature: input.signature,
        timestamp: input.timestamp,
        intentHash: input.intentHash,
        evidenceUri: input.evidenceUri,
        reason: input.reason,
        version: 1,
        canonical: canonicalizeValue({
          passportId: input.passportId,
          signature: input.signature,
          timestamp: input.timestamp,
          intentHash: input.intentHash,
          evidenceUri: input.evidenceUri,
          reason: input.reason,
        }),
      }),
    ),
  );
}

export async function slashPassportStake(
  input: StakeEvidenceInput,
  amountEth = DEFAULT_SLASH_AMOUNT_ETH,
): Promise<{ txHash: Hex; evidenceHash: Hex; slashAmountEth: string }> {
  assertStakeVaultConfigured();

  const wallet = getPlatformWalletClient();
  const evidenceHash = buildSlashEvidenceHash(input);
  const txHash = await wallet.writeContract({
    account: wallet.account!,
    chain: wallet.chain!,
    address: StakeVault.address,
    abi: StakeVault.abi,
    functionName: "slashStake",
    args: [BigInt(input.passportId), parseEther(amountEth), evidenceHash],
  });

  await getPublicClient().waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  return {
    txHash,
    evidenceHash,
    slashAmountEth: amountEth,
  };
}
