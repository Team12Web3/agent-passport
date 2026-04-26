"use client";

import { useEffect, useMemo, useState } from "react";
import { keccak256, recoverMessageAddress, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  createUnsignedAgentClaims,
  getClaimsDigest,
  verifyClaimsSignature,
  type AgentClaims,
} from "@/lib/agent/claims";
import {
  buildActionHash,
  buildIntentHash,
  buildIntentProofDigest,
  buildTrustDigest,
} from "@/lib/agent/protocol";
import {
  createSessionGrant,
  getSessionGrantDigest,
  isActionAllowed,
  isAmountAllowed,
  isOriginAllowed,
  isSessionGrantActive,
  verifySessionGrantOwnerProof,
} from "@/lib/agent/session";

type Scenario = "valid" | "tamper-action" | "forge-proof" | "expired-session";

const DEMO_URL = "https://demo.example/payments/checkout";
const DEMO_INTENT = "Buy the cheapest flight under 500 NZD";
const DEMO_ACTION = "CLICK|pay-button|flight-NZ123";
const DEMO_AMOUNT_USD = 68;
const DEMO_TRUST_SCORE = 80;
const SNOWTRACE_BASE = "https://testnet.snowtrace.io/address";

type Capability = "session" | "attestation" | "intent" | "staking" | "baseline";

type Step = {
  label: string;
  ok: boolean;
  detail: string;
  capability: Capability;
};

type StakeSummary = {
  stakeVaultEnabled: boolean;
  activeStakeEth: string;
  totalSlashedEth: string;
  requiredStakeEth: string;
  hasMinimumStake: boolean;
  lastStakeAt: number | null;
};

type Props = {
  passportId: string;
  agentAddress: string;
  agentPrivateKey?: Hex;
  ownerAddress: string;
  trustScore: number;
  active: boolean;
  metadataURI?: string;
};

type ClaimsState = {
  present: boolean;
  verified: boolean | null;
  developer?: string;
  modelPlatform?: string;
};

type PillarId = "identity" | "authorization" | "stake" | "action";

type Pillar = {
  id: PillarId;
  label: string;
  blurb: string;
  capabilities: Capability[];
};

const PILLARS: Pillar[] = [
  {
    id: "identity",
    label: "Who built it?",
    blurb: "Open the black box — see who made this agent and on what model.",
    capabilities: ["attestation"],
  },
  {
    id: "authorization",
    label: "Is it allowed to act?",
    blurb: "Owner-signed session key, like an employee ID with strict rules.",
    capabilities: ["session"],
  },
  {
    id: "stake",
    label: "Skin in the game",
    blurb: "Real money is locked up and can be slashed if it misbehaves.",
    capabilities: ["staking"],
  },
  {
    id: "action",
    label: "Doing what was asked?",
    blurb: "Cryptographic proof the action matches the user's original ask.",
    capabilities: ["intent"],
  },
];

const SCENARIOS: Array<{
  id: Scenario;
  label: string;
  description: string;
}> = [
  {
    id: "valid",
    label: "Normal",
    description: "A real request from the agent's own session key.",
  },
  {
    id: "tamper-action",
    label: "Hijacked action",
    description: "The action got swapped after the user approved their intent.",
  },
  {
    id: "forge-proof",
    label: "Forged signature",
    description: "Someone other than the session key tried to sign the request.",
  },
  {
    id: "expired-session",
    label: "Expired session",
    description: "The owner-issued session key has passed its expiry time.",
  },
];

