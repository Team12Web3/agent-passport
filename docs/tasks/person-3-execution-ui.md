# Person 3 — Agent Execution UI

> **You're building the most visible part of the demo.** The split-screen run view, the streaming terminal, and the trust-protocol kill-shot are the demo. Make it juicy.

## Mission

Build the most demo-visible page in the entire app: the agent execution view. Live SSE streaming, hacker-style terminal, split-screen comparison, and a red→green trust-protocol animation that users will remember.

## Files you own

```
apps/web/
├── app/(app)/agents/[id]/run/
│   └── page.tsx                     ← you write
├── components/run/
│   ├── RunControls.tsx              ← URL input, prompt, buttons
│   ├── SplitView.tsx                ← iframe + terminal layout
│   ├── BrowserChrome.tsx            ← fake browser frame around iframe
│   ├── AgentTerminal.tsx            ← streaming log, hacker style
│   ├── ResultCard.tsx               ← post-run summary + Snowtrace link
│   ├── TrustProtocolDemo.tsx        ← the kill-shot section
│   └── PassportStatusBar.tsx        ← bottom status (passport ID, trust score, tx)
├── hooks/
│   └── useAgentRun.ts               ← SSE client
└── lib/
    └── events.ts                    ← shared event types
```

## What you depend on

- **Person 1's** `/api/run` SSE endpoint (you can mock until it's real — see fixtures below)
- **Person 1's** event type definitions (mirror them in `lib/events.ts`)
- **Person 4's** agent detail page links to your route — confirm URL shape: `/agents/[id]/run`

## Acceptance criteria

### Run controls

- [ ] URL input (validates `https?://` prefix)
- [ ] Prompt textarea (≤500 chars, character counter)
- [ ] Two buttons: **Run with Passport** (primary) and **Run without Passport** (ghost)
- [ ] Pre-fills with safe default URL and prompt for the demo
- [ ] Disables buttons while a run is in progress

### Split-screen view

- [ ] Left pane (60%): iframe wrapped in a `<BrowserChrome />` (tab bar + fake address bar showing the URL)
- [ ] Right pane (40%): `<AgentTerminal />` — black bg, monospaced, 400px tall, scrolls
- [ ] iframe sandbox attributes: `sandbox="allow-same-origin"` only — no JS, no forms (safer with random URLs)
- [ ] Empty state for terminal: blinking cursor and "Awaiting instructions…"

### Streaming terminal

- [ ] Connects to `/api/run` via fetch + ReadableStream
- [ ] Auto-scrolls to bottom on each new event
- [ ] Each event renders with a colored prefix:
  - `started` cyan, `scraped` green, `cleaned` green, `thinking` yellow (with typewriter effect)
  - `tool` magenta, `logging` blue, `logged` bold green, `done` bold green with ✓
  - `error` red, `blocked` red bold
- [ ] `thinking` events accumulate in a single line that updates as deltas arrive (not one new line per token)
- [ ] Timestamp prefix `[mm:ss]` on each line based on time-since-start

### Result card

- [ ] Renders below split-view when `done` event fires
- [ ] Shows: summary (truncated to 6 lines + expand), action count, fee in USD
- [ ] **View on Snowtrace →** opens `https://testnet.snowtrace.io/tx/<txHash>` in new tab
- [ ] Copy tx hash button with toast feedback

### Trust Protocol demo

- [ ] Below the result card, a section titled **Trust Protocol**
- [ ] When user clicks **Run without Passport**:
  - Iframe overlays with a red panel showing a fake CAPTCHA + "403 — captcha_required"
  - Terminal logs `BLOCKED. This site only accepts verified agents.`
  - Status bar turns red, shakes once
- [ ] When user clicks **Run with Passport** after seeing the block:
  - Red panel slides up
  - Loading state: "Verifying passport on Avalanche…" with spinner (1.5s minimum)
  - Iframe content morphs into a clean rendered list of items (from the demo-site response)
  - Status bar pulses green: "Passport valid · Trust score 87"
  - Terminal: `> ✓ Passport verified · clean data returned`

### Passport status bar

