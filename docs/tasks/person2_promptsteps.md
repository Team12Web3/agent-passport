# Person 2 Prompt Steps

This file captures the concrete prompts needed to reproduce the completed Person 2 scope in this repo.

Assume Person 1 already provides:

- `packages/contracts/deployments.json`
- `apps/web/lib/chain/client.ts`
- `packages/contracts/src/AgentPassport.sol`

## 1. Thirdweb client and provider

```text
CONTEXT:
- Project: Agent Passport
- Workspace:
  - apps/web/lib/thirdweb/
  - apps/web/components/auth/
  - apps/web/app/layout.tsx

TASK:
Implement Person 2's Thirdweb client wiring:
1. Create `apps/web/lib/thirdweb/client.ts`
2. Create `apps/web/components/auth/Provider.tsx`
3. Create `apps/web/components/auth/LoginButton.tsx`
4. Update `apps/web/app/layout.tsx` to wrap the app with the auth provider

CONSTRAINTS:
- Use `thirdweb/react`, `thirdweb/wallets`, and Avalanche Fuji.
- Use `NEXT_PUBLIC_TW_CLIENT_ID`.
- The login button should support email and MetaMask.
- Keep UI minimal and compatible with the existing app shell.

ACCEPTANCE:
- Provider is client-side.
- Login button renders a Thirdweb ConnectButton.
- Fuji is the default chain.
- Layout wraps children with the provider without breaking server components.
```

## 2. Thirdweb server auth routes

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/05-environment-setup.md
- Relevant folders:
  - apps/web/lib/thirdweb/
  - apps/web/app/api/auth/
  - apps/web/lib/auth/

TASK:
Implement real Thirdweb server-side auth using JWT cookies:
1. Create `apps/web/lib/thirdweb/auth.ts`
2. Create:
   - `apps/web/app/api/auth/payload/route.ts`
   - `apps/web/app/api/auth/login/route.ts`
   - `apps/web/app/api/auth/logout/route.ts`
   - `apps/web/app/api/auth/status/route.ts`
3. Update `apps/web/lib/auth/session.ts` to verify the current Thirdweb JWT cookie
4. Update `LoginButton.tsx` to use the auth routes through Thirdweb ConnectButton auth hooks

CONSTRAINTS:
- Use `THIRDWEB_SECRET_KEY`, `AUTH_PRIVATE_KEY`, and `NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN`.
- Store auth in an HttpOnly cookie.
- Keep the implementation server-only where appropriate.
- Do not invent a parallel auth system.

ACCEPTANCE:
- A signed login payload can be generated and verified server-side.
- The login route issues a JWT cookie.
- The status route reports whether the user is logged in.
- `getSessionUser()` can read the current authenticated user from the cookie.
```

## 3. Auth state and first-login sync

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/03-api-contracts.md
- Relevant folders:
  - apps/web/hooks/
  - apps/web/app/api/
  - apps/web/components/auth/

TASK:
Implement Person 2's authentication state and first-login sync:
1. Create `apps/web/hooks/useAuth.ts`
2. Create `apps/web/app/api/auth/sync/route.ts`
3. Update `LoginButton.tsx` so it calls `/api/auth/sync` after a successful connection

CONSTRAINTS:
- `useAuth()` must return `{ user, address, isLoggedIn, isLoading }`.
- The sync route should upsert the `users` table using the logged-in Thirdweb identity and wallet address.
- Use the existing Supabase setup in the repo if present.
- No secrets are exposed to the browser.

ACCEPTANCE:
- The hook exposes a clean auth shape for the rest of the app.
- The sync route is safe for repeated calls.
- The code matches the `users` table described in the docs.
```

## 4. KMS helper for encrypted agent private keys

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/05-environment-setup.md
- File to create:
  - apps/web/lib/crypto/kms.ts

TASK:
Create `apps/web/lib/crypto/kms.ts` as a server-only AES-256-GCM helper for encrypting and decrypting agent private keys.

CONSTRAINTS:
- Add `import "server-only"` at the top.
- Use Node's built-in `crypto` module only.
- Read the key from `process.env.AGENT_KEY_SECRET`.
- `encrypt(plaintext: string): string`
- `decrypt(encoded: string): string`
- Use a random 12-byte IV for every encryption.
- Store `iv + authTag + ciphertext` in a single base64 string.
- Throw loudly on invalid ciphertext or tag mismatch.

