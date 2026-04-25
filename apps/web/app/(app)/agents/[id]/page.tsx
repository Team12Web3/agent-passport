"use client";

import { useEffect, useRef, useState } from "react";

type PageProps = {
  params: {
    id: string;
  };
};

type AgentEvent = {
  id: number;
  type: "info" | "thinking" | "success" | "warning" | "error";
  message: string;
};

type AgentResult = {
  summary: string;
  actionCount: number;
  totalFee: string;
  snowtraceUrl: string;
  txHash: string;
};

type AgentStatus = "idle" | "running" | "completed";

function useAgentRun({
  agentId,
  url,
  prompt,
}: {
  agentId: string;
  url: string;
  prompt: string;
}) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [result, setResult] = useState<AgentResult | null>(null);

  function run() {
    setEvents([]);
    setResult(null);
    setStatus("running");

    const mockEvents: AgentEvent[] = [
      {
        id: 1,
        type: "info",
        message: `Starting agent ${agentId}`,
      },
      {
        id: 2,
        type: "info",
        message: `Loading target URL: ${url}`,
      },
      {
        id: 3,
        type: "thinking",
        message: "Thinking... checking page structure and trust signals",
      },
      {
        id: 4,
        type: "warning",
        message: "CAPTCHA detected. Starting passport verification",
      },
      {
        id: 5,
        type: "thinking",
        message: `Thinking... applying prompt: "${prompt}"`,
      },
      {
        id: 6,
        type: "success",
        message: "Passport valid. Trust score 87",
      },
      {
        id: 7,
        type: "success",
        message: "Task completed successfully",
      },
    ];

    mockEvents.forEach((event, index) => {
      setTimeout(() => {
        setEvents((prev) => [...prev, event]);

        if (index === mockEvents.length - 1) {
          setStatus("completed");
          setResult({
            summary:
              "Agent verified the target website, bypassed the blocked flow using passport verification, and returned clean trusted data.",
            actionCount: 5,
            totalFee: "0.003 AVAX",
            snowtraceUrl: "https://snowtrace.io/",
            txHash:
              "0x7b3f9a8d21c4e6f9a9b2c3d4e5f67890123456789abcdef0123456789abcd",
          });
        }
      }, index * 900);
    });
  }

  return {
    events,
    status,
    result,
    run,
  };
}