- [ ] Bottom of page, sticky
- [ ] Shows: passport ID · trust score · tx hash (truncated, click to copy)
- [ ] States: `idle` (gray), `running` (blue pulse), `verified` (green pulse), `blocked` (red shake)

## Hour-by-hour

| Hour    | Task |
|---------|------|
| 0–2     | Read `03-api-contracts.md`; build local fixtures for SSE events |
| 2–6     | Generate UI scaffold via v0.dev (prompt below); paste components |
| 6–8     | `useAgentRun` hook against fixture stream; terminal renders |
| 8–10    | All event types render correctly with colors and typewriter |
| 10–14   | Switch to real `/api/run`; iterate on streaming UX |
| 14–16   | Result card + Snowtrace link |
| 16–20   | Trust protocol demo section + dual-run logic |
| 20–22   | Animations: red shake, green pulse, iframe morph |
| 22–24   | Polish, edge cases (slow network, error events) |
| 24–26   | Demo rehearsal with Person 5 |

## Vibe-coding prompts

### Hour 2–6: v0.dev UI scaffold

Paste this into v0.dev:

```
Design a "Run Agent Task" page for an AI agent platform.

Layout, top to bottom:
 1) Top bar: agent name (large), wallet address pill (truncated, copy icon),
    Snowtrace external-link button, "← Dashboard" back link far left.
 2) A card with: large URL input with a globe icon, large prompt textarea,
    two buttons in a row — "Run with Passport" (primary blue) and
    "Run without Passport" (ghost gray with shield-off icon).
 3) Split view, 60/40 columns, both 400px tall:
    Left: a fake browser chrome — three traffic-light dots, an address bar
    showing the URL (with a small lock icon), then an iframe of the URL inside.
    Right: a terminal panel — pure black background, monospaced (JetBrains Mono),
    text starts at top, scrolls automatically. A blinking cursor at the bottom
    when running. Color the leading "[mm:ss] " prefix in dim gray.
 4) Below split, a result card (only visible after run): big summary text,
    three small stats (Actions · Fee · Latency), a "View on Snowtrace →" button.
 5) Below result, a "Trust Protocol" section with its own heading. It contains
    a smaller version of the split view, side-by-side: "WITHOUT passport" (red
    border) showing a 403 + fake CAPTCHA placeholder; "WITH passport" (green
    border) showing the clean data list.
 6) Sticky bottom bar: Passport ID #42 · Trust Score 87 · Tx 0xab12…cd34
    (with copy icon). Pulses subtly when running.

Style: Tailwind, shadcn/ui, light mode default with deep gradient on the run card.
Accent color: Avalanche red (#E84142). Use Lucide icons. No clip art.

Export each top-level section as its own component.
```

### Hour 6–8: SSE hook

```
Create hooks/useAgentRun.ts:

"use client";
import { useState, useRef, useCallback } from "react";
import type { AgentEvent } from "@/lib/events";

export function useAgentRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error" | "blocked">("idle");
  const [result, setResult] = useState<any>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (input: {
    agentId: string; url: string; prompt: string; withPassport: boolean;
  }) => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setEvents([]); setResult(null); setStatus("running");

    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.current.signal,
    });
    if (!res.body) { setStatus("error"); return; }
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
          setEvents(prev => [...prev, ev]);
          if (ev.type === "done")    { setResult(ev.result); setStatus("done"); }
          if (ev.type === "blocked") { setStatus("blocked"); }
          if (ev.type === "error")   { setStatus("error"); }
        } catch {}
      }
    }
  }, []);

  const reset = useCallback(() => {
    setEvents([]); setResult(null); setStatus("idle");
  }, []);

  return { events, status, result, run, reset };
}
```

### Hour 6–8: Terminal component

