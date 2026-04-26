"use client";
import { useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentEvent } from "@/lib/events";
import type { RunStatus } from "@/hooks/useAgentRun";
import { fadeUp, stagger, useMotionVariant } from "@/lib/motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type TerminalLine = {
  key:    string;
  ts:     string;
  color:  string;
  bold:   boolean;
  prefix: string;
  text:   string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function msToTs(ms: number, startMs: number): string {
  const diff = Math.max(0, Math.floor((ms - startMs) / 1000));
  return `[${pad(Math.floor(diff / 60))}:${pad(diff % 60)}]`;
}

// Maps an AgentEvent to a display line (returns null for unknown/unhandled types)
function eventToLine(ev: AgentEvent, ts: string, key: string): TerminalLine | null {
  switch (ev.type) {
    case "started":
      return {
        key, ts,
        color: "text-cyan-400", bold: false, prefix: "▶",
        text: `Run started · passport #${ev.passportId} · run ${ev.runId}`,
      };
    case "scraped":
      return {
        key, ts,
        color: "text-green-400", bold: false, prefix: "●",
        text: `Scraped ${ev.chars.toLocaleString()} chars via ${ev.source}`,
      };
    case "fallback":
      return {
        key, ts,
        color: "text-yellow-400", bold: false, prefix: "⚠",
        text: `Fallback: ${ev.reason}`,
      };
    case "cleaned":
      return {
        key, ts,
        color: "text-green-400", bold: false, prefix: "✦",
        text: `Cleaned to ${ev.chars.toLocaleString()} chars`,
      };
    case "tool":
      return {
        key, ts,
        color: "text-fuchsia-400", bold: false, prefix: "⚙",
        text: `tool::${ev.name}(${JSON.stringify(ev.input)})`,
      };
    case "tool_result":
      return {
        key, ts,
        color: "text-fuchsia-300", bold: false, prefix: "↩",
        text: `tool_result::${ev.name} → ${JSON.stringify(ev.output).slice(0, 80)}`,
      };
    case "logging":
      return {
        key, ts,
        color: "text-blue-400", bold: false, prefix: "⛓",
        text: `Logging tx ${ev.txHash.slice(0, 10)}…`,
      };
    case "logged":
      return {
        key, ts,
        color: "text-green-400", bold: true, prefix: "✓",
        text: `Logged · tx ${ev.txHash.slice(0, 10)}… · block #${ev.blockNumber}`,
      };
    case "verified":
      return {
        key, ts,
        color: "text-green-400", bold: true, prefix: "✓",
        text: `Passport verified · trust score ${ev.trustScore}`,
      };
    case "blocked":
      return {
        key, ts,
        color: "text-red-500", bold: true, prefix: "✗",
        text: `BLOCKED. This site only accepts verified agents. (${ev.error})`,
      };
    case "done":
      return {
        key, ts,
        color: "text-green-400", bold: true, prefix: "✓",
        text: ev.result.feeUsd > 0
          ? `Done · ${ev.result.actionsCount} actions · $${ev.result.feeUsd.toFixed(2)} fee`
          : `Done · ${ev.result.actionsCount} actions · no fee`,
      };
    case "error":
      return {
        key, ts,
        color: "text-red-400", bold: false, prefix: "✗",
        text: `Error: ${ev.message}`,
      };
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  events:  AgentEvent[];
  status:  RunStatus;
  compact?: boolean;
};

export function AgentTerminal({ events, status, compact = false }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const itemVariant = useMotionVariant(fadeUp);

  // ── Per-event timestamp tracking ──────────────────────────────────────────
  // FIX: previously all events got `Date.now()` at memo recalculation time,
  // so every historical line showed the same (current) timestamp. Now we record
  // the exact wall-clock time each event index first appears and reuse it on
  // subsequent re-renders. We do this inside the memo (not in a useEffect) so
  // the timestamp is recorded synchronously as the memo processes the new event.
  const eventMsRef  = useRef<number[]>([]);
  const startMsRef  = useRef<number>(0);

  // Reset on run clear
  useEffect(() => {
    if (events.length === 0) {
      eventMsRef.current = [];
      startMsRef.current = 0;
      userScrolledRef.current = false;
    }
  }, [events.length]);

  // ── Build display lines ───────────────────────────────────────────────────
  const lines = useMemo<TerminalLine[]>(() => {
    if (events.length === 0) return [];

    const now = Date.now();

    // Stamp start time when first event arrives
    if (startMsRef.current === 0) {
      startMsRef.current = now;
    }

    // Record receive-time for any new events (runs inside the memo so it
    // happens synchronously with render — close enough to "receive time")
    while (eventMsRef.current.length < events.length) {
      eventMsRef.current.push(now);
    }

    const startMs = startMsRef.current;
    const result: TerminalLine[] = [];
    let thinkingText = "";
    let thinkingTs   = "";
    let thinkingKey  = "";

    events.forEach((ev, idx) => {
      const ts = msToTs(eventMsRef.current[idx] ?? now, startMs);

      if (ev.type === "thinking") {
        // Accumulate all thinking deltas into a single updating line
        thinkingText += ev.delta;
        if (!thinkingTs) {
          thinkingTs  = ts;
          thinkingKey = `think-${idx}`;
        }
        const line: TerminalLine = {
          key:    thinkingKey,
          ts:     thinkingTs,
          color:  "text-yellow-400",
          bold:   false,
          prefix: "…",
          text:   thinkingText,
        };
        const existing = result.findIndex((l) => l.key === thinkingKey);
        if (existing >= 0) result[existing] = line;
        else result.push(line);
      } else {
        // Any non-thinking event resets the accumulator so the next thinking
        // group gets a fresh line
        thinkingText = "";
        thinkingTs   = "";
        thinkingKey  = "";
        const line = eventToLine(ev, ts, `ev-${idx}`);
        if (line) result.push(line);
      }
    });

    return result;
  }, [events]);

  // ── Auto-scroll (pauses when user has scrolled up) ───────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }

  const height = compact ? "h-[250px]" : "h-[400px]";

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`${height} overflow-y-auto rounded-lg bg-black p-4 font-mono text-sm text-gray-100`}
    >
      {/* Empty state — visible before any run starts */}
      {lines.length === 0 && (
        <span className="text-zinc-500">
          Awaiting instructions
          <span className="ml-0.5 animate-pulse">▋</span>
        </span>
      )}

      <motion.div
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div key={line.key} variants={itemVariant} className="mb-1 flex gap-2 leading-5">
              <span className="shrink-0 text-zinc-600">{line.ts}</span>
              <span className={`shrink-0 ${line.color}`}>{line.prefix}</span>
              <span
                className={`min-w-0 break-all ${line.color} ${
                  line.bold ? "font-bold" : ""
                }`}
              >
                {line.text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Blinking cursor while running */}
      {status === "running" && lines.length > 0 && (
        <span className="animate-pulse text-gray-400">▋</span>
      )}
    </div>
  );
}