ACCEPTANCE:
- The file is typed and self-contained.
- Output is safe to store in Supabase as text.
- Decrypting a tampered payload throws.
```

## 5. KMS round-trip test

```text
CONTEXT:
- Existing file:
  - apps/web/lib/crypto/kms.ts

TASK:
Add a small vitest for the KMS helper that proves encrypt/decrypt round-trips and tampering fails.

CONSTRAINTS:
- Keep the test focused on:
  1. round-trip success
  2. tampered ciphertext failure
- Use a deterministic env stub for `AGENT_KEY_SECRET`.

ACCEPTANCE:
- The test does not require network access.
- The test is small, deterministic, and passes locally.
```

## 6. Server-only agent wallet utilities

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/01-architecture.md
- Assume existing:
  - apps/web/lib/db/supabase.ts
  - apps/web/lib/chain/client.ts

TASK:
Implement `apps/web/lib/agent/wallet.ts`:
1. `createAgentWallet(userId: string)`
2. `getAgentSigner(agentId: string)`
3. `getSignerFromEncryptedKey(encryptedKey: string)`

CONSTRAINTS:
- Add `import "server-only"` at the top.
- Use `generatePrivateKey` and `privateKeyToAccount` from `viem/accounts`.
- Encrypt private keys with `lib/crypto/kms.ts`.
- `createAgentWallet` should return `{ address, encryptedKey }` and not insert the DB row itself.
- `getAgentSigner` should fetch `encrypted_private_key` from the `agents` table, decrypt it, and return a Fuji `WalletClient`.
- Never log decrypted keys.

ACCEPTANCE:
- Functions are typed.
- The wallet client is ready for signing and sending transactions.
- Errors are explicit when the agent row is missing or malformed.
```

## 7. Faucet script for manual top-ups

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/05-environment-setup.md
- File to create:
  - scripts/fund.ts

TASK:
Create `scripts/fund.ts` as a Node script using `viem` for Person 2's faucet wallet tasks.

CONSTRAINTS:
- Read `FAUCET_PRIVATE_KEY`, `NEXT_PUBLIC_FUJI_RPC`, and `NEXT_PUBLIC_USDC_ADDRESS` from env.
- When run without arguments, print faucet address, AVAX balance, and USDC balance.
- Support:
  `pnpm tsx scripts/fund.ts --topup <address> --avax 0.05 --usdc 5`
- In top-up mode:
  1. send native AVAX
  2. send Fuji test USDC
  3. wait for 1 confirmation each
  4. print tx hashes

ACCEPTANCE:
- The script is simple enough for demo prep.
- Address and balance output are readable.
- It uses Fuji and 6-decimal USDC correctly.
```

## 8. Funding flow plus ActionLog approval

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/03-api-contracts.md
  - docs/04-onchain-contracts.md
- Assume existing:
  - packages/contracts/deployments.json
  - apps/web/lib/chain/client.ts
  - apps/web/lib/agent/wallet.ts

TASK:
Extend `apps/web/lib/agent/wallet.ts` with `fundAgentWallet(toAddress)` so it:
1. sends 0.05 AVAX from the faucet wallet
2. sends 5 USDC to the agent wallet
3. ensures the agent wallet approves `ActionLog` for max USDC allowance
4. waits for confirmations and returns tx hashes

CONSTRAINTS:
- Use `FAUCET_PRIVATE_KEY`, `NEXT_PUBLIC_FUJI_RPC`, and `NEXT_PUBLIC_USDC_ADDRESS`.
- Read `ActionLog.address` from `packages/contracts/deployments.json`.
- If the contract address is missing, throw a clear setup error.
- Keep approval logic explicit so Person 1 can rely on it before `ActionLog.logAction()`.

ACCEPTANCE:
- The flow covers AVAX funding for gas.
- Errors are clear when the faucet wallet lacks funds.
- The code stays server-only.
```

## 9. Full trust-header signing helper

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/01-architecture.md
  - docs/03-api-contracts.md
- File to create or update:
  - apps/web/lib/agent/sign.ts

TASK:
Implement `apps/web/lib/agent/sign.ts` for the full trust-header bundle:
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

