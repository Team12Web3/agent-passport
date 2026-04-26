import "server-only";

import { privateKeyToAccount } from "viem/accounts";
import type { Hex, LocalAccount } from "viem";

import type { AgentClaims } from "./claims";
import type { SessionGrant } from "./session";
import { decryptAgentKey, getAgentSigner } from "./wallet";
import {
  buildActionHash,
  buildClaimsDigest,
  buildIntentHash,
  buildIntentProofDigest,
  buildSessionProofDigest,
  buildTrustDigest,
  encodeHeaderJson,
  normalizeTermsHash,
} from "./protocol";

export type TrustHeaders = {
  "X-Agent-Passport-ID": string;
  "X-Agent-Signature": string;
  "X-Agent-Timestamp": string;
  "X-Agent-Session-Proof": string;
  "X-Agent-Intent-Hash": string;
  "X-Agent-Action-Hash": string;
  "X-Agent-Intent-Proof": string;
  "X-Agent-Session-Grant"?: string;
  "X-Agent-Claims"?: string;
  "X-Agent-Claims-Signature"?: string;
};

export type SignRequestHeadersResult = TrustHeaders;

export type DelegatedSessionMaterial = {
  sessionAccount: LocalAccount;
  grant: SessionGrant;
  ownerProof: Hex;
};

export type ClaimsPacket = AgentClaims;

export type AdvancedTrustOptions = {
  delegatedSession?: DelegatedSessionMaterial;
  claims?: ClaimsPacket;
};

function normalizePassportId(passportId: bigint | number | string): string {
  return typeof passportId === "string" ? passportId : String(passportId);
}
export {
  buildActionHash,
  buildIntentHash,
  buildIntentProofDigest,
  buildSessionProofDigest,
  buildTrustDigest,
} from "./protocol";

/**
 * Signs the full trust-header bundle for an outbound agent request.
 *
 * Caller notes:
 * - `url` must be the exact URL the downstream verifier will check.
 * - `intent` must be the original user instruction or a stable object derived
 *   from it, because verify may recompute the same hash.
 * - `action` should describe the current operation being authorized. If omitted
 *   we bind the proof to a stable default `GET|<url>` action.
 * - `ownerWallet` should be the user wallet that owns or authorizes this agent.
 */
export async function signRequestHeaders(
  passportId: bigint | number | string,
  url: string,
  agentId: string,
  intent: unknown,
  ownerWallet: string,
  termsHash?: string,
  action?: unknown,
  advanced?: AdvancedTrustOptions,
): Promise<SignRequestHeadersResult> {
  if (!String(url).trim()) {
    throw new Error("signRequestHeaders requires a non-empty url");
  }
  if (!String(agentId).trim()) {
    throw new Error("signRequestHeaders requires a non-empty agentId");
  }
  if (!String(ownerWallet).trim()) {
    throw new Error("signRequestHeaders requires a non-empty ownerWallet");
  }

  const normalizedPassportId = normalizePassportId(passportId);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const normalizedTermsHash = normalizeTermsHash(termsHash);
  const intentHash = buildIntentHash(intent);
  const actionHash = buildActionHash(action ?? `GET|${url}`);
  const wallet = await getAgentSigner(agentId);
  const signerAccount =
    advanced?.delegatedSession?.sessionAccount ?? wallet.account;

  if (!signerAccount) {
    throw new Error(`Agent signer for ${agentId} is missing an account`);
  }

  const signature = await wallet.signMessage({
    account: signerAccount,
    message: {
      raw: buildTrustDigest({
        passportId: normalizedPassportId,
        url,
        timestamp,
        intentHash,
        termsHash: normalizedTermsHash,
      }),
    },
  });

  const sessionProof = advanced?.delegatedSession
    ? advanced.delegatedSession.ownerProof
    : await wallet.signMessage({
        account: wallet.account!,
        message: {
          raw: buildSessionProofDigest({
            passportId: normalizedPassportId,
            timestamp,
            intentHash,
            termsHash: normalizedTermsHash,
            ownerWallet,
          }),
        },
      });

  const intentProof = await wallet.signMessage({
    account: signerAccount,
    message: {
      raw: buildIntentProofDigest({
        passportId: normalizedPassportId,
        timestamp,
        intentHash,
        actionHash,
        termsHash: normalizedTermsHash,
        ownerWallet,
      }),
    },
  });

  const result: SignRequestHeadersResult = {
    "X-Agent-Passport-ID": normalizedPassportId,
    "X-Agent-Signature": signature,
    "X-Agent-Timestamp": timestamp,
    "X-Agent-Session-Proof": sessionProof,
    "X-Agent-Intent-Hash": intentHash,
    "X-Agent-Action-Hash": actionHash,
    "X-Agent-Intent-Proof": intentProof,
  };

  if (advanced?.delegatedSession) {
    result["X-Agent-Session-Grant"] = encodeHeaderJson(
      advanced.delegatedSession.grant,
    );
  }

  if (advanced?.claims) {
    const { developerSignature, ...unsignedClaims } = advanced.claims;
    result["X-Agent-Claims"] = encodeHeaderJson(advanced.claims);
    result["X-Agent-Claims-Signature"] = developerSignature;

    // Keep the digest builder referenced here so callers can safely source
    // claims from a common packet without recomputing header shapes.
    void buildClaimsDigest(unsignedClaims);
  }

  return result;
}

