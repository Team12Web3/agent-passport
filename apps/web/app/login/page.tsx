"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConnectEmbed } from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { supportedWallets } from "@/lib/thirdweb/wallets";

export default function LoginPage() {
  const router = useRouter();
  const client = getThirdwebClient();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function redirectIfAuthenticated() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { loggedIn?: boolean };
          if (!cancelled && data.loggedIn) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch {
        // Show the login form if the status check cannot complete.
      }

      if (!cancelled) {
        setIsCheckingSession(false);
      }
    }

    redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const auth = useMemo(
    () => ({
      getLoginPayload: async ({ address }: { address: string }) => {
        const res = await fetch(`/api/auth/payload?address=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error("Failed to generate login payload");
        return res.json();
      },
      doLogin: async (params: unknown) => {
        setIsLoggingIn(true);

        try {
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
        } catch (error) {
          setIsLoggingIn(false);
          throw error;
        }
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
          ) : isCheckingSession || isLoggingIn ? (
            <div className="card flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent)]" />
              <p className="mt-5 text-[14px] font-medium text-fg">
                {isLoggingIn ? "Signing you in..." : "Checking your session..."}
              </p>
              <p className="mt-2 max-w-xs text-[12.5px] leading-5 text-muted">
                {isLoggingIn
                  ? "We are syncing your wallet profile before opening the dashboard."
                  : "We are checking whether you already have an active session."}
              </p>
            </div>
          ) : (
            <div className="card p-1.5">
              <ConnectEmbed
                client={client}
                wallets={supportedWallets}
                chains={[avalancheFuji]}
                autoConnect={false}
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
