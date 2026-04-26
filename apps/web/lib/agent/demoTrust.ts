import { recoverMessageAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  createUnsignedAgentClaims,
  decodeClaims,
  encodeClaims,
  getClaimsDigest,
  verifyClaimsSignature,
  type AgentClaims,
} from "./claims";
import {
  buildActionHash,
  buildIntentHash,
  buildIntentProofDigest,
  buildTrustDigest,
  normalizeTermsHash,
} from "./protocol";
import {
  createSessionGrant,
  decodeSessionGrant,
  encodeSessionGrant,
  getSessionGrantDigest,
  isActionAllowed,
  isAmountAllowed,
  isOriginAllowed,
  isSessionGrantActive,
  verifySessionGrantOwnerProof,
  type SessionGrant,
} from "./session";

export type DemoScenarioMode =
  | "no-passport"
  | "valid"
  | "no-stake"
  | "slashed-stake"
  | "tamper-action"
  | "forge-proof"
  | "expired-session"
  | "over-budget"
  | "forge-claims";

export type DemoHeaders = Record<string, string>;

export type DemoVerificationStep = {
  label: string;
  ok: boolean;
  detail: string;
  capability: "session" | "attestation" | "intent" | "staking" | "baseline";
};

export type DemoScenarioResult = {
  mode: DemoScenarioMode;
  headers: DemoHeaders;
  steps: DemoVerificationStep[];
  status: "blocked" | "trusted";
  code: string;
  message: string;
  claims: AgentClaims | null;
  sessionGrant: SessionGrant | null;
  stake: {
    activeStakeEth: string;
    totalSlashedEth: string;
    requiredStakeEth: string;
    hasMinimumStake: boolean;
  } | null;
};

const OWNER_PRIVATE_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const SESSION_PRIVATE_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const FORGED_PRIVATE_KEY =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const DEVELOPER_PRIVATE_KEY =
  "0x4444444444444444444444444444444444444444444444444444444444444444";

const PASSPORT_ID = "42";
const DEMO_REQUIRED_STAKE_ETH = "0.1";
const DEMO_TRUST_SCORE = 80;

const OWNER_ACCOUNT = privateKeyToAccount(OWNER_PRIVATE_KEY);
const SESSION_ACCOUNT = privateKeyToAccount(SESSION_PRIVATE_KEY);
const FORGED_ACCOUNT = privateKeyToAccount(FORGED_PRIVATE_KEY);
const DEVELOPER_ACCOUNT = privateKeyToAccount(DEVELOPER_PRIVATE_KEY);

async function createClaimsPacket(
  mode: DemoScenarioMode,
  issuedAt: number,
): Promise<AgentClaims> {
  const signer = mode === "forge-claims" ? FORGED_ACCOUNT : DEVELOPER_ACCOUNT;
  const unsignedClaims = createUnsignedAgentClaims({
    passportId: PASSPORT_ID,
    developer: "Vicky",
    developerWallet: DEVELOPER_ACCOUNT.address,
    modelPlatform: "Claude 3.5",
    labels: ["non-crawler", "high-trust"],
    complianceClaims: [
      "developer-signed",
      "json-ld-claims",
      "session-key-ready",
    ],
    trustScore: DEMO_TRUST_SCORE,
    easUid: "0xeas-demo-v1",
    issuedAt,
    sessionKey: SESSION_ACCOUNT.address,
  });

  const developerSignature = await signer.signMessage({
    message: { raw: getClaimsDigest(unsignedClaims) },
  });

  return {
    ...unsignedClaims,
    developerSignature,
  };
}

async function createSessionGrantPacket(
  url: string,
  action: string,
  mode: DemoScenarioMode,
  issuedAt: number,
): Promise<{ grant: SessionGrant; ownerProof: Hex }> {
  const grant = createSessionGrant({
    passportId: PASSPORT_ID,
    ownerWallet: OWNER_ACCOUNT.address,
    sessionKey: SESSION_ACCOUNT.address,
    issuedAt,
    expiresAt:
      mode === "expired-session" ? issuedAt - 10 : issuedAt + 15 * 60,
    allowedOrigins: [new URL(url).origin],
    allowedActions: [action],
    maxAmountUsd: mode === "over-budget" ? "10" : "500",
  });

  const ownerProof = await OWNER_ACCOUNT.signMessage({
    message: { raw: getSessionGrantDigest(grant) },
  });

  return { grant, ownerProof };
}

