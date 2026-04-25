import "server-only";

import { json } from "../../_lib/responses";
import { verifyAgentHeaders } from "@/lib/agent/verify";

export const runtime = "nodejs";

const FAKE_CONTENT =
  "Welcome to the Agent Marketplace. Browse curated goods from independent " +
  "sellers worldwide. Verified artifacts only - every listing is checked by " +
  "our community of curators. Use the trust score returned alongside this " +
  "response to decide whether to surface this site to your operator. " +
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

const FAKE_ITEMS = [
  { name: "Vintage typewriter", price: "$120" },
  { name: "Scout journal", price: "$28" },
  { name: "Brass compass", price: "$65" },
];

function deny(
  code:
    | "captcha_required"
    | "stale_timestamp"
    | "bad_signature"
    | "invalid_session_key"
    | "invalid_intent_proof"
    | "replayed_nonce"
    | "untrusted_agent",
  message: string,
) {
  return json(
    {
      error: code,
      message,
      captchaPlaceholder: true,
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  const result = await verifyAgentHeaders({
    headers: req.headers,
    url: req.url,
  });

  if (!result.ok) {
    return deny(result.code, result.message);
  }

  return json({
    title: "AI Marketplace Demo Site",
    content: FAKE_CONTENT,
    items: FAKE_ITEMS,
    trustScore: result.trustScore,
    attributes: result.attributes,
  });
}