/**
 * Compatibility helper for existing code paths that still have an encrypted
 * key instead of an `agentId`. Prefer `signRequestHeaders()` for new route
 * integrations.
 */
export async function buildTrustHeaders(opts: {
  passportId: string;
  url: string;
  encryptedKey: string;
  intent?: unknown;
  termsHash?: string;
  action?: unknown;
  delegatedSession?: DelegatedSessionMaterial;
  claims?: ClaimsPacket;
}): Promise<TrustHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const normalizedTermsHash = normalizeTermsHash(opts.termsHash);
  const intentHash = buildIntentHash(opts.intent ?? opts.url);
  const actionHash = buildActionHash(opts.action ?? `GET|${opts.url}`);
  const account = privateKeyToAccount(decryptAgentKey(opts.encryptedKey));
  const signerAccount = opts.delegatedSession?.sessionAccount ?? account;

  const signature = await signerAccount.signMessage({
    message: {
      raw: buildTrustDigest({
        passportId: opts.passportId,
        url: opts.url,
        timestamp,
        intentHash,
        termsHash: normalizedTermsHash,
      }),
    },
  });

  // Compatibility path for the current verify.ts and /api/run usage.
  const sessionProof = opts.delegatedSession?.ownerProof
    ? opts.delegatedSession.ownerProof
    : await account.signMessage({
        message: {
          raw: buildSessionProofDigest({
            passportId: opts.passportId,
            timestamp,
            intentHash,
            termsHash: normalizedTermsHash,
          }),
        },
      });

  const intentProof = await signerAccount.signMessage({
    message: {
      raw: buildIntentProofDigest({
        passportId: opts.passportId,
        timestamp,
        intentHash,
        actionHash,
        termsHash: normalizedTermsHash,
      }),
    },
  });

  const result: TrustHeaders = {
    "X-Agent-Passport-ID": opts.passportId,
    "X-Agent-Signature": signature,
    "X-Agent-Timestamp": timestamp,
    "X-Agent-Session-Proof": sessionProof,
    "X-Agent-Intent-Hash": intentHash,
    "X-Agent-Action-Hash": actionHash,
    "X-Agent-Intent-Proof": intentProof,
  };

  if (opts.delegatedSession) {
    result["X-Agent-Session-Grant"] = encodeHeaderJson(opts.delegatedSession.grant);
  }

  if (opts.claims) {
    result["X-Agent-Claims"] = encodeHeaderJson(opts.claims);
    result["X-Agent-Claims-Signature"] = opts.claims.developerSignature;
  }

  return result;
}
