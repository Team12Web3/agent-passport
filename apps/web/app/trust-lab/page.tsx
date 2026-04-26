"use client";

import { useEffect, useMemo, useState } from "react";
import { recoverMessageAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  createUnsignedAgentClaims,
  encodeClaims,
  getClaimsDigest,
  verifyClaimsSignature,
  type AgentClaims,
} from "@/lib/agent/claims";
import {
  buildActionHash,
  buildIntentHash,
  buildIntentProofDigest,
  buildTrustDigest,
  normalizeTermsHash,
} from "@/lib/agent/protocol";
import {
  createSessionGrant,
  encodeSessionGrant,
  getSessionGrantDigest,
  isActionAllowed,
  isAmountAllowed,
  isOriginAllowed,
  isSessionGrantActive,
  verifySessionGrantOwnerProof,
  type SessionGrant,
} from "@/lib/agent/session";

type ScenarioMode =
  | "no-passport"
  | "valid"
  | "no-stake"
  | "slashed-stake"
  | "tamper-action"
  | "forge-proof"
  | "expired-session"
  | "over-budget"
  | "forge-claims";

type DemoHeaders = Record<string, string>;

type VerificationStep = {
  label: string;
  ok: boolean;
  detail: string;
  capability: "session" | "attestation" | "intent" | "staking" | "baseline";
};

type ScenarioResult = {
  mode: ScenarioMode;
  headers: DemoHeaders;
  steps: VerificationStep[];
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
const DEMO_URL = "https://demo.example/payments/checkout";
const DEMO_INTENT = "Buy the cheapest flight under 500 CNY";
const DEMO_ACTION = "CLICK|pay-button|flight-NZ123";
const DEMO_AMOUNT_USD = 68;
const DEMO_TRUST_SCORE = 80;
const DEMO_REQUIRED_STAKE_ETH = "0.1";

const OWNER_ACCOUNT = privateKeyToAccount(OWNER_PRIVATE_KEY);
const SESSION_ACCOUNT = privateKeyToAccount(SESSION_PRIVATE_KEY);
const FORGED_ACCOUNT = privateKeyToAccount(FORGED_PRIVATE_KEY);
const DEVELOPER_ACCOUNT = privateKeyToAccount(DEVELOPER_PRIVATE_KEY);

function shorten(value: string): string {
  if (value.length <= 28) {
    return value;
  }

  return `${value.slice(0, 12)}...${value.slice(-10)}`;
}

async function createClaimsPacket(
  mode: ScenarioMode,
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
    message: {
      raw: getClaimsDigest(unsignedClaims),
    },
  });

  return {
    ...unsignedClaims,
    developerSignature,
  };
}

async function createSessionGrantPacket(
  mode: ScenarioMode,
  issuedAt: number,
): Promise<{ grant: SessionGrant; ownerProof: Hex }> {
  const grant = createSessionGrant({
    passportId: PASSPORT_ID,
    ownerWallet: OWNER_ACCOUNT.address,
    sessionKey: SESSION_ACCOUNT.address,
    issuedAt,
    expiresAt:
      mode === "expired-session" ? issuedAt - 10 : issuedAt + 15 * 60,
    allowedOrigins: ["https://demo.example"],
    allowedActions: [DEMO_ACTION],
    maxAmountUsd: mode === "over-budget" ? "10" : "500",
  });

  const ownerProof = await OWNER_ACCOUNT.signMessage({
    message: {
      raw: getSessionGrantDigest(grant),
    },
  });

  return { grant, ownerProof };
}

