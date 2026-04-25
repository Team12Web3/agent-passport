import "server-only";
import {
  keccak256,
  parseUnits,
  toBytes,
  type Hex,
} from "viem";
import { streamText } from "ai";
import { cheapModel } from "./llm";
import { getPublicClient } from "../chain/client";
import { ActionLog, AgentPassport, USDC, assertContractsDeployed } from "../chain/contracts";
import { getSupabase, type AgentRow } from "../db/supabase";
import { getSignerFromEncryptedKey } from "./wallet";
import { buildTrustHeaders } from "./sign";
import { cleanMarkdown } from "./clean";

export type AgentEvent =
  | { type: "started";   runId: string; passportId: string }
  | { type: "scraped";   chars: number; source: "firecrawl" | "jina" }
  | { type: "fallback";  reason: string }
  | { type: "cleaned";   chars: number }
  | { type: "thinking";  delta: string }
  | { type: "tool";        name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; output: Record<string, unknown> }
  | { type: "logging";   txHash: Hex }
  | { type: "logged";    txHash: Hex; blockNumber: number }
  | { type: "blocked";   status: 403; error: string }
  | { type: "verified";  passportId: string; trustScore: number }
  | { type: "done";      result: { summary: string; actionsCount: number; txHash?: Hex; feeUsd: number } }
  | { type: "error";     message: string };

type Action = {
  step: number;
  tool: string;
  input: unknown;
  output: unknown;
  ts: number;
};

