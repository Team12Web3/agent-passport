# 03 — API Contracts

**This file is the source of truth.** Person 1 owns it. Updates require Person 1's approval and a Slack/Discord ping.

All routes live under `/apps/web/app/api`. JSON in/out unless noted. All hex strings are `0x`-prefixed.

---

## `POST /api/agents/create`

Provision a new agent end-to-end: wallet, funding, on-chain passport mint, DB row.

**Auth:** required (Thirdweb session cookie)

**Request**
```ts
{
  name: string,            // 1–40 chars
  purpose: string,         // 1–200 chars
  tools: ("scraper" | "summarizer" | "logger")[]   // at least 1
}
```

**Response** `201 Created`
```ts
{
  agentId: string,                // uuid
  passportId: string,             // bigint as string
  walletAddress: `0x${string}`,
  fundingTxHash: `0x${string}`,   // AVAX funding tx
  mintTxHash: `0x${string}`       // passport mint tx
}
```

**Errors**
- `400` validation error → `{ error: "validation", details: {...} }`
- `401` not signed in → `{ error: "unauthorized" }`
- `502` chain or faucet failed → `{ error: "provisioning_failed", step: "wallet"|"funding"|"mint" }`

**Owner:** Person 1 (route + provisioning orchestration), Person 2 (wallet generation, funding, signing utils that this calls).

---

## `GET /api/agents/list`

List all agents owned by the current user.

**Auth:** required

**Response** `200`
```ts
{
  agents: Array<{
    agentId: string,
    name: string,
    purpose: string,
    tools: string[],
    passportId: string,
    walletAddress: `0x${string}`,
    actionCount: number,
    createdAt: string                // ISO 8601
  }>
}
```

**Owner:** Person 1.

---

## `GET /api/agents/:id`

Single agent detail with recent action runs.

**Auth:** required (must own the agent)

**Response** `200`
```ts
{
  agent: {
    agentId: string,
    name: string,
    purpose: string,
    tools: string[],
    passportId: string,
    walletAddress: `0x${string}`,
    createdAt: string,
    mintTxHash: `0x${string}`
  },
  runs: Array<{
    id: string,
    url: string,
    prompt: string,
    status: "pending" | "done" | "error",
    summary?: string,
    actionsCount: number,
    feeUsd: number,
    logTxHash?: `0x${string}`,
    createdAt: string
  }>
}
```

**Owner:** Person 1.

---

## `POST /api/run` — **streaming (Server-Sent Events)**

Run an agent task. Streams events as they happen.

**Auth:** required (must own the agent)

**Headers:** `Content-Type: application/json`

**Request**
```ts
{
  agentId: string,
  url: string,             // must be http(s)://
  prompt: string,
  withPassport?: boolean   // default true; false = trust-protocol demo "blocked" run
}
```

**Response**
- Status `200`
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Body: stream of `data: {...}\n\n` lines

**Event types**
```ts
type AgentEvent =
  | { type: "started",   runId: string, passportId: string }
  | { type: "scraped",   chars: number, source: "firecrawl" | "jina" }
  | { type: "fallback",  reason: string }                     // when firecrawl fails
  | { type: "cleaned",   chars: number }
  | { type: "thinking",  delta: string }                      // streaming LLM tokens
  | { type: "tool",      name: string, input: object }
  | { type: "tool_result", name: string, output: object }
  | { type: "logging",   txHash: `0x${string}` }              // tx broadcast
  | { type: "logged",    txHash: `0x${string}`, blockNumber: number }
  | { type: "blocked",   status: 403, error: string }         // trust-protocol "without passport" path
  | { type: "verified",  passportId: string, trustScore: number } // when site verifies us
  | { type: "done",      result: { summary: string, actionsCount: number, txHash?: string, feeUsd: number } }
  | { type: "error",     message: string }
```

The stream MUST end with either `done` or `error`. Server closes the connection after.

**Owner:** Person 1 (route + runtime), Person 3 (consumer).

---

## `POST /api/log/submit`

Submit an `ActionLog` tx for a run that already happened. Used internally by the runtime; exposed in case the runtime needs to retry.

