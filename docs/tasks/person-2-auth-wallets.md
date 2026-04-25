# Person 2 — Auth & Agent Wallets

> **You own the Web3 plumbing.** Most of this is library glue, but signature mismatches will eat hours if you don't test the round-trip early.

## Mission

Set up Thirdweb authentication. Provision an EOA for every new agent, encrypt its private key at rest, fund it from a faucet wallet, and provide signing/verification utilities that everyone else uses for the trust protocol.

## Files you own

```
apps/web/
├── lib/
│   ├── thirdweb/
│   │   └── client.ts                ← you write
│   ├── agent/
│   │   ├── wallet.ts                ← you write (server-only)
│   │   ├── sign.ts                  ← you write (server-only)
│   │   └── verify.ts                ← you write
│   └── crypto/
│       └── kms.ts                   ← you write (AES-256-GCM)
├── components/auth/
│   ├── Provider.tsx                 ← you write
│   └── LoginButton.tsx              ← you write
├── hooks/
│   └── useAuth.ts                   ← you write
└── components/agents/
    └── AgentWalletPanel.tsx         ← you write (drop into Person 4's agent detail page)

scripts/
└── fund.ts                          ← you write (admin tool to top up faucet wallet)
```

## What you depend on

- **Person 1's** `deployments.json` (you read `AgentPassport.address` to look up passports during verify)
- **Person 1's** `lib/chain/client.ts` (you reuse the public client)
- Faucet wallet pre-funded with ≥3 AVAX and ≥50 USDC on Fuji (you set this up at hour 0)

## Acceptance criteria

### Auth

- [ ] Thirdweb Provider wraps the app with `chain: avalancheFuji`
- [ ] `<LoginButton />` renders Thirdweb's `ConnectButton` with email + wallet methods
- [ ] On first login, `users` row is upserted in Supabase
- [ ] `useAuth()` hook returns `{ user, address, isLoggedIn, isLoading }`
- [ ] Logging in works on Vercel preview deploy (not just localhost)

### Agent wallet provisioning

- [ ] `createAgentWallet(userId)` generates a fresh EOA, encrypts private key with `AGENT_KEY_SECRET`, inserts into `agents` table, returns `{ address, encryptedKey }`
- [ ] `getAgentSigner(agentId)` decrypts the key and returns a viem `WalletClient` on Fuji
- [ ] Encryption uses AES-256-GCM with a random IV per record
- [ ] `decrypt` fails loudly (throws) on tampered ciphertext

### Funding

- [ ] `fundAgentWallet(address)` sends 0.05 AVAX + 5 USDC from faucet wallet, waits 1 confirmation, returns tx hash
- [ ] Handles "USDC not approved" by approving max once at startup
- [ ] Reports a clear error if faucet wallet is out of funds

### Trust protocol signing

- [ ] `signRequestHeaders(passportId, url, agentId)` returns the three headers — passport ID, signature, timestamp
- [ ] Signature is over `keccak256(passportId + "|" + url + "|" + timestamp)` using `personal_sign` style (so `ecrecover` works)
- [ ] Headers can be JSON-serialized (no `bigint` or `Buffer`)

### Trust protocol verification

- [ ] `verifyAgentHeaders({ headers, url })` returns `{ ok: true, passport }` or `{ ok: false, reason: "..." }`
- [ ] Reasons enum: `"missing_headers" | "stale_timestamp" | "bad_signature" | "untrusted_agent"`
- [ ] Reads `AgentPassport.getPassport(passportId)` from chain
- [ ] Round-trip test passes: sign → verify against a fresh fixture passport

### Dashboard panel

- [ ] `<AgentWalletPanel />` shows: wallet address, AVAX balance, USDC balance, action count, Snowtrace link, copy-to-clipboard
- [ ] Auto-refreshes balances every 10s
- [ ] Drops cleanly into Person 4's agent detail page

## Hour-by-hour

| Hour    | Task |
|---------|------|
| 0–1     | Thirdweb account, project, client ID; create faucet wallet, fund it from Fuji faucet |
| 1–2     | `lib/thirdweb/client.ts` + `Provider.tsx` + `LoginButton.tsx`; deploy to Vercel preview, test login |
| 2–3     | `useAuth()` hook + Supabase users upsert on login |
| 3–4     | `lib/crypto/kms.ts` AES-GCM encrypt/decrypt with round-trip test |
| 4–5     | `lib/agent/wallet.ts`: `createAgentWallet`, `getAgentSigner` |
| 5–6     | Funding flow: ERC-20 approve once, then `fundAgentWallet(address)` |
| 6–8     | `lib/agent/sign.ts`: `signRequestHeaders` |
| 8–10    | `lib/agent/verify.ts`: `verifyAgentHeaders` + round-trip vitest |
| 10–14   | Hand off to Person 1; help integrate; write `<AgentWalletPanel />` |
| 14–18   | Hand off panel to Person 4; help with balance fetching hook |
| 18–22   | Polish, edge cases (faucet running low, RPC slow) |
| 22–26   | Demo prep: top up faucet wallet, verify all 3 demo agents are funded |

