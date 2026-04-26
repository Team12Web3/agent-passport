import "server-only";
import { streamText, tool } from "ai";
import { z } from "zod";
import { cheapModel } from "./llm";

type TaskActionEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      name: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
    };

type RunTaskActionsArgs = {
  prompt: string;
  url: string;
  page: string;
  onEvent: (event: TaskActionEvent) => void;
};

export async function runTaskActions({
  prompt,
  url,
  page,
  onEvent,
}: RunTaskActionsArgs): Promise<string> {
  const result = await streamText({
    model: cheapModel(),
    maxSteps: 4,
    system:
      "You are an agent executing a web task. Use the provided TypeScript actions when they help inspect or record the work. Answer only from the page content. Be concise: 4-6 sentences with specific details where useful.",
    messages: [
      {
        role: "user",
        content: `# Task\n${prompt}\n\n# URL\n${url}\n\n# Page content\n${page}`,
      },
    ],
    tools: createTaskTools(page),
  });

  let summary = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      summary += part.textDelta;
      onEvent({ type: "text", delta: part.textDelta });
    }

    if (part.type === "tool-call") {
      onEvent({
        type: "tool",
        name: part.toolName,
        input: toRecord(part.args),
      });
    }

    if (part.type === "tool-result") {
      onEvent({
        type: "tool_result",
        name: part.toolName,
        input: toRecord(part.args),
        output: toRecord(part.result),
      });
    }
  }

  return summary.trim();
}

function createTaskTools(page: string) {
  return {
    searchPage: tool({
      description:
        "Search the scraped page content for concrete supporting snippets before answering.",
      parameters: z.object({
        query: z.string().min(1).max(120),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ query, limit }) => {
        const snippets = findSnippets(page, query, limit);
        return {
          query,
          matches: snippets.length,
          snippets,
        };
      },
    }),
    recordAction: tool({
      description:
        "Record a concise action or decision the agent made while executing the task.",
      parameters: z.object({
        action: z.string().min(1).max(120),
        rationale: z.string().min(1).max(240),
      }),
      execute: async ({ action, rationale }) => ({
        action,
        rationale,
        recorded: true,
      }),
    }),
  };
}

function findSnippets(page: string, query: string, limit: number) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length >= 3);
  const paragraphs = page
    .split(/\n{2,}/)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs
    .map((text) => ({
      text: text.slice(0, 500),
      score: scoreText(text, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.text);
}

function scoreText(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}
