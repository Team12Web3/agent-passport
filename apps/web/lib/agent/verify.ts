import "server-only";

import { recoverMessageAddress, type Hex } from "viem";

import { getPublicClient } from "../chain/client";
import { AgentPassport, assertContractsDeployed } from "../chain/contracts";
import { getSupabase } from "../db/supabase";
import { isNonceUsed, markNonceUsed } from "./nonces";
import {
  buildIntentHash,
  buildSessionProofDigest,
  buildTrustDigest,
} from "./sign";

export type PassportAttributes = {
  developer: string | null;
  modelPlatform: string | null;
  labels: string[];
  source: "metadata_uri" | "unresolved";
  easUid: string | null;
};

export type VerifiedPassport = {
  id: string;
  owner: Hex;
  agentWallet: Hex;
  metadataURI: string;
  active: boolean;
  createdAt: bigint;
  trustScore: number;
};

export type VerifyFailureReason =
  | "captcha_required"
  | "stale_timestamp"
  | "bad_signature"
  | "invalid_session_key"
  | "invalid_intent_proof"
  | "replayed_nonce"
  | "untrusted_agent";

export type VerifyResult =
  | {
      ok: true;
      passport: VerifiedPassport;
      attributes: PassportAttributes;
      passportId: string;
      agentWallet: Hex;
      trustScore: number;
    }
  | {
      ok: false;
      reason: VerifyFailureReason;
      code: VerifyFailureReason;
      message: string;
    };

export type VerifyAgentHeadersInput = {
  headers: Headers;
  url: string;
  expectedIntent?: unknown;
};

type PassportRecord = {
  owner: Hex;
  agentWallet: Hex;
  metadataURI: string;
  active: boolean;
  createdAt: bigint;
  trustScore: number | bigint;
};

const MAX_SKEW_SECONDS = 60;
const NONCE_HEADER = "X-Agent-Nonce";

function fail(reason: VerifyFailureReason, message: string): VerifyResult {
  return {
    ok: false,
    reason,
    code: reason,
    message,
  };
}

