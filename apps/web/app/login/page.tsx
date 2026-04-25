"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConnectEmbed, useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getThirdwebClient } from "@/lib/thirdwebClient";

const wallets = [inAppWallet(), createWallet("io.metamask")];

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
            wallets={wallets}
            chains={[avalancheFuji]}
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
