"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAgentRun } from "@/hooks/useAgentRun";
import { RunControls, DEMO_URL, DEMO_PROMPT } from "@/components/run/RunControls";
import { SplitView } from "@/components/run/SplitView";
import { ResultCard } from "@/components/run/ResultCard";
import { PassportStatusBar } from "@/components/run/PassportStatusBar";

// ─── Fake CAPTCHA + 403 overlay for the main split-view iframe ───────────────
// Shown when the main run returns a "blocked" event (Run without Passport path)
function MainBlockedOverlay({ shaking }: { shaking: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-950/95 p-6 ${
        shaking ? "animate-shake" : ""
      }`}
    >
      <p className="text-2xl font-bold text-red-300">403 — captcha_required</p>
      <p className="text-sm text-red-400">
        This site only accepts verified agents.
      </p>
      {/* 3×3 fake CAPTCHA grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {["🚗", "🚦", "🛑", "🚌", "🚗", "🚦", "🛑", "🚌", "🚗"].map((e, i) => (
          <div
            key={i}
            className="flex h-16 w-16 select-none items-center justify-center rounded bg-zinc-700 text-xl"
          >
            {e}
          </div>
        ))}
      </div>
      <p className="text-xs text-red-500">Select all images with traffic lights</p>
    </div>
  );
}

type AgentMeta = {
  name: string;
  walletAddress: string;
  passportId: string;
};

type Props = {
  params: { id: string };
};

export default function AgentRunPage({ params }: Props) {
  const { id } = params;
  const [url, setUrl]       = useState(DEMO_URL);
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  const [agent, setAgent]   = useState<AgentMeta | null>(null);
  const [walletCopied, setWalletCopied] = useState(false);
  // Track whether the blocked overlay is actively shaking
  const [blockedShaking, setBlockedShaking] = useState(false);

  const { events, status, result, passportId, trustScore, run, reset } =
    useAgentRun();

  // Fetch agent metadata once. If the URL id isn't a real UUID (mock-mode
  // demo path: /agents/test123/run), the API returns 401/404, so we fall
  // back to demo metadata so the top bar still renders.
  useEffect(() => {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const mockMeta: AgentMeta = {
      name:          "Demo Agent",
      walletAddress: "0x91B1eE6ACc4f2081Df156618d74EdD74B936A722",
      passportId:    "42",
    };

    if (!UUID_RE.test(id)) {
      setAgent(mockMeta);
      return;
    }

    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.agent) {
          setAgent({
            name:          data.agent.name,
            walletAddress: data.agent.walletAddress,
            passportId:    data.agent.passportId,
          });
        } else {
          setAgent(mockMeta);
        }
      })
      .catch(() => setAgent(mockMeta));
  }, [id]);

  // Trigger a one-shot shake on the status bar + overlay when run becomes blocked
  useEffect(() => {
    if (status !== "blocked") return;
    setBlockedShaking(true);
    const t = setTimeout(() => setBlockedShaking(false), 500);
    return () => clearTimeout(t);
  }, [status]);

  function handleRunWithPassport() {
    run({ agentId: id, url, prompt, withPassport: true });
  }

  function handleRunWithoutPassport() {
    run({ agentId: id, url, prompt, withPassport: false });
  }

  async function copyWallet() {
    if (!agent?.walletAddress) return;
    await navigator.clipboard.writeText(agent.walletAddress);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1500);
  }

  const txHash          = result?.txHash ?? null;
  const displayPassport = passportId ?? agent?.passportId ?? null;

  // The blocked overlay is passed down into SplitView → BrowserChrome
  const blockedOverlay =
    status === "blocked" ? (
      <MainBlockedOverlay shaking={blockedShaking} />
    ) : undefined;

  return (
    <main className="min-h-screen px-6 pb-20 pt-8 text-slate-100">
      <div className="mx-auto max-w-7xl">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              {agent?.name ?? "Loading agent…"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">Agent ID: {id}</p>
          </div>

          <div className="mt-1 flex items-center gap-3">
            {/* Wallet address pill */}
            {agent?.walletAddress && (
              <button
                onClick={copyWallet}
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:border-slate-500 hover:text-slate-100"
                title="Click to copy wallet address"
              >
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                {agent.walletAddress.slice(0, 6)}…{agent.walletAddress.slice(-4)}
                {walletCopied && <span className="text-green-400">✓</span>}
              </button>
            )}

            {/* Snowtrace link */}
            {agent?.walletAddress && (
              <a
                href={`https://testnet.snowtrace.io/address/${agent.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:border-slate-500 hover:text-slate-100"
              >
                Snowtrace ↗
              </a>
            )}

            {status !== "idle" && (
              <button
                onClick={reset}
                className="text-xs text-slate-400 underline hover:text-slate-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Run controls ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <RunControls
            url={url}
            prompt={prompt}
            isRunning={status === "running"}
            onUrlChange={setUrl}
            onPromptChange={setPrompt}
            onRunWithPassport={handleRunWithPassport}
            onRunWithoutPassport={handleRunWithoutPassport}
          />
        </div>

        {/* ── Split view ───────────────────────────────────────────────────
            Always rendered so the empty terminal with blinking cursor is
            visible before any run starts (acceptance criteria requirement).    */}
        <div className="mb-6">
          <SplitView
            url={url}
            events={events}
            status={status}
            iframeOverlay={blockedOverlay}
          />
        </div>

        {/* ── Result card (visible once a run completes) ───────────────── */}
        {result && <ResultCard result={result} />}
      </div>

      {/* ── Sticky passport status bar ────────────────────────────────── */}
      <PassportStatusBar
        passportId={displayPassport}
        trustScore={trustScore}
        txHash={txHash}
        status={status}
      />
    </main>
  );
}