function getHeader(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function isHex32(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function resolvePassportAttributes(
  passport: Pick<PassportRecord, "metadataURI">,
): Promise<PassportAttributes> {
  const metadataURI = passport.metadataURI;

  try {
    if (metadataURI.startsWith("data:application/json,")) {
      const parsed = JSON.parse(
        decodeURIComponent(metadataURI.slice("data:application/json,".length)),
      ) as {
        developer?: string;
        modelPlatform?: string;
        labels?: unknown;
        easUid?: string | null;
      };

      return {
        developer: parsed.developer ?? null,
        modelPlatform: parsed.modelPlatform ?? null,
        labels: Array.isArray(parsed.labels)
          ? parsed.labels.filter((label): label is string => typeof label === "string")
          : [],
        source: "metadata_uri",
        easUid: parsed.easUid ?? null,
      };
    }
  } catch {
    // Clean extension point: if EAS lookup lands later, wire it in here.
  }

  return {
    developer: null,
    modelPlatform: null,
    labels: [],
    source: "unresolved",
    easUid: null,
  };
}

async function lookupAgentIdByPassportId(passportId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("agents")
    .select("id")
    .eq("passport_id", passportId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to look up agent for passport ${passportId}: ${error.message}`);
  }

  return data?.id ?? null;
}

async function isAuthorizedSessionSigner(
  passport: Pick<PassportRecord, "owner" | "agentWallet">,
  recoveredSigner: Hex,
  recoveredSessionSigner: Hex,
): Promise<boolean> {
  const normalizedSigner = recoveredSigner.toLowerCase();
  const normalizedSessionSigner = recoveredSessionSigner.toLowerCase();

  if (normalizedSessionSigner !== normalizedSigner) {
    return false;
  }

  if (normalizedSigner === passport.agentWallet.toLowerCase()) {
    return true;
  }

  // Extension point for the future on-chain session-key registry described in
  // docs/04-onchain-contracts.md. Once deployed, query it here and allow the
  // recovered signer if the owner has authorized that session key.
  void passport.owner;
  return false;
}

async function recoverSessionSignerCandidates(args: {
  passportId: string;
  timestamp: string;
  intentHash: Hex;
  sessionProof: Hex;
  ownerWallet: Hex;
}): Promise<Hex[]> {
  const candidates = new Set<Hex>();

  for (const ownerWallet of [args.ownerWallet, undefined] as const) {
    try {
      const recovered = await recoverMessageAddress({
        message: {
          raw: buildSessionProofDigest({
            passportId: args.passportId,
            timestamp: args.timestamp,
            intentHash: args.intentHash,
            ownerWallet,
          }),
        },
        signature: args.sessionProof,
      });
      candidates.add(recovered);
    } catch {
      // Ignore this candidate and keep trying compatibility fallbacks.
    }
  }

  return [...candidates];
}

/**
 * Verifies the trust-header bundle on an inbound site request.
 *
 * Caller notes:
 * - `url` must match the URL the agent signed, including query string.
 * - `expectedIntent` is optional, but if provided it must be the same value
 *   used to compute the original intent hash on the sender side.
 */
export async function verifyAgentHeaders(
  args: VerifyAgentHeadersInput,
): Promise<VerifyResult> {
  assertContractsDeployed();

  if (!String(args.url).trim()) {
    throw new Error("verifyAgentHeaders requires a non-empty url");
  }

  const passportId = getHeader(args.headers, "X-Agent-Passport-ID");
  const signature = getHeader(args.headers, "X-Agent-Signature") as Hex | null;
  const timestamp = getHeader(args.headers, "X-Agent-Timestamp");
  const sessionProof = getHeader(
    args.headers,
    "X-Agent-Session-Proof",
  ) as Hex | null;
  const intentHash = getHeader(args.headers, "X-Agent-Intent-Hash");
  const nonce = getHeader(args.headers, NONCE_HEADER);

  if (!passportId || !signature || !timestamp || !sessionProof || !intentHash) {
    return fail("captcha_required", "Missing one or more trust headers.");
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return fail(
      "stale_timestamp",
      `Timestamp out of +/-${MAX_SKEW_SECONDS}s window.`,
    );
  }

  if (!isHex32(intentHash)) {
    return fail(
      "invalid_intent_proof",
      "Intent hash must be a 32-byte hex string.",
    );
  }

  let recoveredSigner: Hex;
  try {
    recoveredSigner = await recoverMessageAddress({
      message: {
        raw: buildTrustDigest({
          passportId,
          url: args.url,
          timestamp,
          intentHash,
        }),
      },
      signature,
    });
  } catch {
    return fail(
      "bad_signature",
      "Could not recover signer from trust signature.",
    );
  }

  const passport = (await getPublicClient().readContract({
    address: AgentPassport.address,
    abi: AgentPassport.abi as never,
    functionName: "getPassport",
    args: [BigInt(passportId)],
  })) as PassportRecord;

  const signerMatchesWallet =
    recoveredSigner.toLowerCase() === passport.agentWallet.toLowerCase();
  const recoveredSessionSigners = await recoverSessionSignerCandidates({
    passportId,
    timestamp,
    intentHash,
    sessionProof,
    ownerWallet: passport.owner,
  });

  if (recoveredSessionSigners.length === 0) {
    return fail(
      "invalid_session_key",
      "Could not recover signer from session proof.",
    );
  }

  let signerAuthorized = false;
  for (const recoveredSessionSigner of recoveredSessionSigners) {
    if (
      await isAuthorizedSessionSigner(
        passport,
        recoveredSigner,
        recoveredSessionSigner,
      )
    ) {
      signerAuthorized = true;
      break;
    }
  }

  if (!signerMatchesWallet && !signerAuthorized) {
    return fail(
      "untrusted_agent",
      "Signer does not match the passport wallet or an authorized session key.",
    );
  }

  if (!passport.active) {
    return fail("untrusted_agent", "Passport is inactive.");
  }

  if (!signerAuthorized) {
    return fail(
      "invalid_session_key",
      "Session proof signer is not authorized for this passport.",
    );
  }

  if (
    args.expectedIntent !== undefined &&
    buildIntentHash(args.expectedIntent).toLowerCase() !== intentHash.toLowerCase()
  ) {
    return fail(
      "invalid_intent_proof",
      "Intent hash does not match the expected intent.",
    );
  }

  if (nonce) {
    const agentId = await lookupAgentIdByPassportId(passportId);
    if (!agentId) {
      return fail(
        "replayed_nonce",
        `Could not resolve a local agent row for passport ${passportId}.`,
      );
    }

    if (await isNonceUsed(agentId, nonce)) {
      return fail("replayed_nonce", "Nonce has already been used.");
    }

    const marked = await markNonceUsed(agentId, nonce);
    if (!marked) {
      return fail("replayed_nonce", "Nonce could not be marked as used.");
    }
  }

  const verifiedPassport: VerifiedPassport = {
    id: passportId,
    owner: passport.owner,
    agentWallet: passport.agentWallet,
    metadataURI: passport.metadataURI,
    active: passport.active,
    createdAt: passport.createdAt,
    trustScore: Number(passport.trustScore),
  };

  const attributes = await resolvePassportAttributes(passport);

  return {
    ok: true,
    passport: verifiedPassport,
    attributes,
    passportId,
    agentWallet: verifiedPassport.agentWallet,
    trustScore: verifiedPassport.trustScore,
  };
}