CONSTRAINTS:
- Add `import "server-only"` at the top.
- Export:
  `signRequestHeaders(passportId, url, agentId, intent, ownerWallet, termsHash?, action?, advanced?)`
- Timestamp must be unix seconds.
- Signature must use viem `signMessage`.
- `intentHash` should be stable and JSON-safe.
- `actionHash` should be stable and JSON-safe.
- `sessionProof` should support an owner-signed delegated session grant so the demo can show ERC-4337-style session-key semantics.
- The helper should support an optional signed JSON-LD claims packet for developer, model platform, labels, and trust score.
- `intentProof` may be simulated with ECDSA for the hackathon demo; do not hand-write ZK circuits.
- Return only plain strings so the result can be serialized into HTTP headers.
- Keep a compatibility path for existing runtime code that still signs from an encrypted key.

ACCEPTANCE:
- The returned object contains the full trust-header bundle, including session grant and claims headers when provided.
- The message format matches the verification path.
- No `bigint`, `Buffer`, or unserializable values leak into headers.
```

## 10. Nonce helper for replay protection

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/03-api-contracts.md
- Relevant areas:
  - apps/web/lib/agent/
  - apps/web/lib/db/

TASK:
Add a minimal nonce helper for replay protection.

CONSTRAINTS:
- Expose:
  - `issueAgentNonce(agentId)`
  - `markNonceUsed(agentId, nonce)`
  - `isNonceUsed(agentId, nonce)`
- Keep the storage design simple and compatible with Supabase.
- If the `agent_nonces` table does not exist yet, include the exact SQL migration.

ACCEPTANCE:
- Replay protection is easy to call from sign and verify flows.
- The helper does not introduce a new persistence stack.
```

## 11. Trust-header verification helper

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/01-architecture.md
  - docs/03-api-contracts.md
  - docs/04-onchain-contracts.md
- Assume existing:
  - apps/web/lib/chain/client.ts
  - packages/contracts/deployments.json
  - packages/contracts/src/AgentPassport.sol
- File to create or update:
  - apps/web/lib/agent/verify.ts

TASK:
Implement `verifyAgentHeaders({ headers, url, expectedIntent?, expectedAction?, expectedAmountUsd?, requireStake? })` so Person 1 can use it inside `/api/trust/demo-site`.

CONSTRAINTS:
- Validate in this order:
  1. required headers present
  2. timestamp freshness
  3. recover signer from the message signature
  4. read `AgentPassport.getPassport(passportId)`
  5. confirm recovered signer matches the expected agent wallet or authorized session key
  6. confirm passport is active
  7. validate active stake when `requireStake` is enabled and `StakeVault` is configured
  8. validate delegated session grant or legacy session proof
  9. validate session scope (time, origin, action, amount) when present
  10. validate signed claims / attestation packet when present
  11. validate intent hash, action hash, and intent proof
  12. validate nonce if provided
- Return a typed union:
  - `{ ok: true, passport, attributes }`
  - `{ ok: false, reason }`
- Leave a clean extension point for EAS/metadata attribute resolution.

ACCEPTANCE:
- The verifier is reusable from API routes.
- It reads the on-chain passport via Person 1's provided files.
- It supports the expanded trust-header protocol, including the hackathon-safe ECDSA intent-proof flow.
```

## 12. Trust-header round-trip tests

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/03-api-contracts.md
- Existing files:
  - apps/web/lib/agent/sign.ts
  - apps/web/lib/agent/verify.ts

TASK:
Write focused tests for the trust-header round trip.

CONSTRAINTS:
- Mock the contract read so the test does not depend on Fuji.
- Cover:
  1. valid sign -> verify success
  2. stale timestamp failure
  3. bad signature failure
  4. invalid session proof failure
  5. tampered action hash or forged intent proof failure
- Keep the test small and deterministic.

ACCEPTANCE:
- The test proves the message format and verification logic agree.
- The failure reasons are explicit and typed.
```

## 13. Visual trust-lab demo

