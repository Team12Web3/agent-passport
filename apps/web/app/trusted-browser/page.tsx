"use client";

import { useMemo, useRef, useState } from "react";

import {
  buildDemoTrustedHeaders,
  type DemoHeaders,
  type DemoScenarioMode,
  type DemoVerificationStep,
} from "@/lib/agent/demoTrust";

const DEFAULT_URL = "http://172.20.10.249:3001/";
const DEFAULT_INTENT =
  "Find the clean product list without interacting with popups or human-check traps.";
const DEFAULT_ACTION = "GET|/|sanitize-hostile-page";
const DEFAULT_AMOUNT_USD = 68;

type RelayResult = {
  trusted: boolean;
  code: string;
  message: string;
  headers: DemoHeaders;
  steps: DemoVerificationStep[];
  removed?: string[];
  cleanedHtml?: string;
};

type ViewMode = "original" | "response";
type SideTab = "headers" | "verification";

const SCENARIOS: Array<{
  mode: DemoScenarioMode;
  label: string;
  tone: "emerald" | "rose" | "amber" | "zinc";
}> = [
  { mode: "valid", label: "All Trust Layers", tone: "emerald" },
  { mode: "no-passport", label: "No Passport", tone: "rose" },
  { mode: "no-stake", label: "No Stake", tone: "amber" },
  { mode: "forge-claims", label: "Forge Claims", tone: "zinc" },
  { mode: "forge-proof", label: "Forge Proof", tone: "zinc" },
  { mode: "tamper-action", label: "Tamper Action", tone: "zinc" },
];

function shorten(value: string): string {
  if (value.length <= 38) return value;
  return `${value.slice(0, 14)}...${value.slice(-14)}`;
}