## Vibe-coding prompts

### Hour 0–1: Faucet wallet

```
Create scripts/fund.ts (a Node script using viem). It should:
 1. Read FAUCET_PRIVATE_KEY from env, derive the address.
 2. Print the address + current AVAX balance + USDC balance on Fuji.
 3. If a CLI arg --topup <address> --avax 0.05 --usdc 5 is passed,
    send a transfer of native AVAX, then a USDC ERC-20 transfer.
 4. Wait 1 confirmation each, print tx hashes.

USDC is at 0x5425890298aed601595a70AB815c96711a31Bc65 (6 decimals).
Use viem with chain: avalancheFuji and http transport.
```

### Hour 1–2: Thirdweb provider

```
Install thirdweb. Create lib/thirdweb/client.ts:
  import { createThirdwebClient } from "thirdweb";
  export const tw = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_TW_CLIENT_ID!
  });
  export { avalancheFuji as fuji } from "thirdweb/chains";

Create components/auth/Provider.tsx:
  "use client";
  import { ThirdwebProvider } from "thirdweb/react";
  export function AuthProvider({ children }: { children: React.ReactNode }) {
    return <ThirdwebProvider>{children}</ThirdwebProvider>;
  }

Create components/auth/LoginButton.tsx:
  "use client";
  import { ConnectButton } from "thirdweb/react";
  import { tw, fuji } from "@/lib/thirdweb/client";
  import { inAppWallet, createWallet } from "thirdweb/wallets";
  export function LoginButton() {
    return (
      <ConnectButton
        client={tw}
        chain={fuji}
        wallets={[
          inAppWallet({ auth: { options: ["email", "google"] } }),
          createWallet("io.metamask"),
        ]}
        connectButton={{ label: "Continue with email" }}
      />
    );
  }

Add <AuthProvider> to apps/web/app/layout.tsx wrapping {children}.
```

### Hour 2–3: useAuth hook + user upsert

```
Create hooks/useAuth.ts:
  "use client";
  import { useActiveAccount, useActiveWallet } from "thirdweb/react";
  export function useAuth() {
    const account = useActiveAccount();
    const wallet  = useActiveWallet();
    return {
      address: account?.address,
      isLoggedIn: !!account,
      isLoading: !account && !!wallet,
    };
  }

Create app/api/auth/sync/route.ts (POST):
  Verify the request comes from a logged-in Thirdweb user (use Thirdweb's
  server SDK). Upsert into Supabase users table on (thirdweb_id) with
  { email, wallet_address }.

In the LoginButton, after a successful connect, call /api/auth/sync once
to record the user.
```

### Hour 3–4: Encryption

```
Create lib/crypto/kms.ts (server-only — top of file: import "server-only").

Use Node's built-in crypto module. Export:

  encrypt(plaintext: string): string
    - Generate random 12-byte IV.
    - Derive 32-byte key from process.env.AGENT_KEY_SECRET (already 32-byte hex).
    - aes-256-gcm encrypt; capture authTag.
    - Return base64(iv || authTag || ciphertext) — 12 + 16 + N bytes.

  decrypt(encoded: string): string
    - Base64 decode; split into iv (12), authTag (16), ciphertext (rest).
    - aes-256-gcm decrypt; return utf8 string.
    - Throws on tag mismatch.

Write a vitest: encrypt then decrypt round-trips a 64-char string.
```

### Hour 4–5: Agent wallet creation

```
Create lib/agent/wallet.ts (top: import "server-only").

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { encrypt, decrypt } from "../crypto/kms";
import { supabase } from "../db/supabase";

export async function createAgentWallet(userId: string) {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const encrypted = encrypt(pk);
  // caller (POST /api/agents/create) is responsible for inserting into agents table
  return { address: account.address, encryptedKey: encrypted };
}

export async function getAgentSigner(agentId: string) {
  const { data, error } = await supabase.from("agents")
    .select("encrypted_private_key")
    .eq("id", agentId).single();
  if (error || !data) throw new Error("agent not found");
  const pk = decrypt(data.encrypted_private_key);
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account, chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
  });
}
```

### Hour 5–6: Funding

