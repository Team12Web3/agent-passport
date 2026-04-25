# Reference — Thirdweb Cheatsheet

Just the snippets you need for this project. Skip everything else in their docs.

## Install

```bash
pnpm add thirdweb
```

## Client

```ts
// lib/thirdweb/client.ts
import { createThirdwebClient } from "thirdweb";

export const tw = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_TW_CLIENT_ID!,
});

export { avalancheFuji as fuji } from "thirdweb/chains";
```

## Provider (wraps the app)

```tsx
// components/auth/Provider.tsx
"use client";
import { ThirdwebProvider } from "thirdweb/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
```

```tsx
// app/layout.tsx
import { AuthProvider } from "@/components/auth/Provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## Login button (email + wallet)

```tsx
// components/auth/LoginButton.tsx
"use client";
import { ConnectButton } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { tw, fuji } from "@/lib/thirdweb/client";

export function LoginButton() {
  return (
    <ConnectButton
      client={tw}
      chain={fuji}
      wallets={[
        inAppWallet({ auth: { options: ["email", "google"] } }),
        createWallet("io.metamask"),
      ]}
      connectButton={{
        label: "Continue with email",
        className: "bg-black text-white px-6 py-3 rounded-lg font-medium",
      }}
    />
  );
}
```

## Reading the active user (client-side)

```ts
// hooks/useAuth.ts
"use client";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";

export function useAuth() {
  const account = useActiveAccount();
  const wallet  = useActiveWallet();
  return {
    address: account?.address as `0x${string}` | undefined,
    isLoggedIn: !!account,
    isLoading: !account && !!wallet,
    account,
  };
}
```

## Syncing user to Supabase on login

```ts
// app/api/auth/sync/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function POST(req: NextRequest) {
  const { address, email } = await req.json();
  if (!address) return Response.json({ error: "no_address" }, { status: 400 });

  const { data, error } = await supabase
    .from("users")
    .upsert(
      { thirdweb_id: address, wallet_address: address, email: email ?? null },
      { onConflict: "thirdweb_id" }
    )
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ user: data });
}
```

Call this from the client right after the Connect succeeds:

```tsx
import { useActiveAccount } from "thirdweb/react";
import { useEffect } from "react";

export function SyncUser() {
  const account = useActiveAccount();
  useEffect(() => {
    if (!account?.address) return;
    fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: account.address }),
    });
  }, [account?.address]);
  return null;
}
```

Drop `<SyncUser />` somewhere inside `<AuthProvider>`.

## Server-side auth check (for API routes)

The simplest approach for the hackathon: **trust the wallet address sent by the client**, and verify the user owns the agent they're operating on via DB lookup.

```ts
// In an API route
const { address } = await req.json();
const { data: user } = await supabase
  .from("users")
  .select("id")
  .eq("wallet_address", address)
  .single();
if (!user) return Response.json({ error: "not_found" }, { status: 401 });

// Then for any agent operation:
const { data: agent } = await supabase
  .from("agents")
  .select("*")
  .eq("id", agentId)
  .eq("user_id", user.id)
  .single();
if (!agent) return Response.json({ error: "forbidden" }, { status: 403 });
```

This isn't bulletproof (a sophisticated attacker could spoof the address), but **it's a hackathon and we're on testnet**. Worth maybe 30 mins to add proper SIWE later if there's time. Otherwise: ship.

## Common issues

**"Module not found: thirdweb"** — make sure you ran `pnpm add thirdweb` in `apps/web`, not the root.

**`useActiveAccount` returns undefined on first render** — that's expected. It hydrates async. Use `isLoading` to gate UI.

**Email OTP not arriving** — check spam, check the email address typed correctly. For demos, use a personal email you can refresh in real-time.

**ConnectButton looks ugly** — pass `theme={lightTheme()}` or `darkTheme()` and override classes via `connectButton.className`.

**Address case mismatch** — Thirdweb returns checksummed addresses; Supabase may store lowercase. Always `.toLowerCase()` before comparing.
