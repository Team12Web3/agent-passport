# Person 1 — Backend & Contracts

> **You are the nervous system.** API contracts, smart contracts, agent runtime, deployments. If you slip, the team slips. If you ship the API spec at hour 1, everyone else can mock against it.

## Mission

Own the entire backend: Solidity contracts, Foundry deploys, all Next.js API routes, the agent runtime that wires scrape→LLM→on-chain log together, and the mock trusting-site reference implementation.

## Files you own

```
packages/contracts/
├── src/AgentPassport.sol            ← you write
├── src/ActionLog.sol                 ← you write
├── test/*.t.sol                      ← you write
├── script/Deploy.s.sol               ← you write
├── deployments.json                  ← committed after deploy
└── foundry.toml

apps/web/
├── app/api/
│   ├── agents/
│   │   ├── create/route.ts           ← you write
│   │   ├── list/route.ts             ← you write
│   │   └── [id]/route.ts             ← you write
│   ├── run/route.ts                  ← you write (SSE)
│   ├── log/submit/route.ts           ← you write
│   └── trust/demo-site/route.ts      ← you write
├── lib/
│   ├── agent/runtime.ts              ← you write
│   ├── chain/client.ts               ← you write (viem clients)
│   ├── chain/contracts.ts            ← you write (ABIs from deployments.json)
│   └── db/supabase.ts                ← you write
docs/
└── 03-api-contracts.md               ← you maintain (source of truth)
```

You also write the Supabase migration (SQL in `01-architecture.md`).

## What you depend on

- **Person 2's** `lib/agent/wallet.ts` (encrypts agent private keys, returns address)
- **Person 2's** `lib/agent/sign.ts` (signs trust-protocol headers)
- **Person 2's** `lib/agent/verify.ts` (verifies trust-protocol headers — used by `/api/trust/demo-site`)

You can stub these with mocks for the first 4 hours and hot-swap when Person 2 ships them.

## Acceptance criteria

Tick each off as you go. **All must pass for the demo to work.**

### Contracts

- [ ] `AgentPassport.sol` written per [04-onchain-contracts.md](../04-onchain-contracts.md) spec
- [ ] `ActionLog.sol` written per spec
- [ ] All `forge test` cases pass (see spec doc for the test list)
- [ ] Both contracts deployed to Avalanche Fuji
- [ ] `deployments.json` committed with addresses + ABIs
- [ ] `AgentPassport.setActionLog(actionLogAddress)` called once after deploy
- [ ] Snowtrace shows both contracts and they have valid ABIs

### Database

- [ ] Supabase tables `users`, `agents`, `action_runs` created
- [ ] Indexes added per [01-architecture.md](../01-architecture.md)
- [ ] `lib/db/supabase.ts` exports a service-role client (server-only)

### API routes

- [ ] `POST /api/agents/create` provisions wallet → funds → mints passport → DB row, returns spec'd payload
- [ ] `GET /api/agents/list` returns user's agents with `actionCount`
- [ ] `GET /api/agents/[id]` returns agent + recent runs
- [ ] `POST /api/run` streams SSE events per spec; final event is always `done` or `error`
- [ ] `POST /api/log/submit` submits an `ActionLog` tx and returns hash
- [ ] `GET /api/trust/demo-site` verifies passport headers; returns clean JSON OR 403 with `captchaPlaceholder: true`

### Agent runtime (`lib/agent/runtime.ts`)

- [ ] Accepts `{ agentId, url, prompt }` and an `emit(event)` callback
- [ ] Calls Firecrawl; falls back to Jina Reader on failure
- [ ] Cleans markdown (strip nav/footer/ad-style blocks via simple heuristics)
- [ ] Calls Anthropic via Vercel AI SDK with streaming
- [ ] Accumulates an `actions[]` array
- [ ] Computes `taskHash = keccak256(prompt || url)` and `actionsRoot = keccak256(JSON.stringify(actions))`
- [ ] Submits one `ActionLog.logAction` tx using the agent's signer
- [ ] Emits all spec'd event types in order

### Mock trusting site (`/api/trust/demo-site`)

- [ ] Returns 403 if any of three trust headers missing
- [ ] Returns 403 if timestamp >60s stale
- [ ] Returns 403 if signature recovers to wrong address
- [ ] Returns 403 if passport inactive
- [ ] Returns 200 + clean JSON when all checks pass
- [ ] All 403s include `captchaPlaceholder: true` for UI

