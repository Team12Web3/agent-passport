"use client";

import { useEffect, useRef, useState } from "react";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function StepUsername({
  initialValue = "",
  onNext,
}: {
  initialValue?: string;
  onNext: (username: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<Status>(initialValue ? "available" : "idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const u = value.trim().toLowerCase();
    if (u.length === 0) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setStatus("invalid");
      return;
    }
    // Skip the availability check if the value matches the persisted username
    // we were initialized with — it's already ours.
    if (u === initialValue.trim().toLowerCase()) {
      setStatus("available");
      return;
    }
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/onboarding/username-available?u=${encodeURIComponent(u)}`,
          { cache: "no-store" },
        );
        const data = (await r.json()) as { available: boolean; reason?: string };
        if (!r.ok) {
          setStatus("invalid");
          return;
        }
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("invalid");
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, initialValue]);

  const canContinue = status === "available" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    const u = value.trim().toLowerCase();
    setSubmitError(null);

    // No-op POST if it matches what we already persisted — just advance.
    if (u === initialValue.trim().toLowerCase()) {
      onNext(u);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "username_taken") {
          setStatus("taken");
        } else if (data.error === "invalid_username") {
          setStatus("invalid");
        } else {
          setSubmitError("Couldn't save username. Please try again.");
        }
        return;
      }
      onNext(u);
    } catch {
      setSubmitError("Couldn't save username. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="p-6" onSubmit={handleSubmit}>
      <h2 className="text-[18px] font-semibold tracking-tight">Pick a username</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        3–20 characters · lowercase, numbers, underscore. Public-facing.
      </p>

      <label htmlFor="username" className="mt-5 block text-[12px] text-subtle">
        Username
      </label>
      <input
        id="username"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s+/g, ""))}
        placeholder="alice_42"
        className="input focus-ring mt-1.5"
      />

      <div className="mt-2 h-4 text-[11.5px]">
        {status === "checking" && <span className="text-faint">Checking…</span>}
        {status === "invalid" && (
          <span className="text-rose-300">3–20 chars · a-z, 0-9, underscore</span>
        )}
        {status === "taken" && <span className="text-rose-300">That username is taken</span>}
        {status === "available" && <span className="text-emerald-300">Available</span>}
      </div>

      {submitError && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
          {submitError}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={!canContinue} className="btn btn-primary focus-ring">
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
