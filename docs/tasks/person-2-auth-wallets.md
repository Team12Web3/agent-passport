# Person 2 - Auth & Agent Wallets

> **You own the Web3 plumbing.** Most of this is library glue, but signature mismatches will eat hours if you do not test the round-trip early.

## Mission

Set up Thirdweb authentication. Provision an EOA for every new agent, encrypt its private key at rest, fund it from a faucet wallet, and provide signing and verification utilities that everyone else uses for the trust protocol.

For the hackathon demo, the verifiable-intents path is allowed to use an ECDSA-simulated proof instead of a hand-written ZK circuit. The point is to demonstrate the trust flow cleanly:

- no passport -> blocked by CAPTCHA
- trusted passport -> green channel
- tampered action or forged proof -> rejected

For session keys and "bound AA wallet" semantics, the hackathon-safe version is an owner-signed delegated session grant. It simulates ERC-4337-style expiry, scope, and budget limits without requiring a full smart-account validator module.

## Files you own

```text
apps/web/
├── lib/
│   ├── thirdweb/
│   │   └── client.ts                -> you write
│   ├── agent/
│   │   ├── wallet.ts                -> you write (server-only)
│   │   ├── sign.ts                  -> you write (server-only)
│   │   ├── verify.ts                -> you write
│   │   └── nonces.ts                -> you write
│   └── crypto/
│       └── kms.ts                   -> you write (AES-256-GCM)
├── components/auth/
│   ├── Provider.tsx                 -> you write
│   └── LoginButton.tsx              -> you write
├── hooks/
│   └── useAuth.ts                   -> you write
└── components/agents/
    └── AgentWalletPanel.tsx         -> you write (drop into Person 4's agent detail page)

scripts/
└── fund.ts                          -> you write (admin tool to top up faucet wallet)
```

## What you depend on

- **Person 1's** `deployments.json` (you read `AgentPassport.address` and `ActionLog.address`)
- **Person 1's** `lib/chain/client.ts` (you reuse the public client and do not modify it)
- Faucet wallet pre-funded with enough AVAX and USDC on Fuji

## Acceptance criteria

### Auth

- [ ] Thirdweb Provider wraps the app with `chain: avalancheFuji`
- [ ] `<LoginButton />` renders Thirdweb's `ConnectButton` with email + wallet methods
- [ ] On first login, `users` row is upserted in Supabase
- [ ] `useAuth()` returns `{ user, address, isLoggedIn, isLoading }`
- [ ] Logging in works on Vercel preview deploy, not just localhost

### Agent wallet provisioning

- [ ] `createAgentWallet(userId)` generates a fresh EOA, encrypts its private key with `AGENT_KEY_SECRET`, and returns `{ address, encryptedKey }`
- [ ] Person 1 inserts the `agents` row; Person 2 does not hide persistence inside the wallet helper
- [ ] `getAgentSigner(agentId)` decrypts the key and returns a viem `WalletClient` on Fuji
- [ ] Encryption uses AES-256-GCM with a random IV per record
- [ ] `decrypt` fails loudly on tampered ciphertext

### Funding

- [ ] `fundAgentWallet(address)` sends 0.05 AVAX + 5 USDC from the faucet wallet
- [ ] `fundAgentWallet(address)` ensures the agent wallet approves `ActionLog` for max USDC allowance before log submission
- [ ] Funding waits for 1 confirmation per step and returns tx hashes
- [ ] Reports a clear error if the faucet wallet is out of funds or a deployment address is missing

### Trust protocol signing

- [ ] `signRequestHeaders(passportId, url, agentId, intent, ownerWallet, termsHash?, action?)` returns plain-string HTTP headers
- [ ] The trust bundle includes:
  - `X-Agent-Passport-ID`
  - `X-Agent-Signature`
  - `X-Agent-Timestamp`
  - `X-Agent-Session-Grant`
  - `X-Agent-Session-Proof`
  - `X-Agent-Claims`
  - `X-Agent-Claims-Signature`
  - `X-Agent-Intent-Hash`
  - `X-Agent-Action-Hash`
  - `X-Agent-Intent-Proof`