async function buildDemoHeaders(
  mode: ScenarioMode,
  intent: string,
  action: string,
  amountUsd: number,
): Promise<{
  headers: DemoHeaders;
  claims: AgentClaims | null;
  sessionGrant: SessionGrant | null;
}> {
  if (mode === "no-passport") {
    return { headers: {}, claims: null, sessionGrant: null };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const termsHash = normalizeTermsHash();
  const intentHash = buildIntentHash(intent);
  const actionHash =
    mode === "tamper-action"
      ? buildActionHash("CLICK|pay-button|flight-NZ999")
      : buildActionHash(action);

  const claims = await createClaimsPacket(mode, Number(timestamp));
  const { grant, ownerProof } = await createSessionGrantPacket(
    mode,
    Number(timestamp),
  );

  const requestSigner =
    mode === "forge-proof" ? FORGED_ACCOUNT : SESSION_ACCOUNT;

  const signature = await requestSigner.signMessage({
    message: {
      raw: buildTrustDigest({
        passportId: PASSPORT_ID,
        url: DEMO_URL,
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

  const headers: DemoHeaders = {
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
    "X-Agent-Amount-Usd": String(amountUsd),
  };

  return { headers, claims, sessionGrant: grant };
}

async function verifyDemoHeaders(
  mode: ScenarioMode,
  headers: DemoHeaders,
  intent: string,
  action: string,
  amountUsd: number,
  claims: AgentClaims | null,
  sessionGrant: SessionGrant | null,
): Promise<ScenarioResult> {
  const steps: VerificationStep[] = [];

  const passportHeadersPresent =
    !!headers["X-Agent-Passport-ID"] &&
    !!headers["X-Agent-Signature"] &&
    !!headers["X-Agent-Timestamp"] &&
    !!headers["X-Agent-Session-Proof"] &&
    !!headers["X-Agent-Session-Grant"] &&
    !!headers["X-Agent-Claims"] &&
    !!headers["X-Agent-Claims-Signature"] &&
    !!headers["X-Agent-Intent-Hash"] &&
    !!headers["X-Agent-Action-Hash"] &&
    !!headers["X-Agent-Intent-Proof"];

  steps.push({
    label: "Passport Headers Present",
    ok: passportHeadersPresent,
    capability: "baseline",
    detail: passportHeadersPresent
      ? "The request includes Passport, session, attestation, and intent headers."
      : "No Passport headers supplied, so the site would show CAPTCHA instead.",
  });

  if (!passportHeadersPresent || !claims || !sessionGrant) {
    return {
      mode,
      headers,
      steps,
      status: "blocked",
      code: "captcha_required",
      message: "Without Passport, the request is blocked immediately.",
      claims,
      sessionGrant,
      stake: null,
    };
  }

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

  const timestamp = headers["X-Agent-Timestamp"];
  const intentHash = headers["X-Agent-Intent-Hash"] as Hex;
  const actionHash = headers["X-Agent-Action-Hash"] as Hex;
  const recoveredSigner = (
    await recoverMessageAddress({
      message: {
        raw: buildTrustDigest({
          passportId: PASSPORT_ID,
          url: DEMO_URL,
          timestamp,
          intentHash,
        }),
      },
      signature: headers["X-Agent-Signature"] as Hex,
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
      signature: headers["X-Agent-Intent-Proof"] as Hex,
    })
  ).toLowerCase();

  const claimsVerified = await verifyClaimsSignature({
    ...claims,
    developerSignature: headers["X-Agent-Claims-Signature"] as Hex,
  });
  const ownerAuthorized = await verifySessionGrantOwnerProof(
    sessionGrant,
    headers["X-Agent-Session-Proof"] as Hex,
  );

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
        isOriginAllowed(sessionGrant, DEMO_URL) &&
        isActionAllowed(sessionGrant, action) &&
        isAmountAllowed(sessionGrant, amountUsd),
      capability: "session",
      detail:
        isOriginAllowed(sessionGrant, DEMO_URL) &&
        isActionAllowed(sessionGrant, action) &&
        isAmountAllowed(sessionGrant, amountUsd)
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
      ok: intentHash.toLowerCase() === buildIntentHash(intent).toLowerCase(),
      capability: "intent",
      detail:
        intentHash.toLowerCase() === buildIntentHash(intent).toLowerCase()
          ? "The current request still matches the original user command."
          : "The request no longer matches the original command.",
    },
    {
      label: "Action Hash Matches",
      ok: actionHash.toLowerCase() === buildActionHash(action).toLowerCase(),
      capability: "intent",
      detail:
        actionHash.toLowerCase() === buildActionHash(action).toLowerCase()
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
      ? "Passport + open-box attestation + delegated session key + verifiable intent unlock the green channel."
      : "At least one trust layer failed, so the site blocks the action.",
  });

  let code = trusted ? "trusted_action_accepted" : "invalid_intent_proof";
  if (!claimsVerified) code = "invalid_attestation";
  if (!ownerAuthorized) code = "invalid_session_key";
  if (!stake.hasMinimumStake) code = "insufficient_stake";
  if (
    ownerAuthorized &&
    (!isSessionGrantActive(sessionGrant, Number(timestamp)) ||
      !isOriginAllowed(sessionGrant, DEMO_URL) ||
      !isActionAllowed(sessionGrant, action) ||
      !isAmountAllowed(sessionGrant, amountUsd))
  ) {
    code = "session_scope_violation";
  }
  if (!passportHeadersPresent) code = "captcha_required";

  return {
    mode,
    headers,
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

function CapabilityBadge({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
        ok
          ? "bg-emerald-400/15 text-emerald-300"
          : "bg-rose-400/15 text-rose-300"
      }`}
    >
      {label}
    </span>
  );
}

export default function TrustLabPage() {
  const [intent, setIntent] = useState(DEMO_INTENT);
  const [action, setAction] = useState(DEMO_ACTION);
  const [amountUsd, setAmountUsd] = useState(DEMO_AMOUNT_USD);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runScenario(mode: ScenarioMode) {
    setIsRunning(true);
    try {
      const demo = await buildDemoHeaders(mode, intent, action, amountUsd);
      const scenarioResult = await verifyDemoHeaders(
        mode,
        demo.headers,
        intent,
        action,
        amountUsd,
        demo.claims,
        demo.sessionGrant,
      );
      setResult(scenarioResult);
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    void runScenario("valid");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capabilitySummary = useMemo(() => {
    const steps = result?.steps ?? [];
    return {
      session: steps
        .filter((step) => step.capability === "session")
        .every((step) => step.ok),
      staking: steps
        .filter((step) => step.capability === "staking")
        .every((step) => step.ok),
      attestation: steps
        .filter((step) => step.capability === "attestation")
        .every((step) => step.ok),
      intent: steps
        .filter((step) => step.capability === "intent")
        .every((step) => step.ok),
    };
  }, [result]);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
            Trust Lab
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Staking + Open Box + Session Keys + Intent Demo
          </h1>
          <p className="max-w-4xl text-sm text-zinc-400">
            This page visualizes four demo-safe trust layers without redesigning
            the current app flow: a slashable stake pool for high-value access,
            a signed JSON-LD attestation packet that turns the agent from a
            black box into an open box, an owner-authorized delegated session
            key that behaves like an employee ID, and intent-bound execution
            proof for the current action.
          </p>
          <div className="flex flex-wrap gap-2">
            <CapabilityBadge
              label="Staking"
              ok={capabilitySummary.staking}
            />
            <CapabilityBadge
              label="Session Keys"
              ok={capabilitySummary.session}
            />
            <CapabilityBadge
              label="Open Box Attestation"
              ok={capabilitySummary.attestation}
            />
            <CapabilityBadge
              label="Bound AA Wallet"
              ok={capabilitySummary.session}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  User Intent
                </label>
                <textarea
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Current Action
                </label>
                <textarea
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Spend Amount (USD)
                </label>
                <input
                  type="number"
                  value={amountUsd}
                  onChange={(event) => setAmountUsd(Number(event.target.value))}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0"
                />
              </div>

              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                URL: <span className="text-zinc-200">{DEMO_URL}</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void runScenario("no-passport")}
                  disabled={isRunning}
                  className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-950 disabled:opacity-60"
                >
                  No Passport
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("valid")}
                  disabled={isRunning}
                  className="rounded-md border border-emerald-800 bg-emerald-950/60 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-950 disabled:opacity-60"
                >
                  All Trust Layers
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("no-stake")}
                  disabled={isRunning}
                  className="rounded-md border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-950 disabled:opacity-60"
                >
                  No Stake
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("slashed-stake")}
                  disabled={isRunning}
                  className="rounded-md border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-950 disabled:opacity-60"
                >
                  Slash Stake
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("expired-session")}
                  disabled={isRunning}
                  className="rounded-md border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-950 disabled:opacity-60"
                >
                  Expired Session Key
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("over-budget")}
                  disabled={isRunning}
                  className="rounded-md border border-amber-800 bg-amber-950/60 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-950 disabled:opacity-60"
                >
                  Over Budget
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("tamper-action")}
                  disabled={isRunning}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60"
                >
                  Tamper Action
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("forge-proof")}
                  disabled={isRunning}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60"
                >
                  Forge Intent Proof
                </button>
                <button
                  type="button"
                  onClick={() => void runScenario("forge-claims")}
                  disabled={isRunning}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60 sm:col-span-2"
                >
                  Forge Attestation
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div
              className={`rounded-lg border p-5 ${
                result?.status === "trusted"
                  ? "border-emerald-700 bg-emerald-950/30"
                  : "border-rose-800 bg-rose-950/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Final Result
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    {result?.status === "trusted"
                      ? "Trusted Action Accepted"
                      : "403 CAPTCHA_REQUIRED"}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                    result?.status === "trusted"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  {result?.code ?? "loading"}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-300">
                {result?.message ??
                  "Generating the claims packet, delegated session key, stake proof, and intent proof..."}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Headers
                </p>
                <div className="mt-4 space-y-2">
                  {Object.entries(result?.headers ?? {}).length ? (
                    Object.entries(result?.headers ?? {}).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
                      >
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                          {key}
                        </div>
                        <div className="mt-1 break-all font-mono text-xs text-zinc-200">
                          {shorten(value)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950 px-3 py-6 text-sm text-zinc-500">
                      No trusted headers supplied.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Verification Steps
                </p>
                <div className="mt-4 space-y-3">
                  {(result?.steps ?? []).map((step) => (
                    <div
                      key={step.label}
                      className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-100">
                            {step.label}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {step.detail}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            step.ok
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-rose-400/15 text-rose-300"
                          }`}
                        >
                          {step.ok ? "pass" : "fail"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Staking Mechanism
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  High-value access is only granted when the passport has active
                  stake. If the website later reports abuse, that stake can be
                  slashed and the green channel disappears.
                </p>
                {result?.stake ? (
                  <div className="mt-4 grid gap-2 text-xs text-zinc-400">
                    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                      Active stake:{" "}
                      <span className="text-zinc-100">
                        {result.stake.activeStakeEth} ETH
                      </span>
                    </div>
                    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                      Total slashed:{" "}
                      <span className="text-zinc-100">
                        {result.stake.totalSlashedEth} ETH
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Session Keys
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  The owner wallet delegates a time-limited session key with an
                  origin, action, and amount budget.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Open Box Attestation
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  The request carries a signed JSON-LD claims packet showing the
                  developer, model stack, compliance labels, and trust score.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Bound AA Wallet Semantics
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  Even if the session key leaks, it is boxed into a limited time
                  window and spending budget instead of getting open-ended wallet
                  powers.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
