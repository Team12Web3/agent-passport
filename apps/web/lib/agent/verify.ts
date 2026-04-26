import "server-only";

import { recoverMessageAddress, type Hex } from "viem";

import {
  decodeClaims,
  verifyClaimsSignature,
  type AgentClaims,
} from "./claims";
import { getPublicClient } from "../chain/client";
import { AgentPassport, assertContractsDeployed } from "../chain/contracts";
import { getSupabase } from "../db/supabase";
import { isNonceUsed, markNonceUsed } from "./nonces";
import {
  decodeSessionGrant,
  isActionAllowed,
  isAmountAllowed,
  isOriginAllowed,
  isSessionGrantActive,
  verifySessionGrantOwnerProof,
  type SessionGrant,
} from "./session";
import { getPassportStakeSummary } from "./staking";
import {
  buildActionHash,
  buildIntentHash,
  buildIntentProofDigest,
  buildSessionProofDigest,
  buildTrustDigest,
} from "./sign";

export type PassportAttributes = {
  developer: string | null;
  developerWallet: Hex | null;
  modelPlatform: string | null;
  labels: string[];
  complianceClaims: string[];
  source: "metadata_uri" | "unresolved";
  easUid: string | null;
  claimsVerified: boolean;
  claimsType: string | null;
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
  | "insufficient_stake"
  | "invalid_intent_proof"
  | "invalid_attestation"
  | "session_scope_violation"
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
  expectedAction?: unknown;
  expectedAmountUsd?: number;
  requireStake?: boolean;
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
const ACTION_HASH_HEADER = "X-Agent-Action-Hash";
const INTENT_PROOF_HEADER = "X-Agent-Intent-Proof";
const SESSION_GRANT_HEADER = "X-Agent-Session-Grant";
const CLAIMS_HEADER = "X-Agent-Claims";
const CLAIMS_SIGNATURE_HEADER = "X-Agent-Claims-Signature";

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
        developerWallet: null,
        modelPlatform: parsed.modelPlatform ?? null,
        labels: Array.isArray(parsed.labels)
          ? parsed.labels.filter((label): label is string => typeof label === "string")
          : [],
        complianceClaims: [],
        source: "metadata_uri",
        easUid: parsed.easUid ?? null,
        claimsVerified: false,
        claimsType: null,
      };
    }
  } catch {
    // Clean extension point: if EAS lookup lands later, wire it in here.
  }

  return {
    developer: null,
    developerWallet: null,
    modelPlatform: null,
    labels: [],
    complianceClaims: [],
    source: "unresolved",
    easUid: null,
    claimsVerified: false,
    claimsType: null,
  };
}

async function resolveClaimsFromMetadata(
  metadataURI: string,
): Promise<AgentClaims | null> {
  if (!metadataURI.startsWith("data:application/json,")) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      decodeURIComponent(metadataURI.slice("data:application/json,".length)),
    ) as Record<string, unknown>;

    if (
      parsed["@context"] === "https://agentpassport.dev/claims/v1" &&
      parsed.type === "AgentPassportClaims"
    ) {
      return parsed as unknown as AgentClaims;
    }
  } catch {
    // fall through
  }

  return null;
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

