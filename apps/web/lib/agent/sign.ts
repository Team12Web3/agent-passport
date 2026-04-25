import "server-only";

import { keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { decryptAgentKey, getAgentSigner } from "./wallet";

export type TrustHeaders = {
  "X-Agent-Passport-ID": string;
  "X-Agent-Signature": string;
  "X-Agent-Timestamp": string;
  "X-Agent-Session-Proof": string;
  "X-Agent-Intent-Hash": string;
};

export type SignRequestHeadersResult = TrustHeaders;

type TrustMaterialOptions = {
  passportId: string;
  url: string;
  timestamp: string;
  intentHash: Hex;
  termsHash?: Hex;
};

type SessionMaterialOptions = {
  passportId: string;
  timestamp: string;
  intentHash: Hex;
  termsHash?: Hex;
  ownerWallet?: string;
};

function normalizePassportId(passportId: bigint | number | string): string {
  return typeof passportId === "string" ? passportId : String(passportId);
}

function normalizeTermsHash(termsHash?: string): Hex {
  if (termsHash) {
    return /^0x[0-9a-fA-F]{64}$/.test(termsHash)
      ? (termsHash.toLowerCase() as Hex)
      : keccak256(toBytes(termsHash));
  }

  return keccak256(
    toBytes(process.env.AGENT_TERMS_TEXT ?? "agent-passport-demo-terms-v1"),
  );
}

function canonicalizeIntent(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeIntent(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeIntent(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function buildIntentHash(intent: unknown): Hex {
  return keccak256(toBytes(canonicalizeIntent(intent)));
}

function buildTrustPayload(options: TrustMaterialOptions): string {
  const termsHash = options.termsHash ?? normalizeTermsHash();
  return [
    options.passportId,
    options.url,
    options.timestamp,
    termsHash,
    options.intentHash,
  ].join("|");
}

function buildSessionPayload(options: SessionMaterialOptions): string {
  const termsHash = options.termsHash ?? normalizeTermsHash();
  return [
    "session",
    options.passportId,
    options.ownerWallet?.toLowerCase() ?? "unbound",
    options.timestamp,
    termsHash,
    options.intentHash,
  ].join("|");
}

export function buildTrustDigest(options: TrustMaterialOptions): Hex {
  return keccak256(toBytes(buildTrustPayload(options)));
}

export function buildSessionProofDigest(options: SessionMaterialOptions): Hex {
  return keccak256(toBytes(buildSessionPayload(options)));
}

/**
 * Signs the full trust-header bundle for an outbound agent request.
 *
 * Caller notes:
 * - `url` must be the exact URL the downstream verifier will check.
 * - `intent` must be the original user instruction or a stable object derived
 *   from it, because verify may recompute the same hash.
 * - `ownerWallet` should be the user wallet that owns or authorizes this agent.
 */
export async function signRequestHeaders(
  passportId: bigint | number | string,
  url: string,
  agentId: string,
  intent: unknown,
  ownerWallet: string,
  termsHash?: string,
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
  const wallet = await getAgentSigner(agentId);

  if (!wallet.account) {
    throw new Error(`Agent signer for ${agentId} is missing an account`);
  }

  const signature = await wallet.signMessage({
    account: wallet.account,
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

  const sessionProof = await wallet.signMessage({
    account: wallet.account,
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

  return {
    "X-Agent-Passport-ID": normalizedPassportId,
    "X-Agent-Signature": signature,
    "X-Agent-Timestamp": timestamp,
    "X-Agent-Session-Proof": sessionProof,
    "X-Agent-Intent-Hash": intentHash,
  };
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
}): Promise<TrustHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const normalizedTermsHash = normalizeTermsHash(opts.termsHash);
  const intentHash = buildIntentHash(opts.intent ?? opts.url);
  const account = privateKeyToAccount(decryptAgentKey(opts.encryptedKey));

  const signature = await account.signMessage({
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
  const sessionProof = await account.signMessage({
    message: {
      raw: buildSessionProofDigest({
        passportId: opts.passportId,
        timestamp,
        intentHash,
        termsHash: normalizedTermsHash,
      }),
    },
  });

  return {
    "X-Agent-Passport-ID": opts.passportId,
    "X-Agent-Signature": signature,
    "X-Agent-Timestamp": timestamp,
    "X-Agent-Session-Proof": sessionProof,
    "X-Agent-Intent-Hash": intentHash,
  };
}