function Terminal({
  events,
  status,
}: {
  events: AgentEvent[];
  status: AgentStatus;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  function getEventColor(type: AgentEvent["type"]) {
    if (type === "success") return "text-green-400";
    if (type === "warning") return "text-yellow-400";
    if (type === "error") return "text-red-400";
    if (type === "thinking") return "text-blue-400";
    return "text-zinc-300";
  }

  return (
    <div className="h-[520px] overflow-y-auto rounded-xl border border-zinc-800 bg-black p-4 font-mono text-sm">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <p className="text-zinc-300">Agent Log Terminal</p>
        <p className="text-xs text-zinc-500">Status: {status}</p>
      </div>

      {events.length === 0 && (
        <p className="text-zinc-500">
          Waiting for task. Click Run task to start the agent.
        </p>
      )}

      {events.map((event) => (
        <div key={event.id} className="mb-3">
          <span className="text-zinc-600">&gt; </span>
          <span className={getEventColor(event.type)}>
            [{event.type.toUpperCase()}]{" "}
          </span>
          <span className="text-zinc-300">{event.message}</span>

          {event.type === "thinking" && (
            <span className="ml-1 animate-pulse text-blue-400">...</span>
          )}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

function ResultCard({ result }: { result: AgentResult | null }) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return null;
  }

  const txHash = result.txHash;

  async function copyTxHash() {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white">Result</h2>

      <p className="mt-3 text-zinc-400">{result.summary}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-black p-4">
          <p className="text-sm text-zinc-500">Action Count</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {result.actionCount}
          </p>
        </div>

        <div className="rounded-lg bg-black p-4">
          <p className="text-sm text-zinc-500">Total Fee</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {result.totalFee}
          </p>
        </div>

        <div className="rounded-lg bg-black p-4">
          <p className="text-sm text-zinc-500">Snowtrace</p>
          <a
            href={result.snowtraceUrl}
            target="_blank"
            className="mt-2 block text-green-400 hover:underline"
          >
            View transaction
          </a>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-black p-4">
        <p className="text-sm text-zinc-500">Transaction Hash</p>

        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="break-all font-mono text-sm text-zinc-300">
            {result.txHash}
          </p>

          <button
            onClick={copyTxHash}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrustProtocolDemo() {
  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white">Trust Protocol Demo</h2>

      <p className="mt-2 text-sm text-zinc-400">
        Side-by-side comparison showing the difference between a normal blocked
        request and a passport verified request.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-5">
          <p className="text-sm text-red-400">Without Passport Headers</p>
          <h3 className="mt-2 text-lg font-semibold text-red-300">
            Blocked
          </h3>
          <p className="mt-3 text-sm text-red-200">
            Request blocked because no trusted agent passport headers were
            provided.
          </p>
        </div>

        <div className="rounded-xl border border-green-800 bg-green-950/30 p-5">
          <p className="text-sm text-green-400">With Passport Headers</p>
          <h3 className="mt-2 text-lg font-semibold text-green-300">
            Clean Data
          </h3>
          <p className="mt-3 text-sm text-green-200">
            Request accepted because the agent passport was verified
            successfully.
          </p>
        </div>
      </div>
    </div>
  );
}

function KillShotAnimation() {
  const [step, setStep] = useState<"captcha" | "verifying" | "valid">(
    "captcha"
  );

  function startVerification() {
    setStep("verifying");

    setTimeout(() => {
      setStep("valid");
    }, 1600);
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white">Kill-shot Demo</h2>

      <p className="mt-2 text-sm text-zinc-400">
        A simple demo showing CAPTCHA replaced by passport verification.
      </p>

      <div className="mt-6 rounded-xl bg-black p-6">
        {step === "captcha" && (
          <div className="rounded-xl border border-red-700 bg-red-950/40 p-6 text-center">
            <p className="text-lg font-semibold text-red-300">
              CAPTCHA Required
            </p>
            <p className="mt-2 text-sm text-red-200">
              Human verification is blocking the agent.
            </p>

            <button
              onClick={startVerification}
              className="mt-5 rounded-lg bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-400"
            >
              Verify Passport Instead
            </button>
          </div>
        )}

        {step === "verifying" && (
          <div className="rounded-xl border border-yellow-700 bg-yellow-950/40 p-6 text-center">
            <p className="animate-pulse text-lg font-semibold text-yellow-300">
              Verifying passport...
            </p>
          </div>
        )}

        {step === "valid" && (
          <div className="rounded-xl border border-green-700 bg-green-950/40 p-6 text-center">
            <p className="text-3xl">✅</p>
            <p className="mt-3 text-lg font-semibold text-green-300">
              Passport valid. Trust score 87.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentRunPage({ params }: PageProps) {
  const [url, setUrl] = useState("https://example.com");
  const [prompt, setPrompt] = useState(
    "Check whether this website can be accessed by a trusted AI agent."
  );

  const { events, status, result, run } = useAgentRun({
    agentId: params.id,
    url,
    prompt,
  });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm text-zinc-500">Agent ID: {params.id}</p>

          <h1 className="mt-2 text-3xl font-bold">
            Agent Task Execution
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Enter a target URL and a prompt, then run the agent. The left side
            shows the target website, while the right side streams the agent log.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-400">Target URL</label>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-green-500"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Prompt</label>
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-green-500"
                placeholder="Tell the agent what to do"
              />
            </div>
          </div>

          <button
            onClick={run}
            disabled={status === "running"}
            className="mt-6 w-full rounded-xl bg-green-500 px-6 py-4 text-lg font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {status === "running" ? "Running..." : "Run task"}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Target URL Preview</h2>
              <p className="text-xs text-zinc-500">iframe</p>
            </div>

            <iframe
              src={url}
              className="h-[520px] w-full rounded-xl border border-zinc-800 bg-white"
              title="Target URL preview"
            />
          </div>

          <Terminal events={events} status={status} />
        </div>

        <ResultCard result={result} />

        <TrustProtocolDemo />

        <KillShotAnimation />
      </div>
    </main>
  );
}