async function recoverIntentProofSignerCandidates(args: {
  passportId: string;
  timestamp: string;
  intentHash: Hex;
  actionHash: Hex;
  intentProof: Hex;
  ownerWallet: Hex;
}): Promise<Hex[]> {
  const candidates = new Set<Hex>();

  for (const ownerWallet of [args.ownerWallet, undefined] as const) {
    try {
      const recovered = await recoverMessageAddress({
        message: {
          raw: buildIntentProofDigest({
            passportId: args.passportId,
            timestamp: args.timestamp,
            intentHash: args.intentHash,
            actionHash: args.actionHash,
            ownerWallet,
          }),
        },
        signature: args.intentProof,
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
  const actionHash = getHeader(args.headers, ACTION_HASH_HEADER);
  const intentProof = getHeader(args.headers, INTENT_PROOF_HEADER) as Hex | null;
  const encodedSessionGrant = getHeader(args.headers, SESSION_GRANT_HEADER);
  const encodedClaims = getHeader(args.headers, CLAIMS_HEADER);
  const claimsSignature = getHeader(args.headers, CLAIMS_SIGNATURE_HEADER) as
    | Hex
    | null;
  const nonce = getHeader(args.headers, NONCE_HEADER);

  if (
    !passportId ||
    !signature ||
    !timestamp ||
    !sessionProof ||
    !intentHash ||
    !actionHash ||
    !intentProof
  ) {
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
  if (!isHex32(actionHash)) {
    return fail(
      "invalid_intent_proof",
      "Action hash must be a 32-byte hex string.",
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

  let sessionGrant: SessionGrant | null = null;
  if (encodedSessionGrant) {
    try {
      sessionGrant = decodeSessionGrant(encodedSessionGrant);
    } catch {
      return fail("invalid_session_key", "Session grant could not be decoded.");
    }
  }

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
  if (sessionGrant) {
    if (sessionGrant.passportId !== passportId) {
      return fail("invalid_session_key", "Session grant passportId mismatch.");
    }
    if (
      sessionGrant.ownerWallet.toLowerCase() !== passport.owner.toLowerCase()
    ) {
      return fail("invalid_session_key", "Session grant owner mismatch.");
    }
    if (
      sessionGrant.sessionKey.toLowerCase() !== recoveredSigner.toLowerCase()
    ) {
      return fail(
        "invalid_session_key",
        "Request signer does not match the delegated session key.",
      );
    }
    if (
      !(await verifySessionGrantOwnerProof(sessionGrant, sessionProof))
    ) {
      return fail(
        "invalid_session_key",
        "Owner authorization proof for the session key is invalid.",
      );
    }
    const now = Math.floor(Date.now() / 1000);
    if (!isSessionGrantActive(sessionGrant, now)) {
      return fail(
        "session_scope_violation",
        "Session key is expired or not yet active.",
      );
    }
    if (!isOriginAllowed(sessionGrant, args.url)) {
      return fail(
        "session_scope_violation",
        "Session key is not authorized for this origin.",
      );
    }
    if (!isActionAllowed(sessionGrant, args.expectedAction ?? actionHash)) {
      return fail(
        "session_scope_violation",
        "Session key is not authorized for this action.",
      );
    }
    if (!isAmountAllowed(sessionGrant, args.expectedAmountUsd)) {
      return fail(
        "session_scope_violation",
        "Session key exceeds its configured spending limit.",
      );
    }
    signerAuthorized = true;
  } else {
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

  if (args.requireStake) {
    const stake = await getPassportStakeSummary(passportId);
    if (stake.stakeVaultEnabled && !stake.hasMinimumStake) {
      return fail(
        "insufficient_stake",
        `Passport ${passportId} does not meet the required stake of ${stake.requiredStakeEth} ETH.`,
      );
    }
  }

  const recoveredIntentProofSigners = await recoverIntentProofSignerCandidates({
    passportId,
    timestamp,
    intentHash,
    actionHash,
    intentProof,
    ownerWallet: passport.owner,
  });
  if (recoveredIntentProofSigners.length === 0) {
    return fail(
      "invalid_intent_proof",
      "Could not recover signer from intent proof.",
    );
  }

  const normalizedRecoveredSigner = recoveredSigner.toLowerCase();
  const intentProofMatchesSigner = recoveredIntentProofSigners.some(
    (candidate) => candidate.toLowerCase() === normalizedRecoveredSigner,
  );
  if (!intentProofMatchesSigner) {
    return fail(
      "invalid_intent_proof",
      "Intent proof signer does not match the trusted request signer.",
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

  if (
    args.expectedAction !== undefined &&
    buildActionHash(args.expectedAction).toLowerCase() !== actionHash.toLowerCase()
  ) {
    return fail(
      "invalid_intent_proof",
      "Action hash does not match the expected action.",
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

  const metadataClaims = await resolveClaimsFromMetadata(passport.metadataURI);
  let headerClaims: AgentClaims | null = null;
  if (encodedClaims) {
    try {
      headerClaims = decodeClaims(encodedClaims);
    } catch {
      return fail("invalid_attestation", "Claims packet could not be decoded.");
    }
  }
  if (headerClaims && claimsSignature) {
    headerClaims = { ...headerClaims, developerSignature: claimsSignature };
  }

  if (headerClaims) {
    const claimsVerified = await verifyClaimsSignature(headerClaims);
    if (!claimsVerified) {
      return fail(
        "invalid_attestation",
        "Developer signature on the claims packet is invalid.",
      );
    }
    if (headerClaims.passportId !== passportId) {
      return fail("invalid_attestation", "Claims packet passportId mismatch.");
    }
    if (headerClaims.trustScore !== verifiedPassport.trustScore) {
      return fail(
        "invalid_attestation",
        "Claims packet trust score does not match the on-chain passport.",
      );
    }
    if (metadataClaims) {
      const metadataSignatureOk = await verifyClaimsSignature(metadataClaims);
      if (!metadataSignatureOk) {
        return fail(
          "invalid_attestation",
          "On-chain claims packet is missing a valid developer signature.",
        );
      }
      if (
        metadataClaims.developer !== headerClaims.developer ||
        metadataClaims.modelPlatform !== headerClaims.modelPlatform ||
        JSON.stringify([...metadataClaims.labels].sort()) !==
          JSON.stringify([...headerClaims.labels].sort())
      ) {
        return fail(
          "invalid_attestation",
          "Claims header does not match the on-chain passport attestation.",
        );
      }
    }
  }

  let attributes = await resolvePassportAttributes(passport);
  if (metadataClaims) {
    const claimsVerified = await verifyClaimsSignature(metadataClaims);
    attributes = {
      developer: metadataClaims.developer,
      developerWallet: metadataClaims.developerWallet,
      modelPlatform: metadataClaims.modelPlatform,
      labels: metadataClaims.labels,
      complianceClaims: metadataClaims.complianceClaims,
      source: "metadata_uri",
      easUid: metadataClaims.easUid,
      claimsVerified,
      claimsType: metadataClaims.type,
    };
  }

  return {
    ok: true,
    passport: verifiedPassport,
    attributes,
    passportId,
    agentWallet: verifiedPassport.agentWallet,
    trustScore: verifiedPassport.trustScore,
  };
}
