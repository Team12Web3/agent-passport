import { recoverMessageAddress, type Hex } from "viem";

import {
  buildSessionGrantDigest,
  decodeHeaderJson,
  encodeHeaderJson,
} from "./protocol";

export type SessionGrant = {
  type: "agent-passport/session-grant";
  version: 1;
  passportId: string;
  ownerWallet: Hex;
  sessionKey: Hex;
  issuedAt: number;
  expiresAt: number;
  allowedOrigins: string[];
  allowedActions: string[];
  maxAmountUsd: string;
};

export type SignedSessionGrant = {
  grant: SessionGrant;
  ownerProof: Hex;
};

export function createSessionGrant(input: Omit<SessionGrant, "type" | "version">): SessionGrant {
  return {
    type: "agent-passport/session-grant",
    version: 1,
    ...input,
  };
}

export function encodeSessionGrant(grant: SessionGrant): string {
  return encodeHeaderJson(grant);
}

export function decodeSessionGrant(encoded: string): SessionGrant {
  return decodeHeaderJson<SessionGrant>(encoded);
}

export function getSessionGrantDigest(grant: SessionGrant): Hex {
  return buildSessionGrantDigest({
    passportId: grant.passportId,
    ownerWallet: grant.ownerWallet,
    sessionKey: grant.sessionKey,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
    allowedOrigins: grant.allowedOrigins,
    allowedActions: grant.allowedActions,
    maxAmountUsd: grant.maxAmountUsd,
  });
}

export async function verifySessionGrantOwnerProof(
  grant: SessionGrant,
  ownerProof: Hex,
): Promise<boolean> {
  try {
    const recovered = await recoverMessageAddress({
      message: { raw: getSessionGrantDigest(grant) },
      signature: ownerProof,
    });
    return recovered.toLowerCase() === grant.ownerWallet.toLowerCase();
  } catch {
    return false;
  }
}

export function isSessionGrantActive(
  grant: SessionGrant,
  nowUnixSeconds: number,
): boolean {
  return nowUnixSeconds >= grant.issuedAt && nowUnixSeconds <= grant.expiresAt;
}

export function isOriginAllowed(grant: SessionGrant, url: string): boolean {
  try {
    const origin = new URL(url).origin.toLowerCase();
    return grant.allowedOrigins.some(
      (allowedOrigin) => allowedOrigin.toLowerCase() === origin,
    );
  } catch {
    return false;
  }
}

export function isActionAllowed(grant: SessionGrant, action: unknown): boolean {
  const normalized = typeof action === "string" ? action : JSON.stringify(action);
  return grant.allowedActions.some((allowedAction) => allowedAction === normalized);
}

export function isAmountAllowed(
  grant: SessionGrant,
  amountUsd?: number,
): boolean {
  if (amountUsd === undefined) return true;
  const maxAmount = Number(grant.maxAmountUsd);
  if (!Number.isFinite(maxAmount)) return false;
  return amountUsd <= maxAmount;
}
