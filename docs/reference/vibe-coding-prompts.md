# Reference — Vibe-Coding Prompts

How to get the most out of Cursor, Claude Code, v0.dev, and Lovable on this project. Read this once at hour 0; come back to it when you're stuck.

## The golden rule

**Every prompt should reference a doc.** Never describe the project from scratch. The docs are your shared source of truth — point your coding agent at them.

✅ Good:
> Read `docs/03-api-contracts.md` and implement `POST /api/agents/create` per spec. Use the wallet utilities from `lib/agent/wallet.ts`.

❌ Bad:
> Build me an API route that creates an agent with a wallet and an on-chain passport.

The first prompt produces working code. The second produces a confident hallucination.

## Prompt skeleton (copy this)

```
CONTEXT:
- Project: Agent Passport (see docs/00-vision.md)
- Spec: docs/<the-relevant-doc>.md
- My role: docs/tasks/person-<N>-<role>.md

TASK:
<one sentence>

CONSTRAINTS:
- Tech stack from docs/01-architecture.md (Next.js 14 App Router, viem, etc.)
- API contracts are frozen — match docs/03-api-contracts.md exactly
- Server-only code goes in lib/, must `import "server-only"` at the top
- Don't add new dependencies without asking

ACCEPTANCE:
<copy the relevant checkboxes from your task card>

Generate the code.
```

This template works for Cursor, Claude Code, Aider, Cody — anything.

## What works on this codebase

### ✅ Works well

- **Pasting an API contract block and asking for a route handler.** The shape is clear, the agent fills in the orchestration.
- **"Write the vitest for X"** when X is a pure function. Coding agents nail unit tests for utilities.
- **v0.dev for whole-page UI scaffolds** when you give it the layout description in plain English. Don't try to refine in v0 — paste into your editor and refine there.
- **"Convert this Solidity ABI to TypeScript types"** — pasting the raw ABI works.
- **"Add error handling for these 3 cases: ..."** — explicit case enumeration → clean code.
- **Asking for a viem snippet** to read or write a specific contract function. Coding agents know viem well.

### ❌ Doesn't work well

- **"Build the whole feature"** prompts. They produce 800 lines of plausible-looking code that doesn't compile.
- **"Make it look better"** without specifics. Tell it: gradient X, spacing Y, animation Z.
- **Asking for ERC-4337, account abstraction, or anything we cut.** Coding agents will gleefully add it back. Be explicit: "use plain EOAs."
- **Letting the agent pick libraries.** Always specify: `viem` (not ethers), `@ai-sdk/anthropic` (not LangChain), `shadcn/ui` (not Material UI).
- **Generating Solidity tests without examples.** Show one passing test as a template, then ask for the rest.
- **Long sessions.** After ~30 minutes of conversation, agents drift. Start a new chat, paste the relevant doc, continue.

## Per-tool notes

### Cursor / Claude Code

- Use `@docs/` mentions in chat to pull doc context.
- Use `/edit` mode for surgical changes; `/agent` mode for new files.
- When generating multiple files, ask for them one at a time and review each before moving on. The "generate 5 files at once" path leads to drift.
- Pin the `docs/03-api-contracts.md` file in the sidebar — it's referenced constantly.

### v0.dev

- Best for: whole-page layouts, marketing pages, dashboards, complex forms.
- Worst for: streaming UI (it doesn't understand SSE), animations, anything stateful beyond local form state.
- Always describe **layout from top to bottom** and what each section contains.
- Specify the styling system: "Tailwind, shadcn/ui, Lucide icons" — otherwise it picks Material.
- After pasting in, expect to **rewrite the data layer**. v0 mocks state with hardcoded arrays; you'll replace those with hooks.

### Lovable / Bolt

- Best for: quickly scaffolding a working app skeleton at hour 0–1.
- Worst for: integrating with existing custom code (they want to own the whole repo).
- Don't use these mid-project. They'll regenerate things that already work.

### ChatGPT / Claude.ai (chat)

- Best for: rubber-ducking, converting one format to another, debugging an error message.
- Always paste the full error stack trace. Don't paraphrase.

## Specific prompts that work

### "Generate a typed API client"

```
Read docs/03-api-contracts.md. Generate a TypeScript file
lib/api/client.ts that exports one function per endpoint, with
correct types for request bodies and responses. For SSE endpoints,
return an AsyncIterable<AgentEvent>. No external dependencies
beyond fetch.
```

### "Generate Foundry tests from a spec"

```
Read docs/04-onchain-contracts.md. The "Tests" section lists 6
required test cases for AgentPassport. Generate them in
test/AgentPassport.t.sol following Foundry conventions. Use vm.prank
to test access control. Use vm.expectRevert for negative cases.
```

### "Convert ASCII to a real diagram"

```
Take the ASCII diagram in docs/01-architecture.md and produce an
excalidraw.com import (JSON format) that I can open and tweak.
Layout: user at top, Next.js in the middle, services below in a row.
```

### "Add error states to a form"

```
Here's my Create Agent dialog: [paste code]
Add error handling for these specific failures from
docs/03-api-contracts.md:
  - 400 validation error → show field-level errors inline
  - 502 provisioning_failed (step="wallet"|"funding"|"mint") →
    show toast "Failed at <step>", let user retry
  - Network error → show toast "Connection lost, try again"
Use shadcn/ui's <Alert> for inline errors.
```

### "Debug this transaction"

```
This viem call reverted with no reason: [paste code + error]
Here's the contract: [paste solidity function]
What's the most likely cause?
```

(Paste both the call and the function. Without both, the answer is a guess.)

## Anti-patterns to refuse

When a coding agent suggests any of the following, push back:

- **"Let's add a queue/Redis/worker for that"** → no. Use Vercel's request-scoped execution.
- **"Use ethers v6"** → no. We use viem.
- **"Wrap this in a try/catch and log"** without specific error types → no. Let it throw or handle the specific case.
- **"Add a useState for X"** when you could derive X from existing state → no.
- **"Let me also add some helper functions"** that aren't called from anywhere → no, delete them.
- **"This needs unit tests"** when you're at hour 22 → no. Skip it.

## When you're stuck

The honest debugging order:

1. **Read the error message.** All of it.
2. **Reproduce locally.** If it's only on Vercel, check env vars first.
3. **Check git diff.** Did you change something unrelated that broke this?
4. **Read the spec doc.** Are you matching the contract exactly?
5. **Paste the error + the relevant code into Claude.ai.** Not your IDE's chat — a fresh conversation. Sometimes a new context helps.
6. **Ask Person 1.** They've probably seen it before.
7. **Cut the feature.** It's hour 22. Some battles aren't worth winning.

## End-of-session checklist

Before closing your laptop, every time:

- [ ] `git status` — anything unstaged?
- [ ] `git push` — is it on the remote?
- [ ] `pnpm dev` — does it still run?
- [ ] Vercel preview built green?
- [ ] Posted in Slack/Discord: "I shipped X. I'm blocked on Y. I'll be back at Z."

The team can recover from a bug. They can't recover from "I worked on something for 4 hours and never pushed it."
