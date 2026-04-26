import "server-only";

import { z } from "zod";

import { json, validationError } from "../../_lib/responses";
import {
  verifyDemoTrustedHeaders,
  type DemoScenarioMode,
} from "@/lib/agent/demoTrust";
import { verifyAgentHeaders } from "@/lib/agent/verify";
import { sanitizeHostileHtml } from "@/lib/relay/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().url(),
  intent: z.string().min(1).max(2000),
  action: z.string().min(1).max(2000),
  amountUsd: z.number().finite().nonnegative(),
  mode: z
    .enum([
      "no-passport",
      "valid",
      "no-stake",
      "slashed-stake",
      "tamper-action",
      "forge-proof",
      "expired-session",
      "over-budget",
      "forge-claims",
    ])
    .optional(),
});

function pickForwardHeaders(headers: Headers): HeadersInit {
  const forwarded = new Headers();
  const names = [
    "X-Agent-Passport-ID",
    "X-Agent-Signature",
    "X-Agent-Timestamp",
    "X-Agent-Session-Grant",
    "X-Agent-Session-Proof",
    "X-Agent-Claims",
    "X-Agent-Claims-Signature",
    "X-Agent-Intent-Hash",
    "X-Agent-Action-Hash",
    "X-Agent-Intent-Proof",
  ];

  for (const name of names) {
    const value = headers.get(name);
    if (value) {
      forwarded.set(name, value);
    }
  }

  return forwarded;
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const inboundHeaders = new Headers(req.headers);
  let verification:
    | RelayResultLike
    | null = null;

  if (!body.mode) {
    try {
      const actual = await verifyAgentHeaders({
        headers: inboundHeaders,
        url: body.url,
        expectedIntent: body.intent,
        expectedAction: body.action,
        expectedAmountUsd: body.amountUsd,
        requireStake: true,
      });

      if (actual.ok) {
        verification = {
          trusted: true,
          code: "trusted_action_accepted",
          message:
            "The live trust verifier accepted the request and unlocked the clean relay lane.",
          headers: Object.fromEntries(inboundHeaders.entries()),
          steps: [
            {
              label: "Live verifier accepted request",
              ok: true,
              detail:
                "The real trust verifier approved the full header bundle, including stake gating.",
            },
          ],
        };
      } else {
        verification = {
          trusted: false,
          code: actual.code,
          message: actual.message,
          headers: Object.fromEntries(inboundHeaders.entries()),
          steps: [
            {
              label: "Live verifier rejected request",
              ok: false,
              detail: actual.message,
            },
          ],
        };
      }
    } catch {
      verification = null;
    }
  }

  if (!verification) {
    const demoVerification = await verifyDemoTrustedHeaders({
      headers: inboundHeaders,
      url: body.url,
      intent: body.intent,
      action: body.action,
      amountUsd: body.amountUsd,
      mode: body.mode as DemoScenarioMode | undefined,
    });
    verification = {
      trusted: demoVerification.status === "trusted",
      code: demoVerification.code,
      message: demoVerification.message,
      headers: demoVerification.headers,
      steps: demoVerification.steps.map((step) => ({
        label: step.label,
        ok: step.ok,
        detail: step.detail,
      })),
    };
  }

  if (!verification.trusted) {
    return json(
      {
        trusted: false,
        code: verification.code,
        message: verification.message,
        steps: verification.steps,
        headers: verification.headers,
      },
      { status: 403 },
    );
  }

  const response = await fetch(body.url, {
    headers: pickForwardHeaders(req.headers),
    cache: "no-store",
  });

  const originalHtml = await response.text();
  const { cleanedHtml, removed } = sanitizeHostileHtml(originalHtml, body.url);

  return json({
    trusted: true,
    code: verification.code,
    message: verification.message,
    headers: verification.headers,
    steps: verification.steps,
    removed,
    cleanedHtml,
  });
}

type RelayResultLike = {
  trusted: boolean;
  code: string;
  message: string;
  headers: Record<string, string>;
  steps: Array<{ label: string; ok: boolean; detail: string }>;
};