const FEE_USDC_6 = parseUnits("0.10", 6);                      // 100000n
const PLATFORM_BENEFICIARY = (process.env.PLATFORM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex;

export async function runAgentTask(
  args: {
    agentId: string;
    url: string;
    prompt: string;
    withPassport: boolean;
  },
  emit: (event: AgentEvent) => void,
): Promise<{ runId: string; txHash?: Hex; summary: string }> {
  assertContractsDeployed();

  const supabase = getSupabase();

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("*")
    .eq("id", args.agentId)
    .single();
  if (agentErr || !agent) throw new Error("agent not found");
  const a = agent as AgentRow;
  if (!a.passport_id) throw new Error("agent has no passport_id");

  const { data: runRow, error: runErr } = await supabase
    .from("action_runs")
    .insert({
      agent_id: a.id,
      url: args.url,
      prompt: args.prompt,
      status: "pending",
    })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error("could not create action_run");
  const runId = runRow.id as string;

  emit({ type: "started", runId, passportId: a.passport_id });

  // Read the on-chain passport once so we can echo the trust score in the
  // `verified` event after a successful trust-bearing scrape.
  const passport = (await getPublicClient().readContract({
    address: AgentPassport.address,
    abi: AgentPassport.abi as never,
    functionName: "getPassport",
    args: [BigInt(a.passport_id)],
  })) as { trustScore: number | bigint };
  const trustScore = Number(passport.trustScore);

  const actions: Action[] = [];
  let stepCounter = 0;
  const pushAction = (tool: string, input: unknown, output: unknown) => {
    stepCounter += 1;
    actions.push({ step: stepCounter, tool, input, output, ts: Date.now() });
  };

  // 1. Build trust headers
  const trustHeaders = args.withPassport
    ? await buildTrustHeaders({
        passportId: a.passport_id,
        url: args.url,
        encryptedKey: a.encrypted_private_key,
        intent: args.prompt,
      })
    : undefined;

  // 2. Scrape (Firecrawl → Jina fallback)
  let raw: string;
  try {
    raw = await scrapeFirecrawl(args.url, trustHeaders);
    if (!raw || raw.length < 50) throw new Error("empty firecrawl response");
    emit({ type: "scraped", chars: raw.length, source: "firecrawl" });
    pushAction("firecrawl", { url: args.url }, { chars: raw.length });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "firecrawl failed";

    // The "blocked" path: trust-protocol demo without headers.
    // We treat any 403 from the upstream as the kill-shot.
    if (reason.includes("403") && !args.withPassport) {
      emit({ type: "blocked", status: 403, error: reason });
      await supabase
        .from("action_runs")
        .update({ status: "error", result: { summary: "blocked by demo site" } })
        .eq("id", runId);
      throw new BlockedError();
    }

    emit({ type: "fallback", reason });
    raw = await scrapeJina(args.url, trustHeaders);
    emit({ type: "scraped", chars: raw.length, source: "jina" });
    pushAction("jina", { url: args.url }, { chars: raw.length });
  }

  if (args.withPassport) {
    emit({ type: "verified", passportId: a.passport_id, trustScore });
  }

  // 3. Clean
  const cleaned = cleanMarkdown(raw);
  emit({ type: "cleaned", chars: cleaned.length });
  pushAction("clean", { chars: raw.length }, { chars: cleaned.length });

  // 4. LLM via Anthropic streaming
  const { textStream, fullText } = await streamLLM({
    prompt: args.prompt,
    page: cleaned,
    onDelta: (delta) => emit({ type: "thinking", delta }),
  });
  for await (const _ of textStream) {
    // consumption is required to drive the stream
  }
  const summary = await fullText;
  pushAction("llm", { prompt: args.prompt }, { summary });

  // 5. Hash + submit ActionLog tx from agent's signer
  const taskHash    = keccak256(toBytes(`${args.prompt}|${args.url}`));
  const actionsRoot = keccak256(toBytes(JSON.stringify(actions)));

  const { account, wallet } = getSignerFromEncryptedKey(a.encrypted_private_key);
  const pub = getPublicClient();

  // Approve USDC if needed (one-shot infinite)
  const allowance = (await pub.readContract({
    address: USDC.address,
    abi: USDC.abi,
    functionName: "allowance",
    args: [account.address, ActionLog.address],
  })) as bigint;
  if (allowance < FEE_USDC_6) {
    const approveTx = await wallet.writeContract({
      account,
      chain: wallet.chain!,
      address: USDC.address,
      abi: USDC.abi,
      functionName: "approve",
      args: [ActionLog.address, 2n ** 256n - 1n],
    });
    await pub.waitForTransactionReceipt({ hash: approveTx });
  }

  const txHash = (await wallet.writeContract({
    account,
    chain: wallet.chain!,
    address: ActionLog.address,
    abi: ActionLog.abi as never,
    functionName: "logAction",
    args: [
      BigInt(a.passport_id),
      taskHash,
      actionsRoot,
      FEE_USDC_6,
      PLATFORM_BENEFICIARY,
    ],
  })) as Hex;

  emit({ type: "logging", txHash });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  emit({ type: "logged", txHash, blockNumber: Number(receipt.blockNumber) });

  // 6. Persist final run row
  await supabase
    .from("action_runs")
    .update({
      status: "done",
      result: {
        summary,
        actionsCount: actions.length,
        feeUsd: 0.10,
      },
      actions,
      actions_root: actionsRoot,
      log_tx_hash: txHash,
      fee_amount: FEE_USDC_6.toString(),
    })
    .eq("id", runId);

  emit({
    type: "done",
    result: { summary, actionsCount: actions.length, txHash, feeUsd: 0.10 },
  });

  return { runId, txHash, summary };
}

export class BlockedError extends Error {
  constructor() {
    super("blocked");
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function scrapeFirecrawl(url: string, trustHeaders?: Record<string, string>): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      headers: trustHeaders ?? {},
    }),
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error("403 forbidden by upstream");
    throw new Error(`firecrawl ${res.status}`);
  }
  const json = (await res.json()) as { data?: { markdown?: string } };
  return json.data?.markdown ?? "";
}

async function scrapeJina(url: string, trustHeaders?: Record<string, string>): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: trustHeaders ?? {},
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("403 forbidden by upstream");
    throw new Error(`jina ${res.status}`);
  }
  return await res.text();
}

async function streamLLM(opts: {
  prompt: string;
  page: string;
  onDelta: (chunk: string) => void;
}) {
  const result = await streamText({
    model: cheapModel(),
    system:
      "You are an analyst. Answer the user's prompt based on the page content provided. Be concise — 4–6 sentences. Cite specific items where useful.",
    messages: [
      {
        role: "user",
        content: `# Prompt\n${opts.prompt}\n\n# Page content\n${opts.page}`,
      },
    ],
  });

  // Wrap textStream so we can pipe deltas to the emit() callback while
  // still allowing the caller to drive the stream itself.
  const wrapped = (async function* () {
    for await (const delta of result.textStream) {
      opts.onDelta(delta);
      yield delta;
    }
  })();

  return { textStream: wrapped, fullText: result.text };
}