**Auth:** required

**Request**
```ts
{
  agentId: string,
  runId: string,
  taskHash: `0x${string}`,        // keccak256(prompt || url)
  actionsRoot: `0x${string}`,     // keccak256(JSON.stringify(actions))
  feeAmount: "0",                 // zero-fee log; gas is paid with AVAX
  beneficiary: `0x${string}`
}
```

**Response** `200`
```ts
{ txHash: `0x${string}`, blockNumber: number }
```

**Owner:** Person 1.

---

## `GET /api/trust/demo-site`

**This is our reference implementation of a trusting website.** It checks passport headers and either returns clean data or blocks with a 403.

**Auth:** none (this is a public website endpoint, not our app)

**Required headers (sent by agent):**
```
X-Agent-Passport-ID:   <decimal string>
X-Agent-Signature:     0x<hex>
X-Agent-Timestamp:     <unix seconds, decimal>
X-Agent-Session-Proof: 0x<hex or encoded payload>
X-Agent-Intent-Hash:   0x<hex>
```

**Verification (server-side):**
1. All required headers present? Else `403 captcha_required`.
2. `|now - timestamp| <= 60`? Else `403 stale_timestamp`.
3. Resolve `X-Agent-Passport-ID` to the passport record plus its EAS attestation (or cached attestation data).
4. Recover signer from `keccak256(passportId || "|" || url || "|" || timestamp || "|" || termsHash || "|" || intentHash)`.
5. Verify the signer is a valid session key authorized on-chain by the passport owner.
6. Verify the signature implies acceptance of the current Terms of Service.
7. Optionally verify that the supplied intent proof shows the current action is derived from `X-Agent-Intent-Hash`.
8. If the agent later abuses the site, persist the same signed payload as slashable evidence.

**Success response** `200`
```ts
{
  title: string,
  content: string,                                 // long-form text the agent can summarize
  items: Array<{ name: string, price: string }>,   // pretend product list
  trustScore: number,                              // echoed from passport
  attributes: {
    developer: string,
    modelPlatform: string,
    labels: string[]
  }
}
```

**Failure response** `403`
```ts
{
  error:
    | "captcha_required"
    | "stale_timestamp"
    | "bad_signature"
    | "invalid_session_key"
    | "invalid_intent_proof"
    | "untrusted_agent",
  message: string,
  captchaPlaceholder: true       // tells our UI to show the fake CAPTCHA overlay
}
```

**Owner:** Person 1 (route), Person 2 (verification utility used by the route).

---

## `POST /api/trust/report-abuse`

Website-side helper for submitting signed request evidence into a staking/slashing flow.

**Auth:** none in the demo; production would gate this

**Request**
```ts
{
  passportId: string,
  signature: `0x${string}`,
  timestamp: string,
  intentHash: `0x${string}`,
  evidenceUri: string,
  reason: "ddos" | "policy_violation"
}
```

**Response** `200`
```ts
{
  accepted: boolean,
  slashAmountEth?: string
}
```

**Owner:** Person 1.

---

## Database write paths (server-only)

These are not HTTP endpoints, but contractual: which routes write to which tables.

| Route                    | Reads                      | Writes                              |
|--------------------------|----------------------------|-------------------------------------|
| `POST /api/agents/create`| `users`                    | `agents`                            |
| `GET  /api/agents/list`  | `agents`, `action_runs`    | —                                   |
| `GET  /api/agents/:id`   | `agents`, `action_runs`    | —                                   |
| `POST /api/run`          | `agents`                   | `action_runs` (insert + update)     |
| `POST /api/log/submit`   | `action_runs`              | `action_runs` (update)              |
| `GET  /api/trust/demo-site` | on-chain only           | —                                   |

---

## Contract changes

To request a change to this file:

1. Post in #api-contracts: *"@person1 — proposing change to {endpoint}: {what}, because {why}"*.
2. Person 1 responds yes/no/modify within 10 minutes.
3. If yes, Person 1 edits this file in a single commit and pings affected owners.
4. Affected owners pull main and adjust.

**Do not change this file unilaterally.** Mocks and types depend on it.
