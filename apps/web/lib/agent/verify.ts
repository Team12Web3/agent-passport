import "server-only";
import { recoverMessageAddress, type Hex } from "viem";
import { getPublicClient } from "../chain/client";
import { AgentPassport } from "../chain/contracts";
import { digestForVerify } from "./sign";

// ─── Person-2 stub (TEMPORARY) ─────────────────────────────────────────────
// Trust-header verification used by /api/trust/demo-site. Person 2 will
// flesh this out (caching, replay-window tuning); we only need the
// success/failure shape for the demo to work.
// ────────────────────────────────────────────────────────────────────────────

export type VerifyResult =
  | {
      ok: true;
      passportId: string;
      agentWallet: Hex;
      trustScore: number;
    }
  | {
      ok: false;
      code:
        | "captcha_required"
        | "stale_timestamp"
        | "bad_signature"
        | "untrusted_agent";
      message: string;
    };

const MAX_SKEW_SECONDS = 60;

export async function verifyAgentHeaders(args: {
  headers: Headers;
  url: string;
}): Promise<VerifyResult> {
  const passportId = args.headers.get("x-agent-passport-id");
  const signature  = args.headers.get("x-agent-signature") as Hex | null;
  const timestamp  = args.headers.get("x-agent-timestamp");

  if (!passportId || !signature || !timestamp) {
    return {
      ok: false,
      code: "captcha_required",
      message: "Missing one or more trust headers.",
    };
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return {
      ok: false,
      code: "stale_timestamp",
      message: `Timestamp out of ±${MAX_SKEW_SECONDS}s window.`,
    };
  }

  let recovered: Hex;
  try {
    const message = digestForVerify(passportId, args.url, timestamp);
    recovered = await recoverMessageAddress({
      message: { raw: message },
      signature,
    });
  } catch {
    return {
      ok: false,
      code: "bad_signature",
      message: "Could not recover signer.",
    };
  }

  const pub = getPublicClient();
  const passport = (await pub.readContract({
    address: AgentPassport.address,
    abi: AgentPassport.abi as never,
    functionName: "getPassport",
    args: [BigInt(passportId)],
  })) as {
    owner: Hex;
    agentWallet: Hex;
    metadataURI: string;
    active: boolean;
    createdAt: bigint;
    trustScore: number;
  };

  if (
    passport.agentWallet.toLowerCase() !== recovered.toLowerCase() ||
    !passport.active
  ) {
    return {
      ok: false,
      code: "untrusted_agent",
      message: "Signer does not match an active passport.",
    };
  }

  return {
    ok: true,
    passportId,
    agentWallet: passport.agentWallet,
    trustScore: Number(passport.trustScore),
  };
}
