"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { avalancheFuji } from "thirdweb/chains";
import { useActiveAccount, useWalletBalance } from "thirdweb/react";

import { getThirdwebClient } from "@/lib/thirdwebClient";

const MIN_AVAX = 0.1;
const FAUCET_URL = "https://core.app/tools/testnet-faucet/?subnet=c&token=c";

export function StepBalance({ onNext }: { onNext: () => void }) {
  const account = useActiveAccount();
  const client = getThirdwebClient();
  const balanceQuery = useWalletBalance({
    client: client!,
    address: account?.address,
    chain: avalancheFuji,
  });

  const balanceFloat = useMemo(() => {
    if (!balanceQuery.data) return null;
    const v = parseFloat(balanceQuery.data.displayValue);
    return Number.isFinite(v) ? v : null;
  }, [balanceQuery.data]);

  const isFunded = balanceFloat !== null && balanceFloat >= MIN_AVAX;

  // Auto-advance once funded.
  useEffect(() => {
    if (isFunded) {
      const t = setTimeout(onNext, 600); // small breath so the user sees the tick
      return () => clearTimeout(t);
    }
  }, [isFunded, onNext]);

  // Poll while underfunded.
  useEffect(() => {
    if (isFunded || !account?.address) return;
    const id = setInterval(() => {
      balanceQuery.refetch();
    }, 5000);
    return () => clearInterval(id);
  }, [isFunded, account?.address, balanceQuery]);

  const [copied, setCopied] = useState(false);
  function copy() {
    if (!account?.address) return;
    navigator.clipboard.writeText(account.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  if (!account?.address) {
    return <div className="p-6 text-[13px] text-muted">Reconnect your wallet to continue.</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-[18px] font-semibold tracking-tight">
        {isFunded ? "Wallet funded" : "Fund your wallet"}
      </h2>
      <p className="mt-1 text-[12.5px] text-muted">
        {isFunded
          ? "You have enough Fuji AVAX to mint. Continuing in a moment…"
          : `You need at least ${MIN_AVAX} AVAX on Fuji to mint your first agent.`}
      </p>

      {!isFunded && (
        <>
          <div className="mt-5 flex items-center justify-center rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <QRCodeSVG
              value={account.address}
              size={140}
              bgColor="transparent"
              fgColor="#e5e7eb"
              level="M"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3 py-2">
            <span className="truncate font-mono text-[11.5px] text-muted">{account.address}</span>
            <button onClick={copy} className="ml-auto btn btn-secondary text-[11px] py-1 px-2">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[12px]">
            <span className="text-faint">
              Balance:{" "}
              <span className="font-mono text-muted">
                {balanceQuery.data
                  ? `${balanceQuery.data.displayValue} ${balanceQuery.data.symbol}`
                  : "—"}
              </span>
            </span>
            <button
              onClick={() => balanceQuery.refetch()}
              className="btn btn-secondary text-[11px] py-1 px-2"
            >
              Check now
            </button>
          </div>

          <p className="mt-4 text-[11.5px] text-faint">
            Need test AVAX?{" "}
            <a
              className="underline decoration-dotted underline-offset-2 hover:text-muted"
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
            >
              Avalanche Fuji faucet
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