```text
CONTEXT:
- Read:
  - docs/06-integration-plan.md
  - docs/07-demo-script.md
- Existing protocol helpers:
  - apps/web/lib/agent/protocol.ts
  - apps/web/lib/agent/sign.ts
  - apps/web/lib/agent/verify.ts
  - apps/web/lib/agent/staking.ts

TASK:
Create a visual demo page, for example `apps/web/app/trust-lab/page.tsx`, that demonstrates the trust premium across:
- Staking Mechanism
- Session Keys
- Open Box Attestation
- Bound AA Wallet semantics
- Verifiable Intents

CONSTRAINTS:
- The page should visually show scenarios for the new protocol layers:
  1. No Passport
  2. All trust layers valid
  3. No active stake
  4. Slashed stake
  5. Expired session key
  6. Over-budget delegated session
  7. Tampered action hash
  8. Forged intent proof
  9. Forged attestation
- Show:
  - generated headers
  - step-by-step verification status
  - final blocked / trusted outcome
- Emphasize:
  - without Passport -> blocked by CAPTCHA
  - with Passport + active stake + signed claims + delegated session key + intent proof -> trusted instantly
- Do not build custom ZK circuits. Use the ECDSA-simulated proof flow for the demo.

ACCEPTANCE:
- The page is easy to demo live.
- Judges can see the difference between identity trust and action trust.
- The narrative lands "trust by signature, not by CAPTCHA."
```

## 14. Wallet and payment tests

```text
CONTEXT:
- Existing helpers:
  - apps/web/lib/agent/wallet.ts
  - apps/web/app/api/log/submit/route.ts

TASK:
Add focused tests for Person 2's wallet and auto-payment path.

CONSTRAINTS:
- Mock Supabase, viem wallet clients, and public client reads.
- Cover:
  1. `createAgentWallet()` returns an address plus encrypted key
  2. `getAgentSigner()` loads the encrypted key and returns a wallet client
  3. `fundAgentWallet()` sends AVAX, sends USDC, and approves ActionLog
  4. `fundAgentWallet()` throws when faucet AVAX is insufficient
  5. `POST /api/log/submit` auto-approves then calls `ActionLog.logAction()`
- Keep the tests local and deterministic.

ACCEPTANCE:
- The wallet and payment path can be verified without Fuji.
- The tests prove the current "pre-authorized payment" layer works for ActionLog fee deduction.
```

## 15. Agent wallet dashboard panel

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/01-architecture.md
- File to create:
  - apps/web/components/agents/AgentWalletPanel.tsx

TASK:
Build `AgentWalletPanel.tsx` for Person 4 to drop into the agent detail page.

CONSTRAINTS:
- Show:
  - wallet address
  - AVAX balance
  - USDC balance
  - action count
  - Snowtrace link
  - copy-to-clipboard action
- Keep styling consistent with the current app shell and Tailwind usage.
- Accept props and an `onRefresh` boundary that Person 4 can integrate cleanly.
- Support optional auto-refresh every 10 seconds.

ACCEPTANCE:
- The panel is self-contained and easy to import.
- No secrets or private-key logic are in the component.
```

## 16. Final integration cleanup for Person 1

```text
CONTEXT:
- Read:
  - docs/tasks/person-2-auth-wallets.md
  - docs/06-integration-plan.md
  - docs/07-demo-script.md
- Existing Person 2 files are already implemented.

TASK:
Review all Person 2 files and prepare them for Person 1 integration.

CONSTRAINTS:
- Do not add new features.
- Improve only:
  - naming clarity
  - exported function signatures
  - comments where a caller would otherwise misuse the function
  - setup errors for missing env vars
- Summarize for Person 1 exactly how to call:
  - `createAgentWallet`
  - `fundAgentWallet`
  - `getAgentSigner`
  - `signRequestHeaders`
  - `verifyAgentHeaders`

ACCEPTANCE:
- Person 1 can wire `/api/agents/create`, `/api/run`, and `/api/trust/demo-site` without reading all implementation details.
```

## 17. Final QA command set

Use these commands after completing the prompts above:

```powershell
corepack pnpm --filter web exec vitest run lib/crypto/kms.test.ts
corepack pnpm --filter web exec vitest run lib/agent/sign.verify.test.ts
corepack pnpm --filter web exec vitest run lib/agent/wallet.test.ts
corepack pnpm --filter web exec vitest run app/api/log/submit/route.test.ts
apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json
```

If you want one combined test run:

```powershell
corepack pnpm --filter web exec vitest run lib/crypto/kms.test.ts lib/agent/sign.verify.test.ts lib/agent/wallet.test.ts app/api/log/submit/route.test.ts
```
