"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ConnectEmbed, useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { supportedWallets } from "@/lib/thirdweb/wallets";

export default function LoginPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const walletStatus = useActiveWalletConnectionStatus();
  const client = getThirdwebClient();

  // Gate the auto-redirect on backend session status, not just wallet status.
  // AutoConnect can restore the wallet from localStorage without a JWT cookie;
  // redirecting on wallet-connected alone sends users to /dashboard with no
  // session, which then 401s on every authenticated API call.
  useEffect(() => {
    if (walletStatus !== "connected" || !account?.address) return;
    let cancelled = false;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { loggedIn: false }))
      .then((d: { loggedIn?: boolean }) => {
        if (!cancelled && d.loggedIn) router.replace("/dashboard");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account?.address, router, walletStatus]);

  const auth = useMemo(
    () => ({
      getLoginPayload: async ({ address }: { address: string }) => {
        const res = await fetch(`/api/auth/payload?address=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error("Failed to generate login payload");
        return res.json();
      },
      doLogin: async (params: unknown) => {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!loginRes.ok) throw new Error("Failed to login");

        const syncRes = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: null }),
        });
        if (!syncRes.ok) throw new Error("Failed to sync user profile");

        router.replace("/dashboard");
      },
      isLoggedIn: async () => {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return false;
        const data = (await res.json()) as { loggedIn?: boolean };
        return !!data.loggedIn;
      },
      doLogout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
      },
    }),
    [router],
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 210deg, #34d399, #38bdf8, #a78bfa, #34d399)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
            }}
            aria-hidden
          />
          <span className="text-[14px] font-medium tracking-tight text-fg">Agent Passport</span>
        </div>

        <Link href="/" className="btn btn-ghost focus-ring mb-6 w-fit px-0 hover:bg-transparent">
          Back to home
        </Link>

        <div>
          <div className="eyebrow">Sign in</div>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">Connect your wallet</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Use email or MetaMask. We&apos;ll bind every agent you create to this wallet on Avalanche Fuji.
          </p>
        </div>

        <div className="mt-8">
          {!client ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-[13px] text-amber-100">
              Set <span className="font-mono">NEXT_PUBLIC_TW_CLIENT_ID</span> (or{" "}
              <span className="font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</span>) in{" "}
              <span className="font-mono">.env.local</span> from your thirdweb dashboard, then restart{" "}
              <span className="font-mono">pnpm dev</span>.
            </div>
          ) : (
            <div className="card p-1.5">
              <ConnectEmbed
                client={client}
                wallets={supportedWallets}
                chains={[avalancheFuji]}
                auth={auth}
                appMetadata={{
                  name: "Agent Passport",
                  url: typeof window !== "undefined" ? window.location.origin : "",
                  description: "Hackathon MVP — agent passports on Avalanche Fuji",
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-8 text-[11.5px] text-faint">
          By connecting you agree to use Avalanche Fuji testnet only. No real funds are at risk.
        </div>
      </div>
    </main>
  );
}
