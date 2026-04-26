"use client";

import { useEffect, useRef, useState } from "react";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function StepUsername({ onNext }: { onNext: (username: string) => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
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
  }, [value]);

  const canContinue = status === "available";

  return (
    <form
      className="p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onNext(value.trim().toLowerCase());
      }}
    >
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

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={!canContinue} className="btn btn-primary focus-ring">
          Continue
        </button>
      </div>
    </form>
  );
}
