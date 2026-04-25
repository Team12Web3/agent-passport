"use client";
import { useState, useEffect, useCallback } from "react";
import { useAgentRun } from "@/hooks/useAgentRun";
import { AgentTerminal } from "./AgentTerminal";
import { DEMO_URL, DEMO_PROMPT } from "./RunControls";

// ─── Phase types ────────────────────────────────────────────────────────────
type CardPhase = "idle" | "running" | "blocked" | "verifying" | "verified";

// ─── Demo data shown once passport is verified ───────────────────────────────
const CLEAN_ITEMS = [
  { name: "Introduction to Internet Bots", desc: "— history & taxonomy" },
  { name: "Web Crawlers & Scrapers",        desc: "— 40% of all web traffic" },
  { name: "Malicious Bots",                 desc: "— DDoS, spam, credential stuffing" },
  { name: "Countermeasures",                desc: "— CAPTCHAs, rate limiting, passports" },
  { name: "Trusted Agent Protocols",        desc: "— verified identity layer" },
];

// ─── Fake 3×3 CAPTCHA grid ───────────────────────────────────────────────────
function FakeCaptcha() {
  const emojis = ["🚗", "🚦", "🛑", "🚌", "🚗", "🚦", "🛑", "🚌", "🚗"];
  return (
    <div className="grid grid-cols-3 gap-1">
      {emojis.map((e, i) => (
        <div
          key={i}
          className="flex h-14 w-14 select-none items-center justify-center rounded bg-zinc-700 text-lg"
        >
          {e}
        </div>
      ))}
    </div>
  );
}

