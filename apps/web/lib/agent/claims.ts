import { recoverMessageAddress, type Hex } from "viem";

import {
  buildClaimsDigest,
  decodeHeaderJson,
  encodeHeaderJson,
} from "./protocol";

export type AgentClaims = {
  "@context": "https://agentpassport.dev/claims/v1";
  type: "AgentPassportClaims";
  version: 1;
  passportId: string;
  developer: string;
  developerWallet: Hex;
  developerSignature: Hex;
  modelPlatform: string;
  labels: string[];
  complianceClaims: string[];
  trustScore: number;
  easUid: string | null;
  issuedAt: number;
  sessionKey: Hex | null;
};

export type UnsignedAgentClaims = Omit<AgentClaims, "developerSignature">;

export function createUnsignedAgentClaims(
  input: Omit<UnsignedAgentClaims, "@context" | "type" | "version">,
): UnsignedAgentClaims {
  return {
    "@context": "https://agentpassport.dev/claims/v1",
    type: "AgentPassportClaims",
    version: 1,
    ...input,
  };
}

export function getClaimsDigest(claims: UnsignedAgentClaims): Hex {
  return buildClaimsDigest({
    passportId: claims.passportId,
    developer: claims.developer,
    developerWallet: claims.developerWallet,
    modelPlatform: claims.modelPlatform,
    labels: claims.labels,
    complianceClaims: claims.complianceClaims,
    trustScore: claims.trustScore,
    easUid: claims.easUid,
    issuedAt: claims.issuedAt,
    version: claims.version,
    sessionKey: claims.sessionKey,
  });
}

export function encodeClaims(claims: AgentClaims): string {
  return encodeHeaderJson(claims);
}

export function decodeClaims(encoded: string): AgentClaims {
  return decodeHeaderJson<AgentClaims>(encoded);
}

export async function verifyClaimsSignature(claims: AgentClaims): Promise<boolean> {
  try {
    const { developerSignature, ...unsignedClaims } = claims;
    const recovered = await recoverMessageAddress({
      message: { raw: getClaimsDigest(unsignedClaims) },
      signature: developerSignature,
    });
    return recovered.toLowerCase() === claims.developerWallet.toLowerCase();
  } catch {
    return false;
  }
}
