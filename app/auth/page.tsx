"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConnectEmbed, useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getThirdwebClient } from "@/lib/thirdwebClient";

const wallets = [inAppWallet(), createWallet("io.metamask")];

export default function AuthPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const walletStatus = useActiveWalletConnectionStatus();
  const client = getThirdwebClient();

  useEffect(() => {
    if (walletStatus === "connected" && account?.address) router.replace("/dashboard");
  }, [account?.address, router, walletStatus]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-md"
            style={{
              background:
                "conic-gradient(from 210deg, #34d399, #38bdf8, #a78bfa, #34d399)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)"
            }}
            aria-hidden
          />
          <span className="text-[14px] font-medium tracking-tight text-fg">Agent Passport</span>
        </div>

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
              Set <span className="font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</span> in{" "}
              <span className="font-mono">.env.local</span> (from your thirdweb dashboard), then restart{" "}
              <span className="font-mono">npm run dev</span>.
            </div>
          ) : (
            <div className="card p-1.5">
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
