"use client";
import { useState, useRef, useCallback } from "react";
import type { AgentEvent } from "@/lib/events";

export type RunStatus = "idle" | "running" | "done" | "error" | "blocked";

export type DoneResult = {
  summary: string;
  actionsCount: number;
  txHash?: string;
  feeUsd: number;
};

// ─── Mock mode ────────────────────────────────────────────────────────────
// When the agentId in the URL is not a real UUID (e.g. /agents/test123/run),
// the hook plays a scripted run instead of hitting /api/run. This lets the
// Execution UI be demoed end-to-end without a logged-in session, a seeded
// agent row, or any on-chain calls.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOCK_TX_HASH =
  "0xab12cd34ef56789000000000000000000000000000000000000000000000000" as const;

const MOCK_SUMMARY =
  "The page covers internet bots: their history, types (web crawlers, chatbots, malicious bots), and countermeasures. Modern bots account for roughly 40% of all web traffic.";

type ScriptedEvent = { delay: number; event: AgentEvent };

function buildHappyScript(): ScriptedEvent[] {
  // Stream the summary char-by-char so the terminal "thinking" line feels
  // like a real LLM response. Total wall-clock ~6s.
  const intro: ScriptedEvent[] = [
    { delay:    0, event: { type: "started",  runId: "mock-run", passportId: "42" } },
    { delay:  600, event: { type: "scraped",  chars: 24317, source: "firecrawl" } },
    { delay:  300, event: { type: "verified", passportId: "42", trustScore: 87 } },
    { delay:  300, event: { type: "cleaned",  chars: 18940 } },
  ];

  const words = MOCK_SUMMARY.split(/(\s+)/);
  const thinking: ScriptedEvent[] = words.map((w) => ({
    delay: 35 + Math.random() * 45,
    event: { type: "thinking", delta: w },
  }));

  const tail: ScriptedEvent[] = [
    { delay:  500, event: { type: "logging", txHash: MOCK_TX_HASH } },
    {
      delay: 1500,
      event: {
        type: "logged",
        txHash: MOCK_TX_HASH,
        blockNumber: 42424242,
      },
    },
    {
      delay:  300,
      event: {
        type: "done",
        result: {
          summary:      MOCK_SUMMARY,
          actionsCount: 3,
          txHash:       MOCK_TX_HASH,
          feeUsd:       0.1,
        },
      },
    },
  ];

  return [...intro, ...thinking, ...tail];
}

function buildBlockedScript(): ScriptedEvent[] {
  return [
    { delay:    0, event: { type: "started",  runId: "mock-run", passportId: "42" } },
    {
      delay:  900,
      event: {
        type: "blocked",
        status: 403,
        error: "captcha_required: this site only accepts verified agents",
      },
    },
  ];
}

export function useAgentRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<DoneResult | null>(null);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  // Apply a single AgentEvent to local state. Shared by mock + real paths.
  const applyEvent = useCallback((ev: AgentEvent) => {
    setEvents((prev) => [...prev, ev]);
    if (ev.type === "started") setPassportId(ev.passportId);
    if (ev.type === "verified") {
      setPassportId(ev.passportId);
      setTrustScore(ev.trustScore);
    }
    if (ev.type === "done") {
      setResult(ev.result);
      setStatus("done");
    }
    if (ev.type === "blocked") setStatus("blocked");
    if (ev.type === "error")   setStatus("error");
  }, []);

  // Play a scripted sequence with delays. Bails out when the AbortSignal fires.
  const playScript = useCallback(
    async (script: ScriptedEvent[], signal: AbortSignal) => {
      for (const step of script) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, step.delay);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          }, { once: true });
        });
        if (signal.aborted) return;
        applyEvent(step.event);
      }
    },
    [applyEvent],
  );

  const run = useCallback(
    async (input: {
      agentId: string;
      url: string;
      prompt: string;
      withPassport: boolean;
    }) => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      const signal = ctrl.current.signal;

      setEvents([]);
      setResult(null);
      setPassportId(null);
      setTrustScore(null);
      setStatus("running");

      // ── Mock mode ─────────────────────────────────────────────────────
      if (!UUID_RE.test(input.agentId)) {
        const script = input.withPassport
          ? buildHappyScript()
          : buildBlockedScript();
        try {
          await playScript(script, signal);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setStatus("error");
        }
        return;
      }

      // ── Real SSE path ─────────────────────────────────────────────────
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal,
        });

        // Surface non-2xx responses (auth/validation/not-found) instead of
        // hanging in "running" forever waiting for SSE frames that will
        // never come.
        if (!res.ok || !res.body) {
          let message = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j?.error) message = `${message}: ${j.error}`;
          } catch {
            // body may not be JSON; keep the status-only message
          }
          applyEvent({ type: "error", message });
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            if (!p.startsWith("data: ")) continue;
            try {
              const ev: AgentEvent = JSON.parse(p.slice(6));
              applyEvent(ev);
            } catch {
              // malformed event — skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus("error");
      }
    },
    [applyEvent, playScript],
  );

  const reset = useCallback(() => {
    ctrl.current?.abort();
    setEvents([]);
    setResult(null);
    setPassportId(null);
    setTrustScore(null);
    setStatus("idle");
  }, []);

  const abort = useCallback(() => {
    ctrl.current?.abort();
    setStatus("idle");
  }, []);

  return { events, status, result, passportId, trustScore, run, reset, abort };
}
