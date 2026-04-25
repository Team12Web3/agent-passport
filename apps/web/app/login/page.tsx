"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConnectEmbed, useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { supportedWallets } from "@/lib/thirdweb/wallets";

const auth = {
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
};

export default function LoginPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const walletStatus = useActiveWalletConnectionStatus();
  const client = getThirdwebClient();

  useEffect(() => {
    if (walletStatus === "connected" && account?.address) router.replace("/dashboard");
  }, [account?.address, router, walletStatus]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Agent Passport</h1>
          <p className="mt-2 text-sm text-zinc-400">Connect with email or MetaMask to open your dashboard.</p>
        </div>

        {!client ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Set <span className="font-mono">NEXT_PUBLIC_TW_CLIENT_ID</span> (or{" "}
            <span className="font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</span>) in{" "}
            <span className="font-mono">.env.local</span> from your thirdweb dashboard, then restart{" "}
            <span className="font-mono">pnpm dev</span>.
          </div>
        ) : (
          <ConnectEmbed
            client={client}
            wallets={supportedWallets}
            chains={[avalancheFuji]}
            auth={auth}
            appMetadata={{
              name: "Agent Passport",
              url: typeof window !== "undefined" ? window.location.origin : "",
              description: "Hackathon MVP — agent passports on Avalanche Fuji"
            }}
          />
        )}
      </div>
    </main>
  );
}