- [ ] `X-Agent-Signature` uses `signMessage` so signer recovery works with viem
- [ ] `X-Agent-Session-Grant` plus `X-Agent-Session-Proof` simulate an owner-authorized session key with `expiresAt`, `allowedOrigins`, `allowedActions`, and `maxAmountUsd`
- [ ] `X-Agent-Claims` plus `X-Agent-Claims-Signature` carry a signed JSON-LD claims packet with developer, model platform, labels, and trust score
- [ ] `X-Agent-Intent-Proof` may be simulated with ECDSA for the hackathon, but must bind `(passportId, timestamp, intentHash, actionHash)` to the same trusted signer
- [ ] Headers are JSON-serializable with no `bigint`, `Buffer`, or other non-header values

### Staking / slashing companion flow

- [ ] `lib/agent/staking.ts` exposes a small server-only helper for `StakeVault`
- [ ] `getPassportStakeSummary(passportId)` reports active stake, total slashed, and minimum required stake
- [ ] `slashPassportStake(...)` hashes website evidence and submits a slash tx when the companion contract is configured
- [ ] `/api/trust/report-abuse` accepts signed request evidence and returns `{ accepted, slashAmountEth? }`
- [ ] High-value verification can require active stake without breaking sites where `StakeVault` is not configured

### Trust protocol verification

- [ ] `verifyAgentHeaders({ headers, url, expectedIntent?, expectedAction?, requireStake? })` returns a typed success/failure union
- [ ] Verification order:
  1. required headers
  2. timestamp freshness
  3. request signature recovery
  4. on-chain passport lookup
  5. signer matches trusted agent or authorized session key
  6. passport is active
  7. stake is sufficient when `requireStake` is enabled and `StakeVault` is configured
  8. session proof is valid
  9. session scope is valid when delegated session headers are present
  10. claims packet and developer signature are valid when claims headers are present
  11. intent hash, action hash, and nonce are valid when provided
- [ ] Failure reasons are explicit and stable enough for Person 1 to use inside `/api/trust/demo-site`
- [ ] Round-trip tests cover:
  - valid success
  - stale timestamp
  - bad signature
  - invalid session proof
  - tampered action / invalid intent proof

### Dashboard panel

- [ ] `<AgentWalletPanel />` shows wallet address, AVAX balance, USDC balance, action count, Snowtrace link, and copy-to-clipboard
- [ ] Supports refresh every 10 seconds through props or a thin data boundary
- [ ] Drops cleanly into Person 4's agent detail page

### Visual trust demo

- [ ] `/trust-lab` shows the trust premium visually
- [ ] Demo states include:
  - no passport
  - all trust layers
  - no stake
  - slashed stake
  - expired session key
  - over-budget session
  - tampered action
  - forged intent proof
  - forged attestation
- [ ] The UI displays the trust headers, verification steps, and final allow/block outcome

## Hour-by-hour

| Hour | Task |
|------|------|
| 0-1 | Thirdweb account, project, client ID; create faucet wallet and fund it from the Fuji faucet |
| 1-2 | `lib/thirdweb/client.ts` + `Provider.tsx` + `LoginButton.tsx`; deploy to preview and test login |
| 2-3 | `useAuth()` hook + Supabase users upsert on login |
| 3-4 | `lib/crypto/kms.ts` AES-GCM encrypt/decrypt with round-trip test |
| 4-5 | `lib/agent/wallet.ts`: `createAgentWallet`, `getAgentSigner` |
| 5-6 | Funding flow: faucet transfers, allowance setup, and clear setup errors |
| 6-8 | `lib/agent/sign.ts`: trust bundle signing |
| 8-10 | `lib/agent/verify.ts`: verification + round-trip vitest |
| 10-14 | Hand off to Person 1; help integrate `/api/agents/create`, `/api/run`, and `/api/trust/demo-site` |
| 14-18 | Hand off panel to Person 4; help with balance refresh hook |
| 18-22 | Polish, edge cases, faucet balance, preview auth |
| 22-26 | Demo prep: top up faucet wallet, verify all demo agents are funded, rehearse `/trust-lab` |

