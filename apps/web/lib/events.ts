export type AgentEvent =
  | { type: "started"; runId: string; passportId: string }
  | { type: "scraped"; chars: number; source: "firecrawl" | "jina" }
  | { type: "fallback"; reason: string }
  | { type: "cleaned"; chars: number }
  | { type: "thinking"; delta: string }
  | { type: "tool"; name: string; input: object }
  | { type: "tool_result"; name: string; output: object }
  | { type: "logging"; txHash: `0x${string}` }
  | { type: "logged"; txHash: `0x${string}`; blockNumber: number }
  | { type: "blocked"; status: 403; error: string }
  | { type: "verified"; passportId: string; trustScore: number }
  | {
      type: "done";
      result: {
        summary: string;
        actionsCount: number;
        txHash?: string;
        feeUsd: number;
      };
    }
  | { type: "error"; message: string };

export const FIXTURE_EVENTS: AgentEvent[] = [
  { type: "started", runId: "fixture-1", passportId: "42" },
  { type: "scraped", chars: 24317, source: "firecrawl" },
  { type: "cleaned", chars: 18940 },
  { type: "thinking", delta: "Summarizing the page about " },
  { type: "thinking", delta: "internet bots…" },
  { type: "tool", name: "summarize", input: { focus: "main themes" } },
  { type: "logging", txHash: "0xab12cd34ef56789000000000000000000000000000000000000000000000000" },
  {
    type: "logged",
    txHash: "0xab12cd34ef56789000000000000000000000000000000000000000000000000",
    blockNumber: 42424242,
  },
  {
    type: "done",
    result: {
      summary:
        "The page covers internet bots: their history, types (web crawlers, chatbots, malicious bots), and countermeasures. Modern bots account for roughly 40% of all web traffic.",
      actionsCount: 3,
      txHash: "0xab12cd34ef56789000000000000000000000000000000000000000000000000",
      feeUsd: 0.1,
    },
  },
];