// ─── Blocked overlay: red 403 + fake CAPTCHA ─────────────────────────────────
function BlockedOverlay({ shaking }: { shaking: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-950/95 p-4 ${
        shaking ? "animate-shake" : ""
      }`}
    >
      <p className="text-xl font-bold text-red-300">403 — captcha_required</p>
      <p className="mb-1 text-xs text-red-400">
        Automated access blocked. Human verification required.
      </p>
      <FakeCaptcha />
      <p className="mt-1 text-xs text-red-500">Select all images with traffic lights</p>
    </div>
  );
}

// ─── Verified overlay: spinner → clean data list ─────────────────────────────
function VerifiedOverlay({ phase }: { phase: "verifying" | "verified" }) {
  if (phase === "verifying") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/95">
        <svg className="h-6 w-6 animate-spin text-green-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm text-zinc-300">Verifying passport on Avalanche…</p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-start gap-2 overflow-auto bg-white p-4">
      <p className="mb-1 text-xs font-bold text-green-700">
        ✓ Passport verified · Trust score 87
      </p>
      <ul className="w-full space-y-1.5">
        {CLEAN_ITEMS.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-zinc-700"
          >
            <span className="font-medium">{item.name}</span>
            <span className="text-zinc-500">{item.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TrustProtocolDemo({ agentId }: { agentId: string }) {
  // Two independent run instances
  const {
    run: runWithout,
    reset: resetWithout,
    events: withoutEvents,
    status: withoutStatus,
  } = useAgentRun();

  const {
    run: runWith,
    reset: resetWith,
    events: withEvents,
    status: withStatus,
  } = useAgentRun();

  const [withoutPhase, setWithoutPhase] = useState<CardPhase>("idle");
  const [withPhase,    setWithPhase]    = useState<CardPhase>("idle");
  const [shaking,      setShaking]      = useState(false);
  const [running,      setRunning]      = useState(false);

  // ── Watch the "without passport" stream for a blocked event ─────────────────
  // FIX: useEffect reacts properly to React state — setInterval with closures
  // would always capture the stale initial snapshot and never fire.
  useEffect(() => {
    if (withoutPhase !== "running") return;
    const isBlocked =
      withoutStatus === "blocked" ||
      withoutEvents.some((e) => e.type === "blocked");
    if (!isBlocked) return;

    setWithoutPhase("blocked");
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 500);
    return () => clearTimeout(t);
  }, [withoutStatus, withoutEvents, withoutPhase]);

  // ── Watch the "with passport" stream for completion ──────────────────────────
  useEffect(() => {
    if (withPhase !== "running") return;
    const isFinished =
      withStatus === "done" ||
      withStatus === "error" ||
      withEvents.some(
        (e) => e.type === "logged" || e.type === "verified" || e.type === "done",
      );
    if (!isFinished) return;

    setWithPhase("verifying");
    // Minimum 1.5 s spinner so the audience can see the verification step
    const t = setTimeout(() => {
      setWithPhase("verified");
      setRunning(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [withStatus, withEvents, withPhase]);

  // ── Start both runs; offset "with" by 1500 ms ────────────────────────────────
  const startDemo = useCallback(async () => {
    if (running) return;
    resetWithout();
    resetWith();
    setWithoutPhase("running");
    setWithPhase("idle");
    setRunning(true);

    // "Without" run fires immediately
    runWithout({ agentId, url: DEMO_URL, prompt: DEMO_PROMPT, withPassport: false });

    // 1500 ms gap — lets the audience see the block before the verified run starts
    await new Promise<void>((r) => setTimeout(r, 1500));
    setWithPhase("running");
    runWith({ agentId, url: DEMO_URL, prompt: DEMO_PROMPT, withPassport: true });
  }, [running, agentId, runWithout, resetWithout, runWith, resetWith]);

  function reset() {
    resetWithout();
    resetWith();
    setWithoutPhase("idle");
    setWithPhase("idle");
    setRunning(false);
  }

  const withoutBorder = withoutPhase === "blocked" ? "border-red-600"  : "border-zinc-700";
  const withBorder    = withPhase    === "verified" ? "border-green-500": "border-zinc-700";

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Trust Protocol</h2>
          <p className="mt-1 text-sm text-zinc-400">
            See what happens when an agent runs with vs. without a passport.
          </p>
        </div>
        {(withoutPhase !== "idle" || withPhase !== "idle") && (
          <button
            onClick={reset}
            className="text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            Reset
          </button>
        )}
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* ── WITHOUT passport ── */}
        <div
          className={`overflow-hidden rounded-xl border bg-black transition-colors duration-300 ${withoutBorder}`}
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
            {/* Shield-off icon */}
            <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm font-semibold text-zinc-200">Without Passport</span>
            {withoutPhase === "blocked" && (
              <span className="ml-auto rounded-full bg-red-900 px-2 py-0.5 text-xs font-bold text-red-300">
                BLOCKED
              </span>
            )}
          </div>

          {/* Mini browser area */}
          <div className="relative h-[200px] bg-zinc-800">
            {withoutPhase === "idle" && (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                Click "Run comparison" to start
              </div>
            )}
            {withoutPhase === "running" && (
              <div className="flex h-full items-center justify-center">
                <svg className="h-5 w-5 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
            {withoutPhase === "blocked" && <BlockedOverlay shaking={shaking} />}
          </div>

          {/* Mini terminal */}
          <div className="border-t border-zinc-800">
            <AgentTerminal events={withoutEvents} status={withoutStatus} compact />
          </div>
        </div>

        {/* ── WITH passport ── */}
        <div
          className={`overflow-hidden rounded-xl border bg-black transition-colors duration-500 ${withBorder}`}
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
            {/* Shield-check icon */}
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm font-semibold text-zinc-200">With Passport</span>
            {withPhase === "verified" && (
              <span className="ml-auto rounded-full bg-green-900 px-2 py-0.5 text-xs font-bold text-green-300">
                VERIFIED ✓
              </span>
            )}
          </div>

          {/* Mini browser area */}
          <div className="relative h-[200px] bg-zinc-800">
            {withPhase === "idle" && (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                Starts 1.5 s after "Without" run
              </div>
            )}
            {withPhase === "running" && (
              <div className="flex h-full items-center justify-center">
                <svg className="h-5 w-5 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
            {(withPhase === "verifying" || withPhase === "verified") && (
              <VerifiedOverlay phase={withPhase} />
            )}
          </div>

          {/* Mini terminal */}
          <div className="border-t border-zinc-800">
            <AgentTerminal events={withEvents} status={withStatus} compact />
          </div>
        </div>
      </div>

      {/* CTA button */}
      <div className="mt-5 flex justify-center">
        <button
          onClick={startDemo}
          disabled={running}
          className="rounded-lg px-8 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: running ? "#3f3f46" : "linear-gradient(135deg,#E84142 0%,#c0392b 100%)",
          }}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running comparison…
            </span>
          ) : (
            "▶ Run trust protocol comparison"
          )}
        </button>
      </div>
    </div>
  );
}