## Vibe-coding prompts

### Hour 0-1: Faucet wallet

```text
Create scripts/fund.ts (a Node script using viem). It should:
 1. Read FAUCET_PRIVATE_KEY from env, derive the address.
 2. Print the address plus current AVAX balance plus USDC balance on Fuji.
 3. If a CLI arg --topup <address> --avax 0.05 --usdc 5 is passed,
    send a transfer of native AVAX, then a USDC ERC-20 transfer.
 4. Wait 1 confirmation each and print tx hashes.

USDC is configured from NEXT_PUBLIC_USDC_ADDRESS and uses 6 decimals.
Use viem with chain: avalancheFuji and http transport.
```

### Hour 1-2: Thirdweb provider

```text
Install thirdweb. Create lib/thirdweb/client.ts with createThirdwebClient()
using NEXT_PUBLIC_TW_CLIENT_ID and export avalancheFuji as the default chain.

Create components/auth/Provider.tsx as a client component that wraps children
with the Thirdweb provider.

Create components/auth/LoginButton.tsx using thirdweb/react ConnectButton.
Support email login and MetaMask.

Update apps/web/app/layout.tsx so the provider wraps the app without breaking
server components.
```

### Hour 2-3: useAuth hook + user upsert

```text
Create hooks/useAuth.ts that returns:
  { user, address, isLoggedIn, isLoading }

Create app/api/auth/sync/route.ts (POST):
  Verify the request comes from a logged-in Thirdweb user using the existing
  auth flow. Upsert into Supabase users table with the Thirdweb identity and
  wallet address. The route must be safe for repeated calls.

Update LoginButton so it calls /api/auth/sync after a successful connection.
Do not invent a new auth system.
```

### Hour 3-4: Encryption

```text
Create lib/crypto/kms.ts as a server-only AES-256-GCM helper.

Export:
  encrypt(plaintext: string): string
  decrypt(encoded: string): string

Rules:
  - import "server-only" at the top
  - use only Node's built-in crypto module
  - derive the key from process.env.AGENT_KEY_SECRET
  - use a random 12-byte IV
  - encode iv + authTag + ciphertext into one base64 string
  - throw on invalid ciphertext or auth-tag mismatch

Write a focused vitest proving round-trip success and tampered payload failure.
```

### Hour 4-5: Agent wallet creation

```text
Create lib/agent/wallet.ts as a server-only helper.

Requirements:
  - use generatePrivateKey and privateKeyToAccount from viem/accounts
  - createAgentWallet(userId: string) returns { address, encryptedKey }
  - do not insert the DB row inside createAgentWallet
  - getAgentSigner(agentId: string) fetches encrypted_private_key from Supabase,
    decrypts it, and returns a Fuji WalletClient
  - never log decrypted keys
  - throw explicit errors if the agent row is missing or malformed
```

### Hour 5-6: Funding + allowance

```text
Extend lib/agent/wallet.ts with fundAgentWallet(toAddress).

Requirements:
  1. Send 0.05 AVAX from the faucet wallet
  2. Send 5 USDC to the agent wallet
  3. Read ActionLog.address from packages/contracts/deployments.json
  4. Ensure the agent wallet approves ActionLog for max USDC allowance
  5. Wait for confirmations and return tx hashes plus helpful metadata

Use:
  - FAUCET_PRIVATE_KEY
  - NEXT_PUBLIC_FUJI_RPC
  - NEXT_PUBLIC_USDC_ADDRESS

If ActionLog.address is missing, throw a clear setup error.
```

### Hour 6-8: Trust signing