function scenarioButtonClass(tone: "emerald" | "rose" | "amber" | "zinc"): string {
  if (tone === "emerald") {
    return "border-emerald-800 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-950";
  }
  if (tone === "rose") {
    return "border-rose-800 bg-rose-950/60 text-rose-200 hover:bg-rose-950";
  }
  if (tone === "amber") {
    return "border-amber-800 bg-amber-950/60 text-amber-200 hover:bg-amber-950";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700";
}

function scenarioInactiveClass(isDimmed: boolean): string {
  return isDimmed ? "opacity-45 saturate-50" : "opacity-100";
}

function buildResponseDocument(result: RelayResult | null): string {
  const failedSteps = (result?.steps ?? []).filter((step) => !step.ok);
  const statusTone = result?.trusted
    ? {
        border: "rgba(16, 185, 129, 0.35)",
        bg: "rgba(6, 78, 59, 0.28)",
        text: "#d1fae5",
        badge: "Trusted",
        accent: "#6ee7b7",
      }
    : {
        border: "rgba(244, 63, 94, 0.35)",
        bg: "rgba(136, 19, 55, 0.24)",
        text: "#fecdd3",
        badge: "Blocked",
        accent: "#fda4af",
      };

  const removed = result?.removed?.length
    ? `<div class="chips">${result.removed
        .map((item) => `<span class="chip">${item}</span>`)
        .join("")}</div>`
    : '<p class="muted"><strong style="color: #fda4af;">FAIL:</strong> No elements were removed because the relay did not unlock the clean lane.</p>';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #09090b;
        color: #f4f4f5;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap { padding: 18px; }
      .badge {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .card {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(24,24,27,0.92);
        border-radius: 18px;
        padding: 16px;
        margin-bottom: 14px;
      }
      .card.alert {
        border-color: rgba(244, 63, 94, 0.35);
        background: rgba(76, 5, 25, 0.24);
      }
      .muted { color: #a1a1aa; }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .chip {
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        font-size: 12px;
      }
      .steps { display: grid; gap: 10px; margin-top: 10px; }
      .step {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 12px;
        background: rgba(9,9,11,0.92);
      }
      .step-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }
      .pill {
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .pill.pass {
        background: rgba(16, 185, 129, 0.15);
        color: #6ee7b7;
      }
      .pill.fail {
        background: rgba(244, 63, 94, 0.15);
        color: #fda4af;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card ${result?.trusted ? "" : "alert"}">
        <div style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #71717a;">Removed interference</div>
        ${removed}
      </div>
      <div class="card">
        <div style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #71717a;">Verification snapshot</div>
        <div class="steps">
          ${(failedSteps.length ? failedSteps : [])
            .slice(0, 5)
            .map(
              (step) => `
                <div class="step">
                  <div class="step-row">
                    <strong>${step.label}</strong>
                    <span class="pill ${step.ok ? "pass" : "fail"}">${step.ok ? "pass" : "fail"}</span>
                  </div>
                  <div class="muted">${step.detail}</div>
                </div>`,
            )
            .join("")}
          ${
            !failedSteps.length
              ? '<div class="muted" style="margin-top: 10px;">No failed verification steps to show.</div>'
              : ""
          }
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export default function TrustedBrowserPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [action, setAction] = useState(DEFAULT_ACTION);
  const [amountUsd, setAmountUsd] = useState(DEFAULT_AMOUNT_USD);
  const [activeMode, setActiveMode] = useState<DemoScenarioMode | null>(null);
  const [result, setResult] = useState<RelayResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [sideTab, setSideTab] = useState<SideTab>("verification");
  const activeRequestRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);

  async function run(mode: DemoScenarioMode) {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    setIsLoading(true);
    setActiveMode(mode);
    setViewMode("response");

    try {
      const { headers } = await buildDemoTrustedHeaders({
        url,
        intent,
        action,
        amountUsd,
        mode,
      });

      const response = await fetch("/api/relay/clean-html", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          url,
          intent,
          action,
          amountUsd,
          mode,
        }),
      });

      const payload = (await response.json()) as RelayResult;
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setResult(payload);
      setSideTab(payload.trusted ? "verification" : "headers");
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "The relay request failed.";
      setResult({
        trusted: false,
        code: "relay_request_failed",
        message,
        headers: {},
        steps: [
          {
            label: "Relay request failed",
            capability: "baseline",
            ok: false,
            detail: message,
          },
        ],
      });
      setSideTab("verification");
    } finally {
      if (requestId === latestRequestIdRef.current) {
        activeRequestRef.current = null;
        setIsLoading(false);
      }
    }
  }

  const previewSrcDoc = useMemo(() => {
    if (viewMode === "original") {
      return undefined;
    }
    if (result?.trusted && result.cleanedHtml) {
      return result.cleanedHtml;
    }
    return buildResponseDocument(result);
  }, [result, viewMode]);

  const previewSrc = viewMode === "original" ? url : undefined;

  return (
    <main className="h-screen overflow-hidden bg-zinc-950 px-4 py-4 text-zinc-100">
      <div className="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_auto_1fr] gap-4">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-500">
                Trusted Browser
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                One-window hostile page vs trust response demo
              </h1>
              <p className="max-w-3xl text-sm text-zinc-400">
                Click a protocol scenario and the left preview switches straight
                from the raw hostile page to the relay response. The right panel
                stays focused on the trust bundle and the verification outcome.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewMode("original");
                  setActiveMode(null);
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  viewMode === "original"
                    ? "border-zinc-600 bg-zinc-800 text-white"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400"
                }`}
              >
                Original Page
              </button>
              <button
                type="button"
                onClick={() => setViewMode("response")}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  viewMode === "response"
                    ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400"
                }`}
              >
                Relay Response
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1.1fr_0.7fr]">
            <div className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Target URL
              </label>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Intent
              </label>
              <input
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Amount (USD)
              </label>
              <input
                type="number"
                value={amountUsd}
                onChange={(event) => setAmountUsd(Number(event.target.value))}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.mode}
                type="button"
                onClick={() => void run(scenario.mode)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  activeMode === scenario.mode ? "ring-1 ring-white/30" : ""
                } ${scenarioInactiveClass(
                  viewMode === "original" ||
                    (activeMode !== null && activeMode !== scenario.mode),
                )} ${scenarioButtonClass(scenario.tone)}`}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-h-0 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          <div
            className={`min-h-0 rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 ${
              viewMode === "original" ? "xl:col-span-2" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Live Preview
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {viewMode === "original"
                    ? "Raw hostile website"
                    : result?.trusted
                      ? "Trusted clean relay output"
                      : "Blocked relay response"}
                </h2>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Open raw page
              </a>
            </div>
            <iframe
              key={`${viewMode}-${result?.code ?? "pending"}`}
              title="Trusted browser preview"
              src={previewSrc}
              srcDoc={previewSrcDoc}
              className="h-full min-h-[620px] w-full rounded-md border border-zinc-800 bg-white"
              sandbox={viewMode === "response" ? "" : undefined}
            />
          </div>

          {viewMode === "response" ? (
            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
              <div
                className={`rounded-lg border p-4 ${
                  result?.trusted
                    ? "border-emerald-700 bg-emerald-950/25"
                    : "border-zinc-800 bg-zinc-900/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Final Result
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {result?.trusted
                        ? "Popup ads stripped automatically"
                        : "Relay blocked the clean lane"}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      result?.trusted
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-rose-400/15 text-rose-300"
                    }`}
                  >
                    {isLoading ? "running" : result?.code ?? "pending"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-300">
                  {result?.message ??
                    "The page starts on the raw hostile site. Click any protocol scenario to replace that preview with the relay response and inspect the trust outcome on the right."}
                </p>
                {!result?.trusted && result ? (
                  <div className="mt-4 rounded-md border border-rose-800/70 bg-rose-950/30 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                      Fail reason
                    </div>
                    <div className="mt-1 text-sm font-medium text-rose-100">
                      {result.steps.find((step) => !step.ok)?.label ?? "Verification failed"}
                    </div>
                    <div className="mt-1 text-sm text-rose-200/85">
                      {result.steps.find((step) => !step.ok)?.detail ?? result.message}
                    </div>
                  </div>
                ) : null}
                {result?.removed?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.removed.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid min-h-0 grid-rows-[auto_1fr] rounded-lg border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSideTab("verification")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      sideTab === "verification"
                        ? "border-zinc-600 bg-zinc-800 text-white"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideTab("headers")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      sideTab === "headers"
                        ? "border-zinc-600 bg-zinc-800 text-white"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    Trust Bundle
                  </button>
                </div>

                <div className="min-h-0 overflow-auto pr-1">
                  {sideTab === "verification" ? (
                    <div className="space-y-2">
                      {(result?.steps ?? []).map((step) => (
                        <div
                          key={step.label}
                          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-zinc-100">
                                {step.label}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {step.detail}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                step.ok
                                  ? "bg-emerald-400/15 text-emerald-300"
                                  : "bg-rose-400/15 text-rose-300"
                              }`}
                            >
                              {step.ok ? "pass" : "fail"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(result?.headers ?? {}).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
                        >
                          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                            {key}
                          </div>
                          <div className="mt-1 break-all font-mono text-xs text-zinc-200">
                            {shorten(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
