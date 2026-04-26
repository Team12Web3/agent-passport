"use client";

import { useState } from "react";

type Phase = "idle" | "provisioning" | "saving" | "error";

type ApiError = {
  error?: string;
  step?: "wallet" | "funding" | "mint";
  details?: unknown;
};

export function StepMint({
  username,
  onComplete,
}: {
  username: string;
  onComplete: () => void;
}) {
  const defaultName = `${username}-agent-1`;
  const [name, setName] = useState(defaultName);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // If provisioning succeeded but `/onboarding/complete` failed, retry only the
  // second call — we don't want to mint a second on-chain passport.
  const [provisioned, setProvisioned] = useState(false);

  const isWorking = phase === "provisioning" || phase === "saving";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isWorking) return;
    setErrorMessage(null);

    try {
      if (!provisioned) {
        setPhase("provisioning");
        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || defaultName,
            purpose: "Help me explore Agent Passport.",
            tools: ["scraper", "summarizer"],
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as ApiError;
          throw new Error(mapApiErrorToUserMessage(res.status, data));
        }
        setProvisioned(true);
      }

      setPhase("saving");
      const finish = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!finish.ok) {
        const data = (await finish.json().catch(() => ({}))) as ApiError;
        throw new Error(mapApiErrorToUserMessage(finish.status, data));
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setPhase("error");
      setErrorMessage(msg);
    }
  }

  const phaseLabel: Record<Phase, string> = {
    idle: "Mint passport",
    provisioning: "Provisioning agent…",
    saving: "Finishing up…",
    error: "Retry",
  };

  return (
    <form className="p-6" onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-semibold tracking-tight">Create your first agent</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        We&apos;ll provision a server-custodied wallet, fund it on Fuji, and mint a passport. No
        gas needed from you.
      </p>

      <label htmlFor="name" className="mt-5 block text-[12px] text-subtle">
        Agent name
      </label>
      <input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input focus-ring mt-1.5"
        disabled={isWorking || provisioned}
        maxLength={40}
      />

      <div className="mt-2 h-4 text-[11.5px] text-muted">
        {phase === "provisioning"
          ? "Creating wallet, funding, minting, approving ActionLog…"
          : phase === "saving"
            ? "Saving your profile…"
            : "Single-tap setup. We pay the gas on Fuji."}
      </div>

      {phase === "error" && errorMessage && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button type="submit" disabled={isWorking} className="btn btn-primary focus-ring">
          {phaseLabel[phase]}
        </button>
      </div>
    </form>
  );
}

function mapApiErrorToUserMessage(status: number, data: ApiError): string {
  if (status === 401) return "Your session expired. Please refresh the page and try again.";

  if (data.error === "provisioning_failed") {
    if (data.step === "wallet") return "We couldn't create your agent wallet. Please try again.";
    if (data.step === "funding") return "Our faucet is temporarily unavailable. Please try again in a moment.";
    if (data.step === "mint") return "Passport minting failed on-chain. Please try again.";
    return "Agent setup failed. Please try again.";
  }

  if (data.error === "username_taken") return "That username was just taken. Go back and choose another.";
  if (data.error === "invalid_username") return "Username must be 3–20 lowercase letters, numbers, or underscores.";

  if (status >= 500) return "Something went wrong on our end. Please try again.";

  return "Something went wrong. Please try again.";
}