### Integration

- [ ] End-to-end manual test: create agent via API → run task via curl → see Snowtrace tx
- [ ] You've handed Person 3 a working `/api/run` endpoint by hour 14
- [ ] You've handed Person 4 working `/api/agents/*` endpoints by hour 8

## Hour-by-hour

| Hour    | Task |
|---------|------|
| 0–1     | Repo skeleton, pnpm workspaces, push initial commit; Supabase schema run |
| 1–2     | Finalize `03-api-contracts.md`; ping team that it's frozen |
| 2–4     | Write contracts + tests; deploy to Fuji; commit `deployments.json` |
| 4–6     | `lib/db/supabase.ts`, `lib/chain/*`; build `/api/agents/create` (using Person 2's stubs) |
| 6–8     | `/api/agents/list` and `[id]`; help Person 4 wire dashboard |
| 8–12    | Build `lib/agent/runtime.ts`: Firecrawl + Jina + clean + Anthropic streaming |
| 12–14   | `/api/run` SSE endpoint driving the runtime; emit events |
| 14–16   | `/api/log/submit` and `/api/trust/demo-site` |
| 16–20   | Integration support — unblock teammates, fix bugs, end-to-end testing |
| 20–24   | Polish, error handling, edge cases |
| 24–26   | Buffer — there will be a fire |

## Vibe-coding prompts

### Hour 0–1: Repo skeleton

```
Create a pnpm monorepo. Root package.json + pnpm-workspace.yaml that includes
"apps/*" and "packages/*". Inside apps/web, scaffold a Next.js 14 app with
App Router, TypeScript, Tailwind, ESLint. Inside packages/contracts, run
`forge init --no-git`. Add a root .gitignore that ignores node_modules,
.next, .env*, packages/contracts/{out,cache,broadcast}.
```

### Hour 2–4: Smart contracts

```
In packages/contracts/src/, generate two Solidity ^0.8.20 contracts:

1) AgentPassport.sol — append-only registry.
   See docs/04-onchain-contracts.md for the full spec including struct,
   storage, events, modifiers, and constructor.
   Write Foundry tests in test/AgentPassport.t.sol covering: mint by
   platform succeeds, mint by non-platform reverts, duplicate agentWallet
   reverts, setActive auth, passportsOf returns ids, bumpTrust caps at 100.

2) ActionLog.sol — append-only audit log.
   Spec also in docs/04-onchain-contracts.md.
   Tests: caller-must-be-agentWallet, inactive-passport-reverts,
   fee transfer, zero-fee skips transfer, event fields correct.

3) script/Deploy.s.sol that deploys both, calls passport.setActionLog(log),
   prints addresses, and writes deployments.json with addresses+abis+chainId+network.
   Read PLATFORM_PRIVATE_KEY and USDC_ADDRESS from env.

Run `forge test -vv` and make all tests green before deploying.
```

### Hour 4–6: API route — create agent

```
Create app/api/agents/create/route.ts. Export a POST handler.

Steps inside:
 1. Verify Thirdweb session; fetch user from Supabase users table by thirdweb_id
    (insert if missing).
 2. Validate body: name (1-40), purpose (1-200), tools (non-empty subset of
    ["scraper","summarizer","logger"]). Return 400 with details if invalid.
 3. Call lib/agent/wallet.ts createAgentWallet(userId) → returns {address, encryptedKey}.
 4. Call lib/agent/wallet.ts fundAgentWallet(address) → sends 0.05 AVAX + 5 USDC,
    returns funding txHash. Wait 1 confirmation.
 5. Call AgentPassport.mintPassport from PLATFORM_PRIVATE_KEY. Wait 1 confirmation.
    Read passportId from PassportMinted event.
 6. INSERT into agents table.
 7. Return { agentId, passportId, walletAddress, fundingTxHash, mintTxHash }.

Wrap each step in try/catch and return 502 with step name on failure.
Use viem for chain interactions, with the public + wallet clients from
lib/chain/client.ts. Read contract address+abi from lib/chain/contracts.ts
(which imports deployments.json).
```

### Hour 8–12: Agent runtime

```
Create lib/agent/runtime.ts.

Export: async function runAgentTask(
  args: { agentId: string, url: string, prompt: string, withPassport: boolean },
  emit: (event: AgentEvent) => void
): Promise<{ runId: string, txHash?: string, summary: string }>

Steps:
 1. Insert action_runs row with status="pending", get runId. emit("started",
    runId, passportId).
 2. Build trust headers (if withPassport) via lib/agent/sign.ts.
 3. Fetch the URL: try Firecrawl first (POST https://api.firecrawl.dev/v1/scrape
    with formats: ["markdown"], headers from step 2). If fails, fall back to Jina:
    GET https://r.jina.ai/${url}. emit("scraped", chars, source) or emit("fallback").
 4. Clean markdown: strip lines that look like nav, footer, "Skip to main content",
    cookie banners, and contiguous link-only blocks. emit("cleaned", chars).
 5. Call Anthropic via @ai-sdk/anthropic + streamText. System: "You are an analyst.
    Answer the user's prompt based on the page content provided." Stream tokens;
    emit("thinking", delta) for each chunk.
 6. Push every step into actions[] = [{step, tool, input, output, ts}, ...].
 7. After streaming completes, compute taskHash = keccak256(toUtf8Bytes(prompt + "|" + url))
    and actionsRoot = keccak256(toUtf8Bytes(JSON.stringify(actions))).
 8. Build wallet client from lib/agent/wallet.ts getAgentSigner(agentWalletId).
    Call ActionLog.logAction(passportId, taskHash, actionsRoot, feeAmount=100000n,
    beneficiary=PLATFORM_ADDRESS). emit("logging", txHash). Wait 1 confirmation.
    emit("logged", txHash, blockNumber).
 9. Update action_runs row: status="done", result, actions, log_tx_hash.
10. emit("done", { summary, actionsCount, txHash, feeUsd: 0 }).

If withPassport === false (trust-protocol demo path), step 3's request will
be blocked by the demo-site (since headers are absent). Catch the 403 response
and emit("blocked", 403, message), skip steps 4-9, set status="error", and end.
```

### Hour 12–14: SSE endpoint

```
Create app/api/run/route.ts. POST handler.

Validate body, then return:

new Response(
  new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await runAgentTask({ agentId, url, prompt, withPassport }, send);
      } catch (err) {
        send({ type: "error", message: String(err.message ?? err) });
      } finally {
        controller.close();
      }
    }
  }),
  { headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
  }}
);

Verify the agent belongs to the current user before running.
```

### Hour 14–16: Mock trusting site

```
Create app/api/trust/demo-site/route.ts. GET handler.

Read X-Agent-Passport-ID, X-Agent-Signature, X-Agent-Timestamp from
request.headers. If any missing, return:
  Response.json({ error: "captcha_required",
                  message: "This site only accepts verified agents.",
                  captchaPlaceholder: true }, { status: 403 });

Then call lib/agent/verify.ts verifyAgentHeaders({ headers, url: request.url }).
Trap the specific failure: stale_timestamp, bad_signature, untrusted_agent.
Return 403 with the matching error code and captchaPlaceholder: true.

On success, return 200:
  { title: "AI Marketplace · Demo Site",
    content: "<a long lorem ipsum>",
    items: [
      { name: "Vintage typewriter", price: "$120" },
      { name: "Scout journal", price: "$28" },
      { name: "Brass compass", price: "$65" } ],
    trustScore: passport.trustScore }
```

## Common pitfalls

- **`viem` types are strict.** Use `0x${string}` template literal types for hex; don't pass plain strings.
- **`bigint` doesn't JSON-stringify.** When sending passport IDs in API responses, convert with `.toString()`.
- **SSE buffering.** On Vercel, ensure no proxy is buffering the stream — set `Cache-Control: no-cache, no-transform`.
- **Anthropic streaming.** Use `streamText` from `@ai-sdk/anthropic`, not direct fetch — it handles backpressure.
- **Foundry env vars.** Use `vm.envUint("PLATFORM_PRIVATE_KEY")` and `vm.envAddress(...)`. Don't hardcode.
- **`mintPassport` from a contract call.** The platform key signs a transaction *to* the contract — `walletClient.writeContract({ ..., functionName: "mintPassport", args: [...] })`.
- **Keccak hashing strings.** `keccak256(toUtf8Bytes(...))` — don't pass raw strings to `keccak256`.

## Done definition

You're done when Person 3 can call `/api/run`, see streaming events, and the final event includes a real Snowtrace-verifiable tx hash; AND when `/api/trust/demo-site` returns 403 without headers and 200 with valid headers.