export function TrustReport({
  passportId,
  agentAddress,
  agentPrivateKey,
  ownerAddress,
  trustScore,
  active,
  metadataURI,
}: Props) {
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [claimsState, setClaimsState] = useState<ClaimsState>({
    present: false,
    verified: null,
  });
  const [stake, setStake] = useState<StakeSummary | null>(null);

  // Detect a signed Open Box claims packet inside metadataURI (data:application/json,...)
  // and verify the developer signature client-side.
  useEffect(() => {
    if (!metadataURI?.startsWith("data:application/json,")) {
      setClaimsState({ present: false, verified: null });
      return;
    }
    try {
      const json = decodeURIComponent(
        metadataURI.slice("data:application/json,".length),
      );
      const parsed = JSON.parse(json);
      if (
        parsed?.["@context"] === "https://agentpassport.dev/claims/v1" &&
        typeof parsed?.developerSignature === "string"
      ) {
        const claims = parsed as AgentClaims;
        verifyClaimsSignature(claims).then((ok) => {
          setClaimsState({
            present: true,
            verified: ok,
            developer: claims.developer,
            modelPlatform: claims.modelPlatform,
          });
        });
      } else {
        setClaimsState({ present: false, verified: null });
      }
    } catch {
      setClaimsState({ present: false, verified: null });
    }
  }, [metadataURI]);

  // Fetch the stake summary from the server-side StakeVault helper.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trust/stake/${encodeURIComponent(passportId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StakeSummary | null) => {
        if (!cancelled) setStake(data);
      })
      .catch(() => {
        if (!cancelled) setStake(null);
      });
    return () => {
      cancelled = true;
    };
  }, [passportId]);

  useEffect(() => {
    if (!agentPrivateKey) return;
    let cancelled = false;
    setRunning(true);
    runPreview({ scenario, passportId, agentPrivateKey, stake })
      .then((result) => {
        if (!cancelled) setSteps(result);
      })
      .catch(() => {
        if (!cancelled) setSteps([]);
      })
      .finally(() => {
        if (!cancelled) setRunning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scenario, agentPrivateKey, passportId, stake]);

  const allOk = useMemo(
    () => steps.length > 0 && steps.every((s) => s.ok),
    [steps],
  );
  const failedLabels = useMemo(
    () => steps.filter((s) => !s.ok).map((s) => s.label),
    [steps],
  );

  // ─── Limited preview (no local agent key) ───
  if (!agentPrivateKey) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-3">
        <ReportHeader ownerAddress={ownerAddress} variant="limited" />
        <p className="text-[12px] text-muted leading-snug">
          We don&apos;t have this passport&apos;s session key in this browser,
          so we can only show its public on-chain state. Mint a passport from
          this browser to run the live trust handshake.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Identity"
            value={active ? "Active" : "Revoked"}
            tone={active ? "ok" : "fail"}
            hint="Passport is on-chain and not revoked."
          />
          <Tile
            label="Trust score"
            value={`${trustScore}`}
            tone={trustScore >= 50 ? "ok" : "warn"}
            hint="Issued by the platform; sites use it as a quick signal."
          />
        </div>
        {agentAddress && (
          <SnowtraceLink address={agentAddress} />
        )}
      </div>
    );
  }

  // ─── Full report ───
  const verdict: VerdictTone = running ? "running" : allOk ? "ok" : "blocked";
  const activeScenario = SCENARIOS.find((s) => s.id === scenario)!;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-3">
      <ReportHeader ownerAddress={ownerAddress} variant="full" />

      <p className="text-[11.5px] text-muted leading-snug">
        Live, on-chain trust check for this agent. When all four pillars below
        verify, sites can serve the agent without CAPTCHA. We re-sign and
        re-verify in your browser every time you switch scenarios.
      </p>

      <Verdict tone={verdict} failedLabels={failedLabels} />

      {/* At-a-glance summary tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Identity"
          value={active ? "Active" : "Revoked"}
          tone={active ? "ok" : "fail"}
          hint="Passport is on-chain and not revoked."
        />
        <Tile
          label="Trust score"
          value={`${trustScore}`}
          tone={trustScore >= 50 ? "ok" : "warn"}
          hint="Higher score = more trusted across sites."
        />
        <Tile
          label="Who built it"
          value={openBoxLabel(claimsState)}
          tone={openBoxTone(claimsState)}
          hint={openBoxHint(claimsState)}
        />
        <Tile
          label="Stake at risk"
          value={stakeTileValue(stake)}
          tone={stakeTileTone(stake)}
          hint={stakeTileHint(stake)}
        />
      </div>

      {/* Scenario picker — explains "what would happen if…" */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-faint uppercase tracking-[0.14em] text-[9.5px]">
            Try a scenario
          </div>
          <div className="text-faint text-[10px]">
            We re-run the handshake for each.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => {
            const selected = scenario === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScenario(s.id);
                }}
                title={s.description}
                className={[
                  "rounded-md px-2 py-1 text-[10.5px] transition",
                  selected
                    ? "bg-white/[0.08] text-fg border border-white/15"
                    : "bg-white/[0.02] text-muted border border-white/[0.06] hover:text-fg hover:border-white/15",
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-muted leading-snug">
          <span className="text-faint">Scenario:</span>{" "}
          <span className="text-fg">{activeScenario.label}.</span>{" "}
          {activeScenario.description}
        </div>
      </div>

      {/* Pillars + their checks */}
      <div className="rounded-md border border-white/[0.05] bg-white/[0.015] p-2 space-y-2">
        {steps.length === 0 && running ? (
          <div className="flex items-center gap-2 text-[11px] text-faint px-1 py-2">
            <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-current border-r-transparent animate-spin" />
            Generating signed headers and verifying…
          </div>
        ) : (
          PILLARS.map((pillar, idx) => {
            const pillarSteps = steps.filter((s) =>
              pillar.capabilities.includes(s.capability),
            );
            if (pillarSteps.length === 0) return null;
            const passCount = pillarSteps.filter((s) => s.ok).length;
            const allPass = passCount === pillarSteps.length;
            return (
              <PillarBlock
                key={pillar.id}
                index={idx + 1}
                pillar={pillar}
                allPass={allPass}
                passCount={passCount}
                total={pillarSteps.length}
                steps={pillarSteps}
              />
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-faint">
        <p className="leading-snug">
          Preview signs with this agent&apos;s real session key. Owner &amp;
          developer signatures are simulated with deterministic keys derived
          from the agent key — nothing leaves your browser.
        </p>
        {agentAddress && (
          <SnowtraceLink address={agentAddress} compact />
        )}
      </div>
    </div>
  );
}

// ───────────────────────── presentational ─────────────────────────

function ReportHeader({
  ownerAddress,
  variant,
}: {
  ownerAddress: string;
  variant: "full" | "limited";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-faint uppercase tracking-[0.14em] text-[10.5px] shrink-0">
          Trust Report
        </div>
        <div className="text-faint text-[10.5px] truncate">
          owner · <span className="font-mono">{shortAddr(ownerAddress)}</span>
        </div>
      </div>
      {variant === "limited" && (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] bg-zinc-700/30 text-zinc-300">
          limited preview
        </span>
      )}
    </div>
  );
}

type VerdictTone = "running" | "ok" | "blocked";

function Verdict({
  tone,
  failedLabels,
}: {
  tone: VerdictTone;
  failedLabels: string[];
}) {
  if (tone === "running") {
    return (
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-current border-r-transparent animate-spin text-muted" />
        <div className="text-[12px] text-fg">Running the trust handshake…</div>
      </div>
    );
  }
  if (tone === "ok") {
    return (
      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-300" />
          <div className="text-[12.5px] font-medium text-emerald-200">
            Trusted to act
          </div>
        </div>
        <div className="mt-1 text-[11px] text-emerald-100/80 leading-snug">
          All four trust pillars verify. A site using Agent Passport would skip
          CAPTCHA and let this agent through.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-rose-400/20 bg-rose-400/10 p-2.5">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-rose-300" />
        <div className="text-[12.5px] font-medium text-rose-200">
          Would be blocked
        </div>
      </div>
      <div className="mt-1 text-[11px] text-rose-100/80 leading-snug">
        {failedLabels.length === 0
          ? "At least one pillar failed — sites would fall back to CAPTCHA."
          : `Failed: ${failedLabels.join(", ")}. Sites fall back to CAPTCHA / 403.`}
      </div>
    </div>
  );
}

type Tone = "ok" | "warn" | "fail" | "subtle";

function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: Tone;
  hint?: string;
}) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "fail"
          ? "text-rose-300"
          : "text-faint";
  return (
    <div
      className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-1.5 min-w-0"
      title={hint}
    >
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-[12px] truncate ${valueClass}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function PillarBlock({
  index,
  pillar,
  allPass,
  passCount,
  total,
  steps,
}: {
  index: number;
  pillar: Pillar;
  allPass: boolean;
  passCount: number;
  total: number;
  steps: Step[];
}) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-black/20 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className={[
              "shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[9.5px] font-semibold",
              allPass
                ? "bg-emerald-400/20 text-emerald-200"
                : "bg-rose-400/20 text-rose-200",
            ].join(" ")}
          >
            {index}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] text-fg leading-tight">
              {pillar.label}
            </div>
            <div className="text-[10.5px] text-faint leading-snug">
              {pillar.blurb}
            </div>
          </div>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
            allPass
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-rose-400/15 text-rose-300",
          ].join(" ")}
        >
          {allPass ? "pass" : `${passCount}/${total}`}
        </span>
      </div>

      <div className="mt-1.5 ml-6 space-y-1">
        {steps.map((step) => (
          <div
            key={step.label}
            className="flex items-start justify-between gap-2 text-[11.5px]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-fg leading-tight">
                {step.ok ? (
                  <CheckCircle className="h-3 w-3 text-emerald-300 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-rose-300 shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
              <div className="mt-0.5 text-faint text-[10.5px] leading-snug ml-4">
                {step.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnowtraceLink({
  address,
  compact = false,
}: {
  address: string;
  compact?: boolean;
}) {
  return (
    <a
      href={`${SNOWTRACE_BASE}/${address}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={[
        "inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-fg",
        compact ? "shrink-0 text-[10.5px]" : "text-[10.5px] text-muted",
      ].join(" ")}
    >
      View on Snowtrace
      <span aria-hidden>↗</span>
    </a>
  );
}

function CheckCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5 8.2 7 10.2l4-4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ───────────────────────── derived helpers ─────────────────────────

function openBoxLabel(s: ClaimsState): string {
  if (!s.present) return "Unsigned";
  if (s.verified === null) return "Checking…";
  return s.verified ? "Signed" : "Tampered";
}
function openBoxTone(s: ClaimsState): Tone {
  if (!s.present) return "subtle";
  if (s.verified === null) return "subtle";
  return s.verified ? "ok" : "fail";
}
function openBoxHint(s: ClaimsState): string {
  if (!s.present) {
    return "No signed claims packet attached to this passport's metadata.";
  }
  if (s.verified) {
    return `Built by ${s.developer ?? "developer"} on ${s.modelPlatform ?? "model"}, signature verified.`;
  }
  return "A claims packet is attached but its developer signature did not verify.";
}

function stakeTileValue(stake: StakeSummary | null): string {
  if (!stake) return "—";
  if (!stake.stakeVaultEnabled) return "n/a";
  return `${trim(stake.activeStakeEth)} AVAX`;
}
function stakeTileTone(stake: StakeSummary | null): Tone {
  if (!stake) return "subtle";
  if (!stake.stakeVaultEnabled) return "subtle";
  return stake.hasMinimumStake ? "ok" : "warn";
}
function stakeTileHint(stake: StakeSummary | null): string {
  if (!stake) return "Loading on-chain stake summary…";
  if (!stake.stakeVaultEnabled) {
    return "StakeVault isn't deployed on this network — informational only.";
  }
  return stake.hasMinimumStake
    ? `Minimum ${trim(stake.requiredStakeEth)} AVAX is met. This can be slashed for abuse.`
    : `Below minimum of ${trim(stake.requiredStakeEth)} AVAX — high-value sites will block.`;
}

function shortAddr(value: string): string {
  if (!value || value.length < 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function trim(value: string): string {
  if (!value) return "0";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toString();
}

function deriveKey(seed: Hex, role: string): Hex {
  return keccak256(toBytes(`${seed}:${role}`));
}

// ───────────────────────── trust handshake ─────────────────────────

async function runPreview({
  scenario,
  passportId,
  agentPrivateKey,
  stake,
}: {
  scenario: Scenario;
  passportId: string;
  agentPrivateKey: Hex;
  stake: StakeSummary | null;
}): Promise<Step[]> {
  // Owner & developer keys are deterministic derivations of the agent key.
  // This makes the preview self-contained — no MetaMask popups, signatures
  // are stable per agent across re-renders, and nothing leaves the browser.
  const ownerAccount = privateKeyToAccount(deriveKey(agentPrivateKey, "owner-proxy"));
  const developerAccount = privateKeyToAccount(deriveKey(agentPrivateKey, "developer-proxy"));
  const sessionAccount = privateKeyToAccount(agentPrivateKey);

  const issuedAt = Math.floor(Date.now() / 1000);
  const timestamp = String(issuedAt);

  const grant = createSessionGrant({
    passportId,
    ownerWallet: ownerAccount.address,
    sessionKey: sessionAccount.address,
    issuedAt,
    expiresAt: scenario === "expired-session" ? issuedAt - 10 : issuedAt + 15 * 60,
    allowedOrigins: [new URL(DEMO_URL).origin],
    allowedActions: [DEMO_ACTION],
    maxAmountUsd: "500",
  });

  const ownerProof = await ownerAccount.signMessage({
    message: { raw: getSessionGrantDigest(grant) },
  });

  const unsignedClaims = createUnsignedAgentClaims({
    passportId,
    developer: "Agent Passport Owner",
    developerWallet: developerAccount.address,
    modelPlatform: "Claude 3.5",
    labels: ["non-crawler", "owner-bound"],
    complianceClaims: ["developer-signed", "session-key-ready"],
    trustScore: DEMO_TRUST_SCORE,
    easUid: null,
    issuedAt,
    sessionKey: sessionAccount.address,
  });
  const developerSignature = await developerAccount.signMessage({
    message: { raw: getClaimsDigest(unsignedClaims) },
  });
  const claims: AgentClaims = { ...unsignedClaims, developerSignature };

  const intentHash = buildIntentHash(DEMO_INTENT);
  const actionHash =
    scenario === "tamper-action"
      ? buildActionHash("CLICK|pay-button|flight-NZ999")
      : buildActionHash(DEMO_ACTION);

  const requestSigner = scenario === "forge-proof" ? developerAccount : sessionAccount;

  const requestSignature = await requestSigner.signMessage({
    message: {
      raw: buildTrustDigest({
        passportId,
        url: DEMO_URL,
        timestamp,
        intentHash,
      }),
    },
  });

  const intentProofSignature = await requestSigner.signMessage({
    message: {
      raw: buildIntentProofDigest({
        passportId,
        timestamp,
        intentHash,
        actionHash,
        ownerWallet: ownerAccount.address,
      }),
    },
  });

  const recoveredRequestSigner = (
    await recoverMessageAddress({
      message: {
        raw: buildTrustDigest({
          passportId,
          url: DEMO_URL,
          timestamp,
          intentHash,
        }),
      },
      signature: requestSignature,
    })
  ).toLowerCase();

  const recoveredIntentSigner = (
    await recoverMessageAddress({
      message: {
        raw: buildIntentProofDigest({
          passportId,
          timestamp,
          intentHash,
          actionHash,
          ownerWallet: ownerAccount.address,
        }),
      },
      signature: intentProofSignature,
    })
  ).toLowerCase();

  const claimsOk = await verifyClaimsSignature(claims);
  const ownerOk = await verifySessionGrantOwnerProof(grant, ownerProof);
  const sessionMatch =
    recoveredRequestSigner === sessionAccount.address.toLowerCase();
  const sessionLive = isSessionGrantActive(grant, Number(timestamp));
  const scopeOk =
    isOriginAllowed(grant, DEMO_URL) &&
    isActionAllowed(grant, DEMO_ACTION) &&
    isAmountAllowed(grant, DEMO_AMOUNT_USD);
  const intentSignerMatches = recoveredRequestSigner === recoveredIntentSigner;

  const stakeStep: Step = stake
    ? stake.stakeVaultEnabled
      ? stake.hasMinimumStake
        ? {
            label: "Stake at risk",
            ok: true,
            detail: `${trim(stake.activeStakeEth)} AVAX is locked up and can be slashed if this agent misbehaves.`,
            capability: "staking",
          }
        : {
            label: "Stake at risk",
            ok: false,
            detail: `Only ${trim(stake.activeStakeEth)} AVAX locked up — below the ${trim(stake.requiredStakeEth)} AVAX minimum for high-value sites.`,
            capability: "staking",
          }
      : {
          label: "Stake at risk",
          ok: true,
          detail:
            "StakeVault isn't deployed on this network. Sites that don't require stake still let the agent through.",
          capability: "staking",
        }
    : {
        label: "Stake at risk",
        ok: true,
        detail: "Loading on-chain stake summary…",
        capability: "staking",
      };

  return [
    {
      label: "Identity proven",
      ok: claimsOk,
      detail: claimsOk
        ? "Signed claims show who built the agent and on what model — verified against the developer key."
        : "The signed claims packet didn't match the developer's signature.",
      capability: "attestation",
    },
    {
      label: "Authorized by owner",
      ok: ownerOk,
      detail: ownerOk
        ? "Owner wallet signed off on this session key — like issuing it an employee ID."
        : "Owner signature did not authorize this session key.",
      capability: "session",
    },
    {
      label: "Signed by the right device",
      ok: sessionMatch,
      detail: sessionMatch
        ? "The request was signed by the agent's own session key, not by an impersonator."
        : "The request was signed by a key that isn't in the session grant.",
      capability: "session",
    },
    {
      label: "Within its time window",
      ok: sessionLive,
      detail: sessionLive
        ? "Session key is still valid (not expired)."
        : "Session key has expired or is not yet active.",
      capability: "session",
    },
    {
      label: "Within its rules",
      ok: scopeOk,
      detail: scopeOk
        ? "Origin, action, and amount are all inside what the owner allowed."
        : "Request is outside the owner's allowed origin, action, or spending cap.",
      capability: "session",
    },
    stakeStep,
    {
      label: "Action matches user's intent",
      ok: intentSignerMatches,
      detail: intentSignerMatches
        ? "The action being taken is exactly what the user originally asked for."
        : "The action no longer matches the user's original ask, or was signed by a different key.",
      capability: "intent",
    },
  ];
}