```
Add to lib/agent/wallet.ts:

import { parseEther, parseUnits, erc20Abi } from "viem";

const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

export async function fundAgentWallet(toAddress: `0x${string}`) {
  const faucet = privateKeyToAccount(process.env.FAUCET_PRIVATE_KEY as `0x${string}`);
  const wallet = createWalletClient({
    account: faucet, chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
  });

  // 1. Send 0.05 AVAX
  const avaxTx = await wallet.sendTransaction({
    to: toAddress, value: parseEther("0.05")
  });

  // 2. Send 5 USDC (6 decimals)
  const usdcTx = await wallet.writeContract({
    address: USDC, abi: erc20Abi,
    functionName: "transfer",
    args: [toAddress, parseUnits("5", 6)],
  });

  // Wait 1 confirmation each via publicClient.waitForTransactionReceipt
  return { avaxTx, usdcTx };
}
```

### Hour 6–8: Signing utility

```
Create lib/agent/sign.ts (server-only).

import { keccak256, toBytes, toHex } from "viem";
import { getAgentSigner } from "./wallet";

export async function signRequestHeaders(
  passportId: bigint,
  url: string,
  agentId: string
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = passportId.toString() + "|" + url + "|" + timestamp;
  const wallet = await getAgentSigner(agentId);
  const signature = await wallet.signMessage({
    message,
    account: wallet.account!,
  });
  return {
    "X-Agent-Passport-ID": passportId.toString(),
    "X-Agent-Signature": signature,
    "X-Agent-Timestamp": String(timestamp),
  };
}
```

### Hour 8–10: Verification utility

```
Create lib/agent/verify.ts.

import { recoverMessageAddress } from "viem";
import { publicClient } from "../chain/client";
import deployments from "@/../packages/contracts/deployments.json";

export type VerifyResult =
  | { ok: true,  passport: { agentWallet: string, trustScore: number } }
  | { ok: false, reason: "missing_headers" | "stale_timestamp" | "bad_signature" | "untrusted_agent" };

export async function verifyAgentHeaders({
  headers, url
}: { headers: Headers, url: string }): Promise<VerifyResult> {
  const passportId = headers.get("X-Agent-Passport-ID");
  const signature  = headers.get("X-Agent-Signature");
  const tsRaw      = headers.get("X-Agent-Timestamp");
  if (!passportId || !signature || !tsRaw) return { ok: false, reason: "missing_headers" };

  const ts = Number(tsRaw);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 60) return { ok: false, reason: "stale_timestamp" };

  const message = `${passportId}|${url}|${ts}`;
  const recovered = await recoverMessageAddress({
    message, signature: signature as `0x${string}`
  });

  const passport = await publicClient.readContract({
    address: deployments.AgentPassport.address as `0x${string}`,
    abi: deployments.AgentPassport.abi,
    functionName: "getPassport",
    args: [BigInt(passportId)],
  }) as any;

  if (!passport.active) return { ok: false, reason: "untrusted_agent" };
  if (recovered.toLowerCase() !== passport.agentWallet.toLowerCase())
    return { ok: false, reason: "bad_signature" };

  return { ok: true, passport: {
    agentWallet: passport.agentWallet,
    trustScore: Number(passport.trustScore),
  }};
}
```

### Vitest round-trip

```
Create lib/agent/sign.verify.test.ts (vitest).

Test: generate a fresh private key, mock the contract read to return
{ agentWallet: account.address, active: true, trustScore: 80 }, sign headers
for url X, verify them. Assert ok === true and passport.trustScore === 80.

Then mutate the timestamp (-120s offset) and assert reason === "stale_timestamp".
Mutate the signature (flip one byte) and assert reason === "bad_signature".

Skip writing this test if you're behind schedule — it's nice-to-have, not critical.
```

## Common pitfalls

- **Private key leakage.** Never log a decrypted key. Never include in API responses. `lib/agent/wallet.ts` is server-only — guard with `import "server-only"`.
- **`personal_sign` vs raw sign.** Use viem's `signMessage` (which prefixes `\x19Ethereum Signed Message:\n<len>`) and `recoverMessageAddress` to match. Don't mix raw EIP-191 with raw signing.
- **Address case sensitivity.** Always `.toLowerCase()` both sides before comparing recovered vs stored addresses.
- **`bigint` in JSON.** When passing passport IDs in headers, use `.toString()`. When reading them back, use `BigInt(str)`.
- **Faucet wallet running dry on demo day.** Top it up at hour 0 AND at hour 22.
- **Thirdweb session in API routes.** Server components can read the session via cookies; API routes need to verify with Thirdweb's server SDK or rely on the Supabase user lookup.
- **Encryption key in production.** `AGENT_KEY_SECRET` must be the same value in Vercel as in localhost. Otherwise decrypts will silently fail in production.

## Done definition

You're done when Person 1 can call `createAgentWallet`, `fundAgentWallet`, and `getAgentSigner` from inside `/api/agents/create` without having to know the encryption details — and when `/api/trust/demo-site` correctly accepts/rejects requests using `verifyAgentHeaders` against a real on-chain passport.