```
Create components/run/AgentTerminal.tsx.

Props: events: AgentEvent[], status: "idle"|"running"|...

Render lines based on event type. Map event types to colors:
  started -> cyan,  scraped -> green,  cleaned -> green,
  thinking -> yellow (and accumulate deltas into the LAST line, not new lines),
  tool -> magenta,  tool_result -> dim magenta,
  logging -> blue,  logged -> bright green,
  blocked -> red bold,  error -> red,  done -> bright green bold ✓

Show a [mm:ss] prefix from time-since-first-event in dim gray.

Auto-scroll: useEffect on events.length, scroll containerRef.current to bottom.

When status === "running", append a blinking cursor block at the end.

Use a monospaced font: font-mono. Terminal bg: bg-black, text-gray-100.
Wrap long lines (break-words). Padding p-4. Rounded-lg overflow-hidden.

Export a fixture for testing:
  export const FIXTURE_EVENTS: AgentEvent[] = [
    { type: "started", runId: "1", passportId: "42" },
    { type: "scraped", chars: 24317, source: "firecrawl" },
    { type: "cleaned", chars: 18940 },
    { type: "thinking", delta: "Summarizing the page about " },
    { type: "thinking", delta: "internet bots…" },
    { type: "tool", name: "summarize", input: { focus: "main themes" } },
    { type: "logging", txHash: "0xab12cd34" },
    { type: "logged", txHash: "0xab12cd34", blockNumber: 42424242 },
    { type: "done", result: { summary: "...", actionsCount: 3, txHash: "0xab12cd34", feeUsd: 0 } },
  ];
```

### Hour 16–20: Trust Protocol demo

```
Create components/run/TrustProtocolDemo.tsx.

State:
  - protocolWith: { events, status, result } from useAgentRun()
  - protocolWithout: { events, status, result } from useAgentRun()

Render two cards side-by-side. Each has:
 - Header with shield icon (with/without strikethrough)
 - Mini split view (250px tall iframe + terminal)
 - Status footer: blocked (red) or verified (green)

Below the cards, a single "Run trust protocol comparison" button.

When clicked, do BOTH runs in parallel:
  protocolWithout.run({ ..., withPassport: false });
  await new Promise(r => setTimeout(r, 1500));
  protocolWith.run({ ..., withPassport: true });

The 1500ms gap lets the audience see the block before the verified run starts.

When protocolWithout sees a "blocked" event:
  - Overlay a red div with "403 — captcha_required" + a fake CAPTCHA image
    (just a hardcoded 9-square grid of placeholder images)
  - Shake animation: framer-motion transition x: [-2, 2, -2, 2, 0], 0.3s

When protocolWith sees "logged" (or "done"):
  - Fade out the iframe overlay
  - Show "Verifying passport…" spinner for 1.5s
  - Reveal the clean items as a styled list
  - Pulse the card's green border: animate boxShadow

Use framer-motion. Keep all animations under 2s total.
```

### Demo URL fixture

Pre-fill the URL input with a tested-safe default. Recommended:

```ts
const DEMO_URL = "https://en.wikipedia.org/wiki/Internet_bot";
const DEMO_PROMPT = "Summarize the main themes of this page in 3 sentences.";
```

Test with this 5+ times before the demo. If Wikipedia ever fails, fall back to:

```ts
const FALLBACK_URL = "https://books.toscrape.com/catalogue/category/books/mystery_3/";
```

## Common pitfalls

- **iframe security.** Wikipedia sets `X-Frame-Options: SAMEORIGIN`. The iframe will refuse to load. **Solution:** put a screenshot of the page as a fallback if iframe fails. Or skip the iframe entirely and just show "🌐 en.wikipedia.org/wiki/Internet_bot" with a link icon — the streaming terminal is what people actually watch.
- **SSE buffering.** If events don't stream live, check `Cache-Control: no-cache, no-transform` on the response.
- **Auto-scroll fights user.** When user scrolls up, stop auto-scroll. Resume when they scroll back to the bottom.
- **Long URLs break layout.** Truncate visible URL to 60 chars + "…".
- **Animation jank on weak laptops.** Test on the actual demo laptop. If GPU is slow, replace animation with simple opacity fades.
- **`thinking` events flood.** Throttle the deltas: accumulate into a string, but only re-render every 50ms via requestAnimationFrame.

## Done definition

You're done when Person 5 can rehearse the demo on the preview URL and the streaming terminal + result card + trust-protocol kill-shot all work without manual intervention, against `/api/run` and `/api/trust/demo-site` for real.