export async function buildDemoTrustedHeaders(args: {
  url: string;
  intent: string;
  action: string;
  amountUsd: number;
  mode?: DemoScenarioMode;
}): Promise<{
  headers: DemoHeaders;
  claims: AgentClaims | null;
  sessionGrant: SessionGrant | null;
}> {
  const mode = args.mode ?? "valid";
  if (mode === "no-passport") {
    return { headers: {}, claims: null, sessionGrant: null };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const termsHash = normalizeTermsHash();
  const intentHash = buildIntentHash(args.intent);
  const actionHash =
    mode === "tamper-action"
      ? buildActionHash("CLICK|tampered|unexpected")
      : buildActionHash(args.action);

  const claims = await createClaimsPacket(mode, Number(timestamp));
  const { grant, ownerProof } = await createSessionGrantPacket(
    args.url,
    args.action,
    mode,
    Number(timestamp),
  );

  const requestSigner = mode === "forge-proof" ? FORGED_ACCOUNT : SESSION_ACCOUNT;
  const signature = await requestSigner.signMessage({
    message: {
      raw: buildTrustDigest({
        passportId: PASSPORT_ID,
        url: args.url,
        timestamp,
        intentHash,
        termsHash,
      }),
    },
  });

  const intentProofSigner = mode === "forge-proof" ? FORGED_ACCOUNT : SESSION_ACCOUNT;
  const intentProof = await intentProofSigner.signMessage({
    message: {
      raw: buildIntentProofDigest({
        passportId: PASSPORT_ID,
        timestamp,
        intentHash,
        actionHash,
        ownerWallet: OWNER_ACCOUNT.address,
        termsHash,
      }),
    },
  });

  return {
    claims,
    sessionGrant: grant,
    headers: {
      "X-Agent-Passport-ID": PASSPORT_ID,
      "X-Agent-Signature": signature,
      "X-Agent-Timestamp": timestamp,
      "X-Agent-Session-Proof": ownerProof,
      "X-Agent-Session-Grant": encodeSessionGrant(grant),
      "X-Agent-Intent-Hash": intentHash,
      "X-Agent-Action-Hash": actionHash,
      "X-Agent-Intent-Proof": intentProof,
      "X-Agent-Claims": encodeClaims(claims),
      "X-Agent-Claims-Signature": claims.developerSignature,
      "X-Agent-Amount-Usd": String(args.amountUsd),
    },
  };
}

export async function verifyDemoTrustedHeaders(args: {
  headers: Headers;
  url: string;
  intent: string;
  action: string;
  amountUsd: number;
  mode?: DemoScenarioMode;
}): Promise<DemoScenarioResult> {
  const mode = args.mode ?? "valid";
  const headersObject = Object.fromEntries(args.headers.entries());
  const steps: DemoVerificationStep[] = [];

  const passportHeadersPresent =
    !!headersObject["x-agent-passport-id"] &&
    !!headersObject["x-agent-signature"] &&
    !!headersObject["x-agent-timestamp"] &&
    !!headersObject["x-agent-session-proof"] &&
    !!headersObject["x-agent-session-grant"] &&
    !!headersObject["x-agent-claims"] &&
    !!headersObject["x-agent-claims-signature"] &&
    !!headersObject["x-agent-intent-hash"] &&
    !!headersObject["x-agent-action-hash"] &&
    !!headersObject["x-agent-intent-proof"];

  steps.push({
    label: "Passport Headers Present",
    ok: passportHeadersPresent,
    capability: "baseline",
    detail: passportHeadersPresent
      ? "The request includes Passport, session, attestation, and intent headers."
      : "No Passport headers supplied, so the site would show CAPTCHA instead.",
  });

  if (!passportHeadersPresent) {
    return {
      mode,
      headers: headersObject,
      steps,
      status: "blocked",
      code: "captcha_required",
      message: "Without Passport, the request is blocked immediately.",
      claims: null,
      sessionGrant: null,
      stake: null,
    };
  }

  const claims = decodeClaims(headersObject["x-agent-claims"]);
  const sessionGrant = decodeSessionGrant(headersObject["x-agent-session-grant"]);

  const timestamp = headersObject["x-agent-timestamp"];
  const intentHash = headersObject["x-agent-intent-hash"] as Hex;
  const actionHash = headersObject["x-agent-action-hash"] as Hex;

  const recoveredSigner = (
    await recoverMessageAddress({
      message: {
        raw: buildTrustDigest({
          passportId: PASSPORT_ID,
          url: args.url,
          timestamp,
          intentHash,
        }),
      },
      signature: headersObject["x-agent-signature"] as Hex,
    })
  ).toLowerCase();

  const intentProofSigner = (
    await recoverMessageAddress({
      message: {
        raw: buildIntentProofDigest({
          passportId: PASSPORT_ID,
          timestamp,
          intentHash,
          actionHash,
          ownerWallet: OWNER_ACCOUNT.address,
        }),
      },
      signature: headersObject["x-agent-intent-proof"] as Hex,
    })
  ).toLowerCase();

  const claimsVerified = await verifyClaimsSignature({
    ...claims,
    developerSignature: headersObject["x-agent-claims-signature"] as Hex,
  });
  const ownerAuthorized = await verifySessionGrantOwnerProof(
    sessionGrant,
    headersObject["x-agent-session-proof"] as Hex,
  );
  const stake =
    mode === "no-stake"
      ? {
          activeStakeEth: "0",
          totalSlashedEth: "0",
          requiredStakeEth: DEMO_REQUIRED_STAKE_ETH,
          hasMinimumStake: false,
        }
      : mode === "slashed-stake"
        ? {
            activeStakeEth: "0",
            totalSlashedEth: DEMO_REQUIRED_STAKE_ETH,
            requiredStakeEth: DEMO_REQUIRED_STAKE_ETH,
            hasMinimumStake: false,
          }
        : {
            activeStakeEth: DEMO_REQUIRED_STAKE_ETH,
            totalSlashedEth: "0",
            requiredStakeEth: DEMO_REQUIRED_STAKE_ETH,
            hasMinimumStake: true,
          };

  steps.push(
    {
      label: "Open Box Attestation",
      ok: claimsVerified,
      capability: "attestation",
      detail: claimsVerified
        ? `Signed JSON-LD claims say this agent was built by ${claims.developer} on ${claims.modelPlatform}.`
        : "The signed claims packet failed developer-signature verification.",
    },
    {
      label: "Session Key Authorized",
      ok: ownerAuthorized,
      capability: "session",
      detail: ownerAuthorized
        ? "The owner wallet signed an employee-ID style session grant for this session key."
        : "The session grant is not authorized by the owner wallet.",
    },
    {
      label: "Bound AA Wallet Semantics",
      ok: recoveredSigner === sessionGrant.sessionKey.toLowerCase(),
      capability: "session",
      detail:
        recoveredSigner === sessionGrant.sessionKey.toLowerCase()
          ? "The request was signed by the delegated session key, not by an arbitrary impersonator."
          : "The request signer does not match the delegated session key.",
    },
    {
      label: "Session Window Active",
      ok: isSessionGrantActive(sessionGrant, Number(timestamp)),
      capability: "session",
      detail: isSessionGrantActive(sessionGrant, Number(timestamp))
        ? "The session key is still within its authorized time window."
        : "The session key is expired or not yet active.",
    },
    {
      label: "Session Scope Enforced",
      ok:
        isOriginAllowed(sessionGrant, args.url) &&
        isActionAllowed(sessionGrant, args.action) &&
        isAmountAllowed(sessionGrant, args.amountUsd),
      capability: "session",
      detail:
        isOriginAllowed(sessionGrant, args.url) &&
        isActionAllowed(sessionGrant, args.action) &&
        isAmountAllowed(sessionGrant, args.amountUsd)
          ? "The session key is only operating on the allowed origin, action, and amount."
          : "The session key exceeded its allowed origin, action, or spending scope.",
    },
    {
      label: "Slashable Stake Present",
      ok: stake.hasMinimumStake,
      capability: "staking",
      detail: stake.hasMinimumStake
        ? `The passport has at least ${stake.requiredStakeEth} ETH at risk, so abuse is slashable.`
        : "The passport does not have enough active stake for high-value access.",
    },
    {
      label: "Intent Hash Matches",
      ok: intentHash.toLowerCase() === buildIntentHash(args.intent).toLowerCase(),
      capability: "intent",
      detail:
        intentHash.toLowerCase() === buildIntentHash(args.intent).toLowerCase()
          ? "The current request still matches the original user command."
          : "The request no longer matches the original command.",
    },
    {
      label: "Action Hash Matches",
      ok: actionHash.toLowerCase() === buildActionHash(args.action).toLowerCase(),
      capability: "intent",
      detail:
        actionHash.toLowerCase() === buildActionHash(args.action).toLowerCase()
          ? "The current execution step still matches the expected action."
          : "The current action was tampered after the original intent.",
    },
    {
      label: "Intent Proof Signer Valid",
      ok: intentProofSigner === recoveredSigner,
      capability: "intent",
      detail:
        intentProofSigner === recoveredSigner
          ? "The same trusted session signer produced the intent proof."
          : "The intent proof was forged by a different signer.",
    },
  );

  const trusted = steps.every((step) => step.ok);
  steps.push({
    label: "Trusted Action Approved",
    ok: trusted,
    capability: "baseline",
    detail: trusted
      ? "Passport + active stake + signed claims + delegated session key + verifiable intent unlock the green channel."
      : "At least one trust layer failed, so the site blocks the action.",
  });

  let code = trusted ? "trusted_action_accepted" : "invalid_intent_proof";
  if (!claimsVerified) code = "invalid_attestation";
  if (!ownerAuthorized) code = "invalid_session_key";
  if (!stake.hasMinimumStake) code = "insufficient_stake";
  if (
    ownerAuthorized &&
    (!isSessionGrantActive(sessionGrant, Number(timestamp)) ||
      !isOriginAllowed(sessionGrant, args.url) ||
      !isActionAllowed(sessionGrant, args.action) ||
      !isAmountAllowed(sessionGrant, args.amountUsd))
  ) {
    code = "session_scope_violation";
  }

  return {
    mode,
    headers: headersObject,
    steps,
    status: trusted ? "trusted" : "blocked",
    code,
    message: trusted
      ? "The website can now verify the stake, claims packet, delegated session key, and current action instantly."
      : "The trust stack detected a missing passport, empty stake pool, bad claims, or a session-policy violation and blocked the request.",
    claims,
    sessionGrant,
    stake,
  };
}