```text
Implement apps/web/lib/agent/sign.ts for the full trust-header bundle.

Export:
  signRequestHeaders(passportId, url, agentId, intent, ownerWallet, termsHash?, action?)

The result must contain plain-string headers:
  - X-Agent-Passport-ID
  - X-Agent-Signature
  - X-Agent-Timestamp
  - X-Agent-Session-Proof
  - X-Agent-Intent-Hash
  - X-Agent-Action-Hash
  - X-Agent-Intent-Proof

Rules:
  - use signMessage for recoverable signatures
  - timestamp is unix seconds
  - intentHash must be stable and JSON-safe
  - actionHash should default to GET|<url> if no explicit action is provided
  - intentProof may simulate proof-of-execution with ECDSA for the demo, but
    it must bind passportId + timestamp + intentHash + actionHash to the
    trusted signer
```

### Hour 8-10: Verification utility

```text
Implement apps/web/lib/agent/verify.ts so Person 1 can use it inside
/api/trust/demo-site.

Export:
  verifyAgentHeaders({ headers, url, expectedIntent?, expectedAction? })

Validation order:
  1. required headers present
  2. timestamp freshness
  3. recover signer from request signature
  4. read AgentPassport.getPassport(passportId) from chain
  5. confirm signer matches trusted agent wallet or authorized session key
  6. confirm passport is active
  7. validate session proof
  8. validate intent hash, action hash, intent proof, and nonce if present

Return a typed union with explicit failure reasons.
Leave a clean extension point for future EAS / ZK resolvers instead of faking them.
```

### Hour 10-11: Nonce helper

```text
Create a small replay-protection helper in apps/web/lib/agent/nonces.ts.

Expose:
  - issueAgentNonce(agentId)
  - markNonceUsed(agentId, nonce)
  - isNonceUsed(agentId, nonce)

Use Supabase only. If the agent_nonces table does not exist yet, include the
exact SQL migration Person 1 should run.
```

### Hour 11-12: Round-trip tests

```text
Write a focused test for the trust-header round trip.

Mock the on-chain contract read so the test does not depend on Fuji.
Cover:
  - valid sign -> verify success
  - stale timestamp failure
  - bad signature failure
  - invalid session proof failure
  - tampered action or forged intent proof failure

Keep it deterministic with fixed test keys and fixed time.
```

### Hour 12-13: Visual trust demo

```text
Build a small visual trust demo page at /trust-lab.

It should:
  - show the trust premium visually
  - render the generated headers
  - step through verification checks
  - include four scenarios:
      1. no passport
      2. with passport
      3. tampered action
      4. forged intent proof

For the hackathon, the proof-of-execution step can be simulated with ECDSA.
Focus on clarity, not cryptography theater.
```

### Hour 13-14: Dashboard panel

```text
Build AgentWalletPanel.tsx for Person 4.

Show:
  - wallet address
  - AVAX balance
  - USDC balance
  - action count
  - Snowtrace link
  - copy-to-clipboard action

Keep it self-contained, shadcn-compatible, and easy to refresh every 10 seconds.
No secrets or private-key logic in the component.
```

## Common pitfalls

- **Private key leakage.** Never log a decrypted key. Never include it in API responses. `lib/agent/wallet.ts` is server-only.
- **`signMessage` vs raw signing.** Use viem's `signMessage` and `recoverMessageAddress` consistently.
- **Address case sensitivity.** Lowercase both sides before comparing recovered and expected addresses.
- **`bigint` in JSON.** Convert passport IDs to strings in headers and restore with `BigInt(...)` on read.
- **Faucet wallet running dry on demo day.** Top it up at hour 0 and again during demo prep.
- **Preview auth drift.** Thirdweb auth can work locally and still fail in preview if the domain and secret config do not match.
- **Wallet helper ownership.** `createAgentWallet` returns data; Person 1 owns the DB insert in `/api/agents/create`.
- **Intent-proof claims.** Do not oversell the demo as full ZK if it is still using ECDSA simulation. Say "verifiable intents demo" or "ECDSA-simulated proof-of-execution."

## Done definition

You are done when Person 1 can call `createAgentWallet`, `fundAgentWallet`, `getAgentSigner`, `signRequestHeaders`, and `verifyAgentHeaders` from their routes without needing to understand your encryption or signing internals, and when the demo clearly shows:

- no passport -> blocked
- trusted passport -> allowed
- tampered action / forged proof -> rejected
