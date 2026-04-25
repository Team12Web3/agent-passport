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

export function useAgentRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<DoneResult | null>(null);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    async (input: {
      agentId: string;
      url: string;
      prompt: string;
      withPassport: boolean;
    }) => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setEvents([]);
      setResult(null);
      setStatus("running");

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: ctrl.current.signal,
        });

        if (!res.body) {
          setStatus("error");
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
              if (ev.type === "error") setStatus("error");
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
    [],
  );

  const reset = useCallback(() => {
    ctrl.current?.abort();
    setEvents([]);
    setResult(null);
    setStatus("idle");
  }, []);

  const abort = useCallback(() => {
    ctrl.current?.abort();
    setStatus("idle");
  }, []);

  return { events, status, result, passportId, trustScore, run, reset, abort };
}
