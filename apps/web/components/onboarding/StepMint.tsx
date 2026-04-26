"use client";

import { useState } from "react";

import { useMintPassport } from "@/hooks/useMintPassport";
import { getThirdwebClient } from "@/lib/thirdwebClient";

export function StepMint({
  username,
  onComplete,
}: {
  username: string;
  onComplete: () => void;
}) {
  const client = getThirdwebClient();
  const defaultLabel = `${username}-agent-1`;
  const [label, setLabel] = useState(defaultLabel);
  const [persistError, setPersistError] = useState<string | null>(null);

  const mintHook = useMintPassport(client!);
  const { phase, message } = mintHook.state;

  const isWorking =
    phase === "generating" || phase === "deploying" || phase === "minting" || phase === "confirming";

  const phaseLabel: Record<typeof phase, string> = {
    idle: "Mint passport",
    generating: "Generating keypair…",
    deploying: "Deploying contract…",
    minting: "Minting passport…",
    confirming: "Awaiting confirmation…",
    done: "Saving…",
    error: "Mint passport",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPersistError(null);
    try {
      await mintHook.mint(label.trim() || defaultLabel);
      const r = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "complete_failed");
      }
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not finish onboarding. Please try again.";
      setPersistError(msg);
    }
  }

  return (
    <form className="p-6" onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-semibold tracking-tight">Create your first agent</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Generates a fresh agent EOA in your browser, then mints a passport on Avalanche Fuji.
      </p>

      <label htmlFor="label" className="mt-5 block text-[12px] text-subtle">
        Agent name
      </label>
      <input
        id="label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="input focus-ring mt-1.5"
        disabled={isWorking}
      />

      <div className="mt-2 h-4 text-[11.5px] text-muted">
        {message ? message : "Single-tap mint. Costs a fraction of a cent in test AVAX."}
      </div>

      {(phase === "error" || persistError) && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
          {persistError ?? message}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button type="submit" disabled={isWorking} className="btn btn-primary focus-ring">
          {isWorking ? phaseLabel[phase] : phase === "error" ? "Retry" : "Mint passport"}
        </button>
      </div>
    </form>
  );
}